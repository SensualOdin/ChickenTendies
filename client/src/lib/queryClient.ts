import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";
import { isNative } from "./platform";

// On native, app runs from local files so we need the full backend URL.
// On web, API calls go to the same origin.
export const API_BASE = isNative()
  ? (import.meta.env.VITE_PRODUCTION_API_URL || "https://chickentinders.onrender.com")
  : (import.meta.env.VITE_API_URL || "");

// CSRF token is cached in memory for the lifetime of the tab/app launch.
// We refetch lazily on first mutation and on 403-CSRF_INVALID responses.
let cachedCsrfToken: string | null = null;
let csrfFetchInFlight: Promise<string | null> | null = null;

async function fetchCsrfToken(): Promise<string | null> {
  // De-dupe concurrent first-mutation bursts so we only hit /api/csrf-token once.
  if (csrfFetchInFlight) return csrfFetchInFlight;
  csrfFetchInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/csrf-token`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { token?: string };
      cachedCsrfToken = body.token ?? null;
      return cachedCsrfToken;
    } catch {
      return null;
    } finally {
      csrfFetchInFlight = null;
    }
  })();
  return csrfFetchInFlight;
}

export async function getCsrfToken(): Promise<string | null> {
  if (cachedCsrfToken) return cachedCsrfToken;
  return fetchCsrfToken();
}

export function invalidateCsrfToken(): void {
  cachedCsrfToken = null;
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
  // Attach CSRF token opportunistically. Server only enforces on mutating
  // methods, so including it on GETs is harmless and means every raw fetch
  // call site that routes through getAuthHeaders() is CSRF-compliant without
  // needing to remember it.
  const csrf = await getCsrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return headers;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
  const upper = method.toUpperCase();
  const needsCsrf = MUTATING_METHODS.has(upper);

  const doFetch = async (): Promise<Response> => {
    const authHeaders = await getAuthHeaders();
    const headers: Record<string, string> = { ...authHeaders };
    if (data) {
      headers["Content-Type"] = "application/json";
    }
    if (needsCsrf) {
      const token = await getCsrfToken();
      if (token) headers["X-CSRF-Token"] = token;
    }
    return fetch(`${API_BASE}${url}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
  };

  let res = await doFetch();

  // One-shot retry on CSRF failure: token may have expired or the session was
  // reset. Invalidate the cache, fetch a fresh token, and retry once.
  if (needsCsrf && res.status === 403) {
    const body = await res.clone().text();
    if (body.includes("CSRF_INVALID")) {
      invalidateCsrfToken();
      await fetchCsrfToken();
      res = await doFetch();
    }
  }

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
