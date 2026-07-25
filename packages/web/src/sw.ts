/// <reference lib="WebWorker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import type { PrecacheEntry } from 'workbox-precaching';
import { flushOnce } from './sync/flushCore';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

void self.skipWaiting();
clientsClaim();

// Precache the whole shell — the app must open with no network at all.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA navigation fallback; the api is never served from cache.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
);

// Background Sync where the platform supports it. The window worker's
// interval is the fallback — never depend on this alone.
self.addEventListener('sync', (event) => {
  const e = event as ExtendableEvent & { tag: string };
  if (e.tag === 'daybook-flush') {
    e.waitUntil(flushOnce(true));
  }
});
