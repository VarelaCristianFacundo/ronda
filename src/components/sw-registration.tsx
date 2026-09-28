'use client';

import { useEffect } from 'react';

/** Registers the service worker in production builds only (dev caching gets in the way). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
      // Installability is progressive enhancement; the app works without it.
    });
  }, []);
  return null;
}
