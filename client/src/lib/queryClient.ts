import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { isNative } from "./platform";

// On native, app runs from local files so we need the full backend URL.
// On web, API calls go to the same origin.
export const API_BASE = isNative()
  ? (import.meta.env.VITE_PRODUCTION_API_URL || "https://chickentinders.onrender.com")
  : (import.meta.env.VITE_API_URL || "");

/** @deprecated CSRF is no longer used — auth is handled via JWT Bearer tokens */
export function getCsrfToken(): string | null {
  return null;
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  // On native, cookies don't work cross-origin so send member bindings via header
  const memberBindings = localStorage.getItem("member-bindings");
  if (memberBindings) {
    headers["X-Member-Bindings"] = memberBindings;
  }
  return headers;
}

/** Save member bindings from server response header (native cross-origin fallback) */
export function saveMemberBindings(res: Response) {
  const bindings = res.headers.get("X-Member-Bindings");
  if (bindings) {
    localStorage.setItem("member-bindings", bindings);
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders };
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  saveMemberBindings(res);
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    const url = `${API_BASE}${queryKey.join("/")}`;
    const res = await fetch(url, {
      headers: authHeaders,
      credentials: "include",
    });

    saveMemberBindings(res);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
