import { useEffect, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt?: () => Promise<void>;
  userChoice?: Promise<{ outcome?: "accepted" | "dismissed" }>;
};

export type PwaInstallPlatform = "ios" | "android" | "desktop" | "unknown";

type PwaInstallState = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  installed: boolean;
  platform: PwaInstallPlatform;
  standalone: boolean;
};

const listeners = new Set<() => void>();
let initialized = false;
let state: PwaInstallState = {
  deferredPrompt: null,
  installed: false,
  platform: "unknown",
  standalone: false,
};

export function usePwaInstall() {
  useEffect(() => {
    initPwaInstall();
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function initPwaInstall() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  state = { ...state, platform: detectPlatform(), standalone: isStandalone(), installed: isStandalone() };
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);

  const displayMode = window.matchMedia?.("(display-mode: standalone)");
  displayMode?.addEventListener?.("change", handleDisplayModeChange);
}

export async function promptPwaInstall() {
  const prompt = state.deferredPrompt;
  if (!prompt?.prompt) return false;

  await prompt.prompt();
  state = { ...state, deferredPrompt: null };
  emit();
  return true;
}

export function isNativeInstallPromptAvailable() {
  return Boolean(state.deferredPrompt);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function handleBeforeInstallPrompt(event: Event) {
  event.preventDefault();
  state = {
    ...state,
    deferredPrompt: event as BeforeInstallPromptEvent,
    installed: isStandalone(),
    standalone: isStandalone(),
  };
  emit();
}

function handleAppInstalled() {
  state = { ...state, deferredPrompt: null, installed: true, standalone: true };
  emit();
}

function handleDisplayModeChange() {
  const standalone = isStandalone();
  state = { ...state, installed: standalone || state.installed, standalone };
  emit();
}

function emit() {
  listeners.forEach((listener) => listener());
}

function detectPlatform(): PwaInstallPlatform {
  const userAgent = navigator.userAgent.toLowerCase();
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/.test(userAgent) || iPadOS) return "ios";
  if (/android/.test(userAgent)) return "android";
  if (/macintosh|windows|linux|cros/.test(userAgent)) return "desktop";
  return "unknown";
}

function isStandalone() {
  const navigatorStandalone = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return navigatorStandalone || window.matchMedia?.("(display-mode: standalone)").matches || false;
}
