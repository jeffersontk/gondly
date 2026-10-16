import { api } from "./api";

// Web Push lets the server remind people to finish a purchase even with the app closed. On iOS it only works
// when the PWA was added to the home screen (iOS 16.4+).

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined";
}

async function getRegistration() {
  if (!isPushSupported()) return undefined;
  // The service worker is only registered in production builds.
  return (await navigator.serviceWorker.getRegistration()) ?? undefined;
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
  if (typeof Notification === "undefined") return "unsupported" as const;
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const registration = await getRegistration();
  if (!registration) return permission;

  const { publicKey } = await api<{ publicKey: string | null }>("/push/public-key");
  if (!publicKey) return permission;

  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
  await sendSubscription(subscription);
  return permission;
}

/** Re-sends an existing subscription after login, so the device is linked to the account currently signed in. */
export async function syncPushSubscription() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const subscription = await (await getRegistration())?.pushManager.getSubscription();
    if (subscription) await sendSubscription(subscription);
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
