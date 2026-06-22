import { cacheGetRecord, cacheSet, clearHttpCache, type CacheRecord } from "./db";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";
const TOKEN_KEY = "gondly.token";
const DEFAULT_API_CACHE_MAX_AGE = 24 * 60 * 60_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export function isNetworkFailure(error: unknown) {
  return !(error instanceof ApiError);
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  timeoutMs?: number;
};

type TimeoutSignal = {
  signal: AbortSignal;
  cleanup: () => void;
};

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function apiCacheKey(path: string, method = "GET") {
  return `${method}:${API_URL}${path}`;
}

export async function getCachedApiRecord<T>(path: string): Promise<CacheRecord<T> | null> {
  return cacheGetRecord<T>(apiCacheKey(path));
}

export async function getCachedApi<T>(path: string, maxAge = DEFAULT_API_CACHE_MAX_AGE): Promise<T | null> {
  const record = await getCachedApiRecord<T>(path);
  if (!record) return null;
  if (maxAge !== Infinity && Date.now() - record.savedAt > maxAge) return null;
  return record.value;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.body ? "POST" : "GET");
  const headers = new Headers(options.headers);
  const token = getStoredToken();
  const timeout = createTimeoutSignal(options.signal ?? undefined, options.timeoutMs ?? (method === "GET" ? 8_000 : 12_000));

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !options.skipAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_URL}${path}`;
  const cacheKey = apiCacheKey(path, method);

  try {
    const response = await fetch(url, {
      ...options,
      method,
      headers,
      signal: timeout.signal,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      if (response.status === 401 && !options.skipAuth) {
        storeToken(null);
        window.dispatchEvent(new CustomEvent("gondly:unauthorized"));
      }
      throw new ApiError(data?.message ?? "Erro na requisicao", response.status);
    }

    if (method === "GET") {
      void cacheSet(cacheKey, data).catch(() => undefined);
    } else {
      void clearHttpCache().catch(() => undefined);
    }

    return data as T;
  } catch (error) {
    if (method === "GET" && isNetworkFailure(error)) {
      const cached = await cacheGetRecord<T>(cacheKey);
      if (cached) return cached.value;
    }
    throw error;
  } finally {
    timeout.cleanup();
  }
}

function createTimeoutSignal(externalSignal: AbortSignal | undefined, timeoutMs: number): TimeoutSignal {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const abortFromExternal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      window.clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}
