/**
 * Base path this build is served from — `""` at a domain root (dev, a custom
 * domain, a user/org GitHub Pages site) or `/<repo>` for a GitHub Pages
 * project site. Set at build time via `NEXT_PUBLIC_BASE_PATH`.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefix a root-absolute `public/` path with the deployment's base path.
 *
 * Next rewrites the paths it owns (`_next/*`, static imports) from `basePath`,
 * but it cannot rewrite a URL we assemble ourselves or a raw `<img src>` — so
 * every hand-written path into `public/` must go through this helper, or it
 * 404s on a project site served from `/<repo>/`.
 */
export function assetPath(path: string, basePath: string = BASE_PATH): string {
  const base = basePath.replace(/\/+$/, "");
  const rest = path.startsWith("/") ? path : `/${path}`;
  return `${base}${rest}`;
}
