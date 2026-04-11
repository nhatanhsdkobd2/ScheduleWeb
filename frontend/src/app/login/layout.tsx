import type { ReactNode } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
