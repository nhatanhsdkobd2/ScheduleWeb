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

function getMissingFirebaseKeys(config: ReturnType<typeof getFirebaseConfig>): string[] {
  const required: Array<{ key: string; value: string | undefined }> = [
    { key: "NEXT_PUBLIC_FIREBASE_API_KEY", value: config.apiKey },
    { key: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", value: config.authDomain },
    { key: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", value: config.projectId },
    { key: "NEXT_PUBLIC_FIREBASE_APP_ID", value: config.appId },
  ];
  return required.filter((item) => !item.value?.trim()).map((item) => item.key);
}

function getOrInitApp(): FirebaseApp | null {
  const config = getFirebaseConfig();
  const missingKeys = getMissingFirebaseKeys(config);
  if (missingKeys.length > 0) {
    if (typeof window !== "undefined") {
      console.warn(`[firebase] Missing env vars: ${missingKeys.join(", ")}. Firebase auth is disabled.`);
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
