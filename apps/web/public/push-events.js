// Shared by the production worker and the development notification-only worker.
const NOTIFICATION_SETTINGS_CACHE = "gondly-notification-settings-v1";
const CHAT_SOUND_SETTING = "/__gondly_chat_sound__";
const activeChatViews = new Map();

self.addEventListener("message", event => {
  if (event.data?.type === "chat-view" && event.source?.id) {
    if (event.data.listId && event.data.connected) activeChatViews.set(event.source.id, event.data.listId);
    else activeChatViews.delete(event.source.id);
  }
  if (event.data?.type === "chat-sound-preference") {
    event.waitUntil(caches.open(NOTIFICATION_SETTINGS_CACHE).then(cache => cache.put(CHAT_SOUND_SETTING, new Response(JSON.stringify({ enabled: event.data.enabled !== false })))));
  }
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : "" }; }
  event.waitUntil((async () => {
    let silent = false;
    if (data.type === "chat") {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (clients.some(client => client.visibilityState === "visible" && activeChatViews.get(client.id) === data.listId)) return;
      try {
        const saved = await (await caches.open(NOTIFICATION_SETTINGS_CACHE)).match(CHAT_SOUND_SETTING);
        if (saved) silent = (await saved.json()).enabled === false;
      } catch { /* A preference read failure must not hide the notification. */ }
    }
    await self.registration.showNotification(data.title || "Gondly", {
      body: data.body || "", icon: "/icons/gondly-icon-192x192.png", badge: "/icons/gondly-icon-192x192.png",
      tag: data.tag, renotify: Boolean(data.tag), silent,
      data: { url: notificationUrl(data.url) },
    });
  })());
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = notificationUrl(event.notification.data?.url);
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    const client = clients.find(entry => new URL(entry.url).origin === self.location.origin);
    return client ? client.focus().then(() => client.navigate(url)) : self.clients.openWindow(url);
  }));
});

function notificationUrl(value) {
  try {
    const url = new URL(value || "/app/home", self.location.origin);
    if (url.origin === self.location.origin) return url.pathname + url.search;
  } catch { /* Fall back to the app instead of navigating outside its origin. */ }
  return "/app/home";
}
