import { useEffect } from "react";
import { useLocation } from "react-router-dom";

type AnalyticsParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const SENSITIVE_KEYS = new Set([
  "email",
  "name",
  "fullname",
  "full_name",
  "phone",
  "cpf",
  "document",
  "address",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "password",
  "notes",
  "note",
  "observation",
  "description",
  "message",
  "text",
  "product_name",
  "brand",
  "market_name",
  "list_name",
]);

const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PHONE_PATTERN = /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/;
let lastTrackedPage = "";

export function isAnalyticsEnabled() {
  return typeof window !== "undefined" && import.meta.env.VITE_ENABLE_ANALYTICS === "true";
}

export function safeAnalyticsParams(params: AnalyticsParams = {}): AnalyticsParams {
  const safeParams: AnalyticsParams = {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (isSensitiveKey(key)) continue;

    const safeValue = sanitizeAnalyticsValue(value);
    if (safeValue !== undefined && safeValue !== null) {
      safeParams[key] = safeValue;
    }
  }

  return safeParams;
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  const safeParams = safeAnalyticsParams(params);

  if (!isAnalyticsEnabled()) {
    debugAnalyticsEvent(eventName, safeParams, "disabled");
    return;
  }

  try {
    window.dataLayer = window.dataLayer || [];
    const payload = { event: eventName, ...safeParams };
    window.dataLayer.push(payload);
    debugAnalyticsEvent(eventName, payload, "sent");
  } catch (error) {
    debugAnalyticsEvent(eventName, { error: error instanceof Error ? error.message : "unknown_error" }, "failed");
  }
}

export function trackPageView(pathname: string, title = typeof document !== "undefined" ? document.title : undefined) {
  trackEvent("page_view", {
    page_path: pathname,
    page_title: title,
    app_area: getAppArea(pathname),
  });
}

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const pagePath = location.pathname;
    const pageKey = `${pagePath}|${document.title}`;
    if (lastTrackedPage === pageKey) return;
    lastTrackedPage = pageKey;
    trackPageView(pagePath, document.title);
  }, [location.pathname]);
}

export function getAppArea(pathname: string) {
  if (pathname === "/") return "landing";
  if (pathname.startsWith("/login")) return "auth";
  if (pathname.startsWith("/app/lists") || pathname.startsWith("/lists")) return "lists";
  if (pathname.startsWith("/app/purchase") || pathname.startsWith("/purchase")) return "purchase";
  if (pathname.startsWith("/app/history") || pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/app/compare") || pathname.startsWith("/prices")) return "compare";
  if (pathname.startsWith("/app/billing") || pathname.startsWith("/billing")) return "billing";
  if (pathname.startsWith("/app/settings") || pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/app")) return "app";
  return "app";
}

export function trackSafeSearch(context: "lists" | "purchase" | "history" | "compare" | "products", rawSearchTerm: string) {
  const searchTerm = rawSearchTerm.trim();
  if (!searchTerm) return;

  const params: AnalyticsParams = {
    context,
    search_length: searchTerm.length,
  };

  if (isSafeShortText(searchTerm)) {
    params.search_term = searchTerm;
  }

  trackEvent("search", params);
}

export function sanitizeAnalyticsCategory(value: unknown) {
  if (typeof value !== "string") return undefined;
  const category = value.trim();
  if (!isSafeShortText(category)) return undefined;
  return category.slice(0, 48);
}

function sanitizeAnalyticsValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (!isSafeShortText(trimmed) && !isKnownSafeString(trimmed)) return undefined;
    return trimmed.slice(0, 120);
  }

  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    const safeArray = value.map(sanitizeAnalyticsValue).filter((entry) => entry !== undefined && entry !== null);
    return safeArray.length ? safeArray : undefined;
  }

  if (typeof value === "object") {
    return safeAnalyticsParams(value as AnalyticsParams);
  }

  return undefined;
}

function isSensitiveKey(key: string) {
  const normalizedKey = key.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  return SENSITIVE_KEYS.has(normalizedKey);
}

function isSafeShortText(value: string) {
  if (value.length > 48) return false;
  if (EMAIL_PATTERN.test(value) || CPF_PATTERN.test(value) || PHONE_PATTERN.test(value)) return false;
  return /^[\p{L}\p{N}\s_-]+$/u.test(value);
}

function isKnownSafeString(value: string) {
  return /^[a-z0-9_:/.-]+$/i.test(value) && value.length <= 120;
}

function debugAnalyticsEvent(eventName: string, params: AnalyticsParams, status: "sent" | "disabled" | "failed") {
  if (typeof window === "undefined" || import.meta.env.VITE_DEBUG_ANALYTICS !== "true") return;
  console.info("[analytics]", status, eventName, params);
}
