import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "./analytics";
import { api, getCachedApiRecord, storeToken } from "./api";
import { clearHttpCache, clearOutbox } from "./db";
import { clearPersistedQueryCache, queryClient } from "./queryClient";
import type { User } from "../types";

type LoginResponse = {
  accessToken: string;
  user: User;
  isNewUser?: boolean;
};

type AuthMethod = "google" | "dev";
type LogoutSource = "settings" | "app";
type LogoutOptions = {
  source?: LogoutSource;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  devLogin: (email: string, name: string) => Promise<void>;
  logout: (options?: LogoutOptions) => Promise<void>;
  refreshUser: () => Promise<void>;
};

const TOKEN_KEY = "gondly.token";
const AUTH_USER_CACHE_MAX_AGE = 24 * 60 * 60_000;
const AUTH_USER_BACKGROUND_REFRESH_INTERVAL = 5 * 60_000;
const AuthContext = createContext<AuthContextValue | null>(null);

async function clearLocalSessionCache() {
  queryClient.clear();
  await Promise.allSettled([clearHttpCache(), clearPersistedQueryCache(), clearOutbox()]);
}

function getAuthMethod(idToken: string): AuthMethod {
  return idToken.startsWith("dev:") ? "dev" : "google";
}

function trackLoginSuccess(method: AuthMethod, response: LoginResponse) {
  trackEvent("login", { method });

  if (method === "google" && response.isNewUser) {
    trackEvent("sign_up", { method });
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const skipNextTokenRefresh = useRef(false);

  async function applyLogin(idToken: string) {
    await clearLocalSessionCache();
    const response = await api<LoginResponse>("/auth/google", {
      method: "POST",
      skipAuth: true,
      body: { idToken },
    });
    storeToken(response.accessToken);
    skipNextTokenRefresh.current = true;
    setToken(response.accessToken);
    setUser(response.user);
    trackLoginSuccess(getAuthMethod(idToken), response);
  }

  async function refreshUser() {
    const current = await api<User>("/auth/me");
    setUser(current);
  }

  async function devLogin(email: string, name: string) {
    const payload = window.btoa(JSON.stringify({ email, name }));
    await applyLogin(`dev:${payload}`);
  }

  async function logout(options: LogoutOptions = {}) {
    const source = options.source ?? "app";

    try {
      await api("/auth/logout", { method: "POST" });
      trackEvent("logout", { source });
    } finally {
      storeToken(null);
      setToken(null);
      setUser(null);
      await clearLocalSessionCache();
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (skipNextTokenRefresh.current) {
      skipNextTokenRefresh.current = false;
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadCurrentUser() {
      let usedCachedUser = false;

      try {
        const cachedUserRecord = await getCachedApiRecord<User>("/auth/me").catch(() => null);
        if (cancelled) return;

        if (cachedUserRecord && Date.now() - cachedUserRecord.savedAt <= AUTH_USER_CACHE_MAX_AGE) {
          usedCachedUser = true;
          setUser(cachedUserRecord.value);
          setLoading(false);
        }

        if (cachedUserRecord && Date.now() - cachedUserRecord.savedAt <= AUTH_USER_BACKGROUND_REFRESH_INTERVAL) {
          return;
        }

        const current = await api<User>("/auth/me");
        if (cancelled) return;
        setUser(current);
      } catch {
        if (cancelled) return;
        storeToken(null);
        setToken(null);
        setUser(null);
        await clearLocalSessionCache();
      } finally {
        if (!cancelled && !usedCachedUser) {
          setLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    function handleUnauthorized() {
      storeToken(null);
      setToken(null);
      setUser(null);
      void clearLocalSessionCache();
    }

    window.addEventListener("gondly:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("gondly:unauthorized", handleUnauthorized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      loginWithGoogleToken: applyLogin,
      devLogin,
      logout,
      refreshUser,
    }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return context;
}
