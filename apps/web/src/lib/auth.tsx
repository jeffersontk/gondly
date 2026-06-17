import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, storeToken } from "./api";
import type { User } from "../types";

type LoginResponse = {
  accessToken: string;
  user: User;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  loginWithGoogleToken: (idToken: string) => Promise<void>;
  devLogin: (email: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const TOKEN_KEY = "gondly.token";
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const skipNextTokenRefresh = useRef(false);

  async function applyLogin(idToken: string) {
    const response = await api<LoginResponse>("/auth/google", {
      method: "POST",
      skipAuth: true,
      body: { idToken },
    });
    storeToken(response.accessToken);
    skipNextTokenRefresh.current = true;
    setToken(response.accessToken);
    setUser(response.user);
  }

  async function refreshUser() {
    const current = await api<User>("/auth/me");
    setUser(current);
  }

  async function devLogin(email: string, name: string) {
    const payload = window.btoa(JSON.stringify({ email, name }));
    await applyLogin(`dev:${payload}`);
  }

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      storeToken(null);
      setToken(null);
      setUser(null);
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    if (skipNextTokenRefresh.current) {
      skipNextTokenRefresh.current = false;
      setLoading(false);
      return;
    }

    refreshUser()
      .catch(() => {
        storeToken(null);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    function handleUnauthorized() {
      storeToken(null);
      setToken(null);
      setUser(null);
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
