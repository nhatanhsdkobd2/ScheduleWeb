import type { NextConfig } from "next";

/** Target for `/api/proxy/*` rewrites (server-side only; not exposed to the browser). */
function backendProxyTarget(): string {
  const t =
    process.env.BACKEND_PROXY_TARGET?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "http://localhost:4000";
  return t.replace(/\/+$/, "");
}

const nextConfig: NextConfig = {
  async rewrites() {
    const base = backendProxyTarget();
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${base}/:path*`,
      },
    ];
  },
};

export default nextConfig;