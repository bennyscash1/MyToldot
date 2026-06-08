/**
 * Viewport / scroll-mode helpers shared by server layouts (x-pathname, with
 * locale prefix) and client components (next-intl usePathname, without prefix).
 */

/** Bare React Flow canvas: `/tree/12345` or `/en/tree/12345` — no sub-routes. */
const TREE_CANVAS_PATH_RE =
  /^\/(?:en|he)\/tree\/\d{5}\/?$|^\/tree\/\d{5}\/?$/;

/** Family dashboard: `/tree/12345/dashboard` or localized variant. */
const DASHBOARD_PATH_RE =
  /^\/(?:en|he)\/tree\/\d{5}\/dashboard\/?$|^\/tree\/\d{5}\/dashboard\/?$/;

/** Marketing landing root: `/`, `/en`, `/he`. */
const LANDING_ROOT_PATH_RE = /^\/(?:en|he)?\/?$/;

/** Internal poster render target for Puppeteer and preview iframe. */
const PRINT_PATH_RE =
  /^\/(?:en|he)\/tree\/\d{5}\/print\/?$|^\/tree\/\d{5}\/print\/?$/;

export function isPrintPathname(pathname: string): boolean {
  return PRINT_PATH_RE.test(pathname);
}

export function isTreeCanvasPathname(pathname: string): boolean {
  return TREE_CANVAS_PATH_RE.test(pathname);
}

export function isDashboardPathname(pathname: string): boolean {
  return DASHBOARD_PATH_RE.test(pathname);
}

export function isLandingRootPathname(pathname: string): boolean {
  return LANDING_ROOT_PATH_RE.test(pathname);
}
