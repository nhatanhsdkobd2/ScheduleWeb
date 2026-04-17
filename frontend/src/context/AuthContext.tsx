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
  changePassword,
  loginWithEmailPassword,
  setApiAuthRole,
  type AuthLoginUser,
} from "@/lib/api";
import { AUTH_SESSION_COOKIE } from "@/lib/auth-session";

export { AUTH_SESSION_COOKIE } from "@/lib/auth-session";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const AUTH_STORAGE_KEY = "scheduleweb.auth_user";

export function setAuthSessionCookie(loggedIn: boolean) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  if (loggedIn) {
    document.cookie = `${AUTH_SESSION_COOKIE}=1; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax${secure ? "; Secure" : ""}`;
  } else {
    document.cookie = `${AUTH_SESSION_COOKIE}=; path=/; max-age=0`;
  }
}

function writeStoredUser(user: AuthLoginUser | null): void {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

function readStoredUser(): AuthLoginUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthLoginUser>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id || !parsed.email || !parsed.displayName) return null;
    return {
      id: String(parsed.id),
      email: String(parsed.email),
      displayName: String(parsed.displayName),
      role: (parsed.role as AuthLoginUser["role"]) ?? "member",
      team: String(parsed.team ?? ""),
      photoURL: parsed.photoURL ?? null,
      mustChangePassword: Boolean(parsed.mustChangePassword),
    };
  } catch {
    return null;
  }
}

type AuthContextValue = {
  user: AuthLoginUser | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthLoginUser>;
  changeMyPassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
  ) => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthLoginUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = readStoredUser();
    setUser(saved);
    setApiAuthRole(saved?.role);
    setAuthSessionCookie(Boolean(saved));
    setLoading(false);
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const loggedInUser = await loginWithEmailPassword(email, password);
    setUser(loggedInUser);
    writeStoredUser(loggedInUser);
    setApiAuthRole(loggedInUser.role);
    setAuthSessionCookie(true);
    return loggedInUser;
  }, []);

  const changeMyPassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string,
      confirmPassword: string,
    ) => {
      const current = readStoredUser();
      const email = current?.email ?? user?.email;
      if (!email) {
        throw new Error("No active user session.");
      }
      const updated = await changePassword(
        email,
        currentPassword,
        newPassword,
        confirmPassword,
      );
      setUser(updated);
      writeStoredUser(updated);
      setApiAuthRole(updated.role);
      setAuthSessionCookie(true);
    },
    [user?.email],
  );

  const signOutUser = useCallback(async () => {
    writeStoredUser(null);
    setUser(null);
    setApiAuthRole("member");
    setAuthSessionCookie(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signInWithPassword, changeMyPassword, signOutUser }),
    [user, loading, signInWithPassword, changeMyPassword, signOutUser],
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
