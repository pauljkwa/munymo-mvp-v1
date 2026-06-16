/**
 * Munymo Service Worker
 * Handles web push notifications and notification click events.
 * This file must be at the root of the site (served from /) to have
 * full-scope access to the entire app.
 */

const MUNYMO_LOGO = "https://munymo.com/manus-storage/munymo-logo-cropped_75fe3c86.png";
const APP_ORIGIN = self.location.origin;

// ─── Push Event ───────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {
    title: "Munymo",
    body: "You have a new notification.",
    url: "/",
    icon: MUNYMO_LOGO,
    badge: MUNYMO_LOGO,
    tag: "munymo-default",
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: { url: data.url },
    // Vibration pattern: short-long-short
    vibrate: [100, 50, 100],
    // Keep notification visible until user interacts
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ─── Notification Click ───────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url
    ? new URL(event.notification.data.url, APP_ORIGIN).href
    : APP_ORIGIN;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // If the app is already open, focus it and navigate
        for (const client of windowClients) {
          if (client.url.startsWith(APP_ORIGIN) && "focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(targetUrl);
            }
            return;
          }
        }
        // Otherwise open a new window
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Install & Activate (minimal — no caching needed) ────────────────────────

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
