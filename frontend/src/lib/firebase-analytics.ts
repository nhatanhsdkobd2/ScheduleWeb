"use client";

import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { app } from "@/lib/firebase";

let analyticsPromise: Promise<Analytics | null> | null = null;

/** Call once from the client after mount. No-ops on server or unsupported environments. */
export function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((ok) => (ok ? getAnalytics(app) : null));
  }
  return analyticsPromise;
}
