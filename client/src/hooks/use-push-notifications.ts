import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./use-auth";
import { apiRequest } from "@/lib/queryClient";
import { isNative } from "@/lib/platform";
import { PushNotifications } from "@capacitor/push-notifications";

type PermissionState = "default" | "granted" | "denied" | "unsupported";

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

  const isPushSupported = isNative() || (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );

  useEffect(() => {
    if (!isPushSupported) {
      setPermission("unsupported");
      return;
    }

    if (isNative()) {
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

      fetch("/api/push/vapid-key")
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

    if (isNative()) {
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
      fetch(`/api/groups/${groupId}/push/vapid-key`)
        .then((res) => res.json())
        .then((data) => setVapidKey(data.vapidKey))
        .catch(() => {});
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
  };
}
