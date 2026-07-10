import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { API_BASE, getCsrfToken, queryClient as appQueryClient } from "@/lib/queryClient";
import type { User } from "@shared/models/auth";
import { useEffect, useState } from "react";

// Module-level singleton: register the Supabase auth listener (and the
// /api/auth/sync POST) exactly once, no matter how many components use
// useAuth(). Previously each hook mount registered its own listener, so a
// single SIGNED_IN event fired /api/auth/sync N times (once per mounted
// component). Hooks consume auth changes via React Query invalidation.
let authListenerRegistered = false;
function registerAuthListener() {
  if (authListenerRegistered) return;
  authListenerRegistered = true;

  // DEADLOCK WARNING: supabase-js emits auth events while holding its
  // internal auth lock and awaits async callbacks. Calling any lock-taking
  // auth method (getSession, refreshSession, ...) from inside this callback
  // deadlocks the whole client — exchangeCodeForSession hangs forever with
  // no error. Keep this callback synchronous and defer side effects; build
  // the Authorization header from the session the event already carries.
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session) {
      const accessToken = session.access_token;
      const meta = session.user.user_metadata;
      setTimeout(() => {
        void (async () => {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          };
          const csrf = await getCsrfToken();
          if (csrf) headers["X-CSRF-Token"] = csrf;
          await fetch(`${API_BASE}/api/auth/sync`, {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              firstName: meta?.full_name?.split(" ")[0] || meta?.name?.split(" ")[0] || null,
              lastName: meta?.full_name?.split(" ").slice(1).join(" ") || null,
              avatarUrl: meta?.avatar_url || null,
            }),
          }).catch(() => { });

          appQueryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        })();
      }, 0);
    }

    if (event === "SIGNED_OUT") {
      appQueryClient.setQueryData(["/api/auth/user"], null);
    }
  });
}
registerAuthListener();

async function fetchUser(): Promise<User | null> {
  let { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  // getSession() reads from storage but does NOT refresh the access token,
  // even when it's expired. After a cold start of the app (Capacitor kills the
  // WebView, autoRefresh isn't running), the access token can be hours past
  // its 1-hour TTL. Without this guard, we'd send the expired token to
  // /api/auth/user, get 401, and report the user as logged out — the bug
  // testers hit as "logged in the first time, then exited and wasn't logged in."
  const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
  if (expiresAt > 0 && expiresAt < Date.now() + 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null; // refresh token also dead — truly logged out
    session = data.session;
  }

  const response = await fetch(`${API_BASE}/api/auth/user`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.status === 401) {
    // Last-ditch retry: the server rejected the token for some reason the
    // expiry check didn't catch (clock skew, JWT revocation, etc.). Try one
    // forced refresh + retry before giving up.
    const { data, error } = await supabase.auth.refreshSession();
    if (error || !data.session) return null;
    const retry = await fetch(`${API_BASE}/api/auth/user`, {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (retry.status === 401) return null;
    if (!retry.ok) throw new Error(`${retry.status}: ${retry.statusText}`);
    return retry.json();
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

function detectInboundAuth(): boolean {
  if (typeof window === "undefined") return false;
  // Implicit flow returns tokens in the URL hash, PKCE returns ?code=...
  // We want the loading spinner in either case so the dashboard doesn't
  // briefly flash "please sign in" before Supabase finishes exchanging.
  return (
    window.location.hash.includes("access_token") ||
    window.location.hash.includes("type=recovery") ||
    new URLSearchParams(window.location.search).has("code")
  );
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [isRestoringSession, setIsRestoringSession] = useState(detectInboundAuth);

  const { data: user, isLoading: isQueryLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // While waiting for Supabase to finish an inbound OAuth redirect, watch for
  // the resulting auth event so we can clear the local loading flag. This
  // listener only exists during that brief window; the app-wide side effects
  // (sync POST, query invalidation) live in the module-level singleton above.
  useEffect(() => {
    if (!isRestoringSession) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setIsRestoringSession(false);
      }
    });

    // Safety net: if SIGNED_IN never fires (e.g. PKCE exchange fails),
    // give up after a few seconds so the UI doesn't hang on the spinner.
    const restoreTimeout = setTimeout(() => {
      setIsRestoringSession(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(restoreTimeout);
    };
  }, [isRestoringSession]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await supabase.auth.signOut();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/user"], null);
    },
  });

  return {
    user,
    isLoading: isQueryLoading || isRestoringSession,
    isAuthenticated: !!user,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
