import { cacheGet, cacheSet } from "./db";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";
const TOKEN_KEY = "gondly.token";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
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

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? (options.body ? "POST" : "GET");
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (!headers.has("Content-Type") && options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !options.skipAuth) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = `${API_URL}${path}`;
  const cacheKey = `${method}:${url}`;

  try {
    const response = await fetch(url, {
      ...options,
      method,
      headers,
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
      await cacheSet(cacheKey, data);
    }

    return data as T;
  } catch (error) {
    if (method === "GET" && !(error instanceof ApiError)) {
      const cached = await cacheGet<T>(cacheKey);
      if (cached) return cached;
    }
    throw error;
  }
}
