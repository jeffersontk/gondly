// Development: notifications only. Never intercept Vite requests or cache app code.
importScripts("/push-events.js");
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
