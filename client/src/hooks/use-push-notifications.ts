import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { apiRequest, API_BASE } from "@/lib/queryClient";
import { isNative } from "@/lib/platform";
import { PushNotifications } from "@capacitor/push-notifications";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

// Native push requires a Firebase project + google-services.json checked into
// android/app/. Without it, Capacitor's PushNotifications.register() crashes
// the native side when Firebase fails to initialize — testers on the
// Play-store build saw the app close immediately after granting the
// "Allow notifications" system prompt. Until we add the Firebase config,
// gate native push behind an explicit opt-in env flag so the dashboard
// "Enable Notifications" card stays hidden and register() is never called.
const NATIVE_PUSH_ENABLED = import.meta.env.VITE_NATIVE_PUSH_ENABLED === "true";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  const isPushSupported = (isNative() && NATIVE_PUSH_ENABLED) || (
    !isNative() &&
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );

  useEffect(() => {
    if (!isPushSupported) {
      setPermission("unsupported");
      return;
    }

    if (isNative() && NATIVE_PUSH_ENABLED) {
      PushNotifications.checkPermissions().then(({ receive }) => {
        if (receive === "granted") setPermission("granted");
        else if (receive === "denied") setPermission("denied");
        else setPermission("default");
      });

      PushNotifications.addListener("registration", async (token) => {
        setIsSubscribed(true);
        try {
          await apiRequest("POST", "/api/push/subscribe-native", {
            token: token.value,
            platform: (await import("@/lib/platform")).getPlatform(),
          });
        } catch (err) {
          console.error("Failed to register native push token:", err);
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("Native push registration failed:", err);
      });

      return () => {
        PushNotifications.removeAllListeners();
      };
    } else {
      setPermission(Notification.permission as PermissionState);

      fetch(`${API_BASE}/api/push/vapid-key`, { credentials: "include" })
        .then((res) => res.json())
        .then((data) => setVapidKey(data.publicKey))
        .catch(() => {});

      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, [isPushSupported]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || !isAuthenticated) return false;

    setIsLoading(true);

    if (isNative() && NATIVE_PUSH_ENABLED) {
      try {
        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive === "granted") {
          setPermission("granted");
          await PushNotifications.register();
          setIsLoading(false);
          return true;
        } else {
          setPermission("denied");
          setIsLoading(false);
          return false;
        }
      } catch (error) {
        console.error("Native push error:", error);
        setIsLoading(false);
        return false;
      }
    }

    if (!vapidKey) {
      setIsLoading(false);
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subscriptionJson = subscription.toJSON();
      await apiRequest("POST", "/api/push/subscribe", {
        endpoint: subscriptionJson.endpoint,
        keys: subscriptionJson.keys,
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Push subscription error:", error);
      setIsLoading(false);
      return false;
    }
  }, [isPushSupported, isAuthenticated, vapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!isPushSupported) return false;

    setIsLoading(true);
    try {
      if (isNative()) {
        await PushNotifications.removeAllListeners();
        setIsSubscribed(false);
        setIsLoading(false);
        return true;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await apiRequest("DELETE", "/api/push/subscribe", {
          endpoint: subscription.endpoint,
        });
      }

      setIsSubscribed(false);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Push unsubscribe error:", error);
      setIsLoading(false);
      return false;
    }
  }, [isPushSupported]);

  return {
    isPushSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
  };
}

// Auto-registers an FCM token tied to (groupId, memberId) so the server can
// push notifications to this device when the host starts a session — even
// when the app is fully closed. Pairs with the new
// POST /api/groups/:id/push/subscribe-native endpoint.
//
// Designed to be called once from the lobby. It silently no-ops when:
//   - we're on web (web push is handled by useGroupPushNotifications below),
//   - native push is disabled at build time, or
//   - groupId/memberId aren't ready yet.
//
// If the OS notification permission hasn't been requested before, this
// triggers the system prompt. Testers in the v1.0.8 cohort were never
// seeing the prompt because the only path that asked for it was the
// dashboard "Enable Notifications" card — and they were joining parties
// before ever landing on the dashboard.
export function useGroupNativePush({ groupId, memberId }: { groupId: string | undefined; memberId: string | null }) {
  useEffect(() => {
    if (!isNative() || !NATIVE_PUSH_ENABLED || !groupId || !memberId) return;

    let listener: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const perm = await PushNotifications.checkPermissions();
        let receive = perm.receive;
        if (receive === "prompt" || receive === "prompt-with-rationale") {
          const req = await PushNotifications.requestPermissions();
          receive = req.receive;
        }
        if (receive !== "granted" || cancelled) return;

        listener = await PushNotifications.addListener("registration", async (token) => {
          if (cancelled) return;
          try {
            const platform = (await import("@/lib/platform")).getPlatform();
            const headers = await getAuthHeaders();
            await fetch(`${API_BASE}/api/groups/${groupId}/push/subscribe-native`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify({ memberId, token: token.value, platform }),
            });
          } catch (err) {
            console.error("Failed to register group native push token:", err);
          }
        });

        await PushNotifications.register();
      } catch (err) {
        console.error("Group native push setup failed:", err);
      }
    })();

    return () => {
      cancelled = true;
      listener?.remove().catch(() => {});
    };
  }, [groupId, memberId]);
}

interface UseGroupPushNotificationsOptions {
  groupId: string;
  memberId: string;
}

export function useGroupPushNotifications({ groupId, memberId }: UseGroupPushNotificationsOptions) {
  const [permission, setPermission] = useState<PermissionState>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  const isPushSupported = typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  useEffect(() => {
    if (!isPushSupported) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);

    if (groupId) {
      fetch(`${API_BASE}/api/groups/${groupId}/push/vapid-key`, { credentials: "include" })
        .then((res) => {
          if (!res.ok) throw new Error(`vapid-key HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => setVapidKey(data.vapidKey))
        .catch((err) => {
          // Server returns 500 if VAPID env vars aren't configured. The caller
          // uses !vapidKey to hide the notification banner entirely when this
          // happens, so we just need to make sure vapidKey stays null.
          console.warn("[push] vapid-key fetch failed, notifications disabled:", err);
          setVapidKey(null);
        });
    }
  }, [isPushSupported, groupId]);

  const subscribe = useCallback(async () => {
    if (!isPushSupported || !groupId || !memberId || !vapidKey) return false;

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PermissionState);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subscriptionJson = subscription.toJSON();
      await apiRequest("POST", `/api/groups/${groupId}/push/subscribe`, {
        memberId,
        subscription: {
          endpoint: subscriptionJson.endpoint,
          keys: {
            p256dh: subscriptionJson.keys?.p256dh,
            auth: subscriptionJson.keys?.auth,
          },
        },
      });

      setIsSubscribed(true);
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error("Group push subscription error:", error);
      setIsLoading(false);
      return false;
    }
  }, [isPushSupported, groupId, memberId, vapidKey]);

  return {
    isPushSupported,
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    // True once we've successfully fetched a VAPID key from the server. Call
    // sites use this to avoid showing an "Enable notifications" affordance
    // when push is not actually available (e.g., the server env lacks VAPID
    // keys and /api/groups/:id/push/vapid-key returns 500).
    vapidReady: !!vapidKey,
  };
}
