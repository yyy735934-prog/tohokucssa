const CACHE_NAME = "tohoku-market-static-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() ?? {}; } catch { data = { body: event.data?.text() ?? "" }; }
  event.waitUntil((async () => {
    const targetUrl = new URL(data.url || "/account", self.location.origin);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (windows.some((client) => client.visibilityState === "visible" && new URL(client.url).pathname === targetUrl.pathname)) return;
    await self.registration.showNotification(data.title || "东北集市", {
      body: data.body || "你有一条新消息。",
      icon: "/icons/pwa-192.png",
      badge: "/icons/favicon-64.png",
      tag: data.tag || "tohoku-market-message",
      data: { url: targetUrl.pathname },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/account", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith("/assets/")) return;
  event.respondWith(caches.open(CACHE_NAME).then(async (cache) => {
    const cached = await cache.match(request);
    const fresh = fetch(request).then((response) => {
      if (response.ok) void cache.put(request, response.clone());
      return response;
    });
    return cached ?? fresh;
  }));
});
