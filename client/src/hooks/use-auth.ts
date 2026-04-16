import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { API_BASE, getAuthHeaders } from "@/lib/queryClient";
import type { User } from "@shared/models/auth";
import { useEffect, useRef, useState } from "react";

async function fetchUser(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const response = await fetch(`${API_BASE}/api/auth/user`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export function useAuth() {
  const queryClient = useQueryClient();
  // Add local loading state to handle the split second where Supabase is parsing the URL hash
  const [isRestoringSession, setIsRestoringSession] = useState(
    () => window.location.hash.includes("access_token")
  );

  // Keep a ref mirror of isRestoringSession so the auth-state-change listener
  // can read the latest value without being re-subscribed on every flip (which
  // previously leaked subscriptions and created login-flow race conditions).
  const isRestoringSessionRef = useRef(isRestoringSession);
  useEffect(() => {
    isRestoringSessionRef.current = isRestoringSession;
  }, [isRestoringSession]);

  const { data: user, isLoading: isQueryLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Listen for Supabase auth state changes. Subscribe exactly once per mount.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // If we were waiting for a session restore (OAuth redirect), finish it
      if (isRestoringSessionRef.current && (event === "SIGNED_IN" || event === "SIGNED_OUT")) {
        setIsRestoringSession(false);
      }

      if (event === "SIGNED_IN" && session) {
        // Sync user to our database. Use getAuthHeaders() to pick up the
        // CSRF token + any other headers in one place rather than hand-building.
        const meta = session.user.user_metadata;
        const headers = {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        };
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

        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      }

      if (event === "SIGNED_OUT") {
        queryClient.setQueryData(["/api/auth/user"], null);
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

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
