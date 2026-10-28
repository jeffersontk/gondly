import { api } from "./api";
import { getChatSoundEnabled } from "./chatSound";

// Web Push lets the server remind people to finish a purchase even with the app closed. On iOS it only works
// when the PWA was added to the home screen (iOS 16.4+).

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

async function getRegistration(create = false) {
  if (!isPushSupported()) return undefined;
  const current = await navigator.serviceWorker.getRegistration();
  if (current?.active) return current;
  if (!create) return undefined;
  await navigator.serviceWorker.register(import.meta.env.DEV ? "/push-sw.js" : "/sw.js");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Notification worker unavailable")), 8000); })]);
  } finally { clearTimeout(timeout); }
}

async function sendSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;
  await api("/push/subscriptions", {
    method: "POST",
    body: { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent.slice(0, 512) },
  });
}

/** Asks for notification permission (must run from a user gesture) and registers this device for push. */
export async function enablePushNotifications() {
  if (!isPushSupported()) return "unsupported" as const;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const { publicKey } = await api<{ publicKey: string | null }>("/push/public-key");
  if (!publicKey) return "unconfigured" as const;
  const registration = await getRegistration(true);
  if (!registration) return "unsupported" as const;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await sendSubscription(subscription);
  registration.active?.postMessage({ type: "chat-sound-preference", enabled: getChatSoundEnabled() });
  return "enabled" as const;
}

export async function getPushNotificationStatus() {
  if (!isPushSupported()) return "unsupported" as const;
  if (Notification.permission !== "granted") return Notification.permission;
  const { publicKey } = await api<{ publicKey: string | null }>("/push/public-key");
  if (!publicKey) return "unconfigured" as const;
  return (await (await getRegistration())?.pushManager.getSubscription()) ? "enabled" as const : "inactive" as const;
}

export async function disablePushNotifications() {
  const subscription = await (await getRegistration())?.pushManager.getSubscription();
  if (!subscription) return;
  await api("/push/subscriptions", { method: "DELETE", body: { endpoint: subscription.endpoint } });
  await subscription.unsubscribe();
}

/** Re-sends an existing subscription after login, so the device is linked to the account currently signed in. */
export async function syncPushSubscription() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const subscription = await (await getRegistration())?.pushManager.getSubscription();
    if (subscription) await sendSubscription(subscription);
    (await getRegistration())?.active?.postMessage({ type: "chat-sound-preference", enabled: getChatSoundEnabled() });
  } catch {
    // Best effort: reminders inside the app still work without push.
  }
}

/** Stops push for this device on logout, so the next account using it does not get the previous user's reminders. */
export async function removePushSubscription() {
  try {
    const subscription = await (await getRegistration())?.pushManager.getSubscription();
    if (!subscription) return;
    await api("/push/subscriptions", { method: "DELETE", body: { endpoint: subscription.endpoint } }).catch(() => undefined);
  } catch {
    // Ignore: the server drops subscriptions that stop working.
  }
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}
