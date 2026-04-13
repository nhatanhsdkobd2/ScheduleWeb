"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

function getFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
}

function hasRequiredFirebaseConfig(config: ReturnType<typeof getFirebaseConfig>): boolean {
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId,
  );
}

function getOrInitApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  if (!hasRequiredFirebaseConfig(config)) {
    if (typeof window !== "undefined") {
      console.warn("[firebase] Missing NEXT_PUBLIC_FIREBASE_* env vars. Firebase auth is disabled.");
    }
    return null;
  }
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(config);
}

export const app = getOrInitApp();
export const auth: Auth | null = app ? getAuth(app) : null;
