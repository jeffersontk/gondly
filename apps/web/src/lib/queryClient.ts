import { QueryClient, dehydrate, hydrate, type DehydratedState, type Query } from "@tanstack/react-query";
import { queryCacheDelete, queryCacheGet, queryCacheSet } from "./db";

const PERSISTED_QUERY_CACHE_KEY = "react-query";
const PERSISTED_QUERY_CACHE_BUSTER = "gondly-web-query-cache-v1";
const PERSISTED_QUERY_CACHE_MAX_AGE = 24 * 60 * 60_000;
const QUERY_CACHE_PERSIST_DEBOUNCE = 1_000;
const BACKGROUND_SYNC_INTERVAL = 5 * 60_000;
const LAST_BACKGROUND_SYNC_KEY = "gondly.last-background-sync";

type PersistedQueryCache = {
  buster: string;
  savedAt: number;
  state: DehydratedState;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60_000,
      gcTime: 24 * 60 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

queryClient.setQueryDefaults(["active-purchases"], {
  staleTime: 0,
  refetchOnMount: true,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
});

queryClient.setQueryDefaults(["lists"], {
  staleTime: 30_000,
  refetchOnMount: true,
});

queryClient.setQueryDefaults(["billing-status"], {
  staleTime: 30 * 60_000,
});

queryClient.setQueryDefaults(["products-search"], {
  staleTime: 15 * 60_000,
  gcTime: 60 * 60_000,
});

function shouldPersistQuery(query: Query) {
  if (query.state.status !== "success" || query.state.data === undefined) return false;

  const [scope, value] = query.queryKey;
  if (scope === "active-purchases") return false;
  if (scope === "products-search" && typeof value === "string" && value.trim().length > 40) {
    return false;
  }

  return true;
}

export async function restorePersistedQueryCache() {
  const persisted = await queryCacheGet<PersistedQueryCache>(PERSISTED_QUERY_CACHE_KEY).catch(() => null);
  if (!persisted) return;

  const isExpired = Date.now() - persisted.savedAt > PERSISTED_QUERY_CACHE_MAX_AGE;
  if (persisted.buster !== PERSISTED_QUERY_CACHE_BUSTER || isExpired) {
    await clearPersistedQueryCache().catch(() => undefined);
    return;
  }

  try {
    hydrate(queryClient, persisted.state);
  } catch {
    await clearPersistedQueryCache().catch(() => undefined);
  }
}

async function persistQueryCache() {
  const state = dehydrate(queryClient, {
    shouldDehydrateQuery: shouldPersistQuery,
  });

  await queryCacheSet<PersistedQueryCache>(PERSISTED_QUERY_CACHE_KEY, {
    buster: PERSISTED_QUERY_CACHE_BUSTER,
    savedAt: Date.now(),
    state,
  });
}

export function installQueryCachePersistence() {
  if (typeof window === "undefined") return () => undefined;

  let timeout: number | undefined;
  const schedulePersist = () => {
    if (timeout) window.clearTimeout(timeout);
    timeout = window.setTimeout(() => {
      void persistQueryCache().catch(() => undefined);
    }, QUERY_CACHE_PERSIST_DEBOUNCE);
  };
  const persistNow = () => {
    if (timeout) window.clearTimeout(timeout);
    void persistQueryCache().catch(() => undefined);
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(schedulePersist);
  window.addEventListener("visibilitychange", persistNow);
  window.addEventListener("pagehide", persistNow);

  return () => {
    if (timeout) window.clearTimeout(timeout);
    unsubscribe();
    window.removeEventListener("visibilitychange", persistNow);
    window.removeEventListener("pagehide", persistNow);
  };
}

export async function clearPersistedQueryCache() {
  await queryCacheDelete(PERSISTED_QUERY_CACHE_KEY);
}

function getLastBackgroundSyncAt() {
  try {
    const value = window.localStorage.getItem(LAST_BACKGROUND_SYNC_KEY);
    const parsed = value ? Number(value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function setLastBackgroundSyncAt(value: number) {
  try {
    window.localStorage.setItem(LAST_BACKGROUND_SYNC_KEY, String(value));
  } catch {
    // Local storage is an optimization for throttling syncs; failure should not block the app.
  }
}

function runBackgroundSync() {
  if (!navigator.onLine || document.visibilityState === "hidden") return;

  const now = Date.now();
  if (now - getLastBackgroundSyncAt() < BACKGROUND_SYNC_INTERVAL) return;

  setLastBackgroundSyncAt(now);
  void queryClient.refetchQueries({ type: "active", stale: true });
}

export function installBackgroundQuerySync() {
  if (typeof window === "undefined") return () => undefined;

  const onVisible = () => {
    if (document.visibilityState === "visible") runBackgroundSync();
  };

  const startupSync = window.setTimeout(runBackgroundSync, 1_500);
  const interval = window.setInterval(runBackgroundSync, BACKGROUND_SYNC_INTERVAL);

  window.addEventListener("online", runBackgroundSync);
  window.addEventListener("visibilitychange", onVisible);

  return () => {
    window.clearTimeout(startupSync);
    window.clearInterval(interval);
    window.removeEventListener("online", runBackgroundSync);
    window.removeEventListener("visibilitychange", onVisible);
  };
}
