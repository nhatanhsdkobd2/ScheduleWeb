"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { initFirebaseAnalytics } from "@/lib/firebase-analytics";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-session";

export { AUTH_SESSION_COOKIE } from "@/lib/auth-session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function setAuthSessionCookie(loggedIn: boolean) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  if (loggedIn) {
    document.cookie = `${AUTH_SESSION_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
  } else {
    document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      setAuthSessionCookie(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      setAuthSessionCookie(Boolean(u));
    });
    return () => unsub();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!auth) {
      throw new Error("Firebase auth is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const signOutUser = useCallback(async () => {
    if (!auth) return;
    setAuthSessionCookie(false);
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signOutUser }),
    [user, loading, signInWithGoogle, signOutUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
