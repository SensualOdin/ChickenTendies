import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { User } from "@shared/models/auth";
import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "";

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

  const { data: user, isLoading: isQueryLoading } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    queryFn: fetchUser,
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Listen for Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // If we were waiting for a session restore (OAuth redirect), finish it
      if (isRestoringSession && (event === "SIGNED_IN" || event === "SIGNED_OUT")) {
        setIsRestoringSession(false);
      }

      if (event === "SIGNED_IN" && session) {
        // Sync user to our database
        const meta = session.user.user_metadata;
        await fetch(`${API_BASE}/api/auth/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
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
  }, [queryClient, isRestoringSession]);

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
