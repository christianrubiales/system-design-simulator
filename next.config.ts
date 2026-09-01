import type { NextConfig } from "next";

/**
 * A GitHub Pages *project* site is served from `/<repo>/`, not from the domain
 * root. The deploy workflow sets `NEXT_PUBLIC_BASE_PATH` accordingly; dev, a
 * custom domain, and a user/org site all leave it empty. Hand-written paths
 * into `public/` go through `assetPath()` (src/lib/assetPath.ts) — Next only
 * rewrites the URLs it owns.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Fully static build to out/. The app is 100% client-side — no route
  // handlers, no middleware, no server actions — so there is nothing to run.
  output: "export",
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  // The default image optimizer needs a server; a static host has none.
  images: { unoptimized: true },
};

export default nextConfig;
