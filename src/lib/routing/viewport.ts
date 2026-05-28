/**
 * Viewport / scroll-mode helpers shared by server layouts (x-pathname, with
 * locale prefix) and client components (next-intl usePathname, without prefix).
 */

/** Bare React Flow canvas: `/tree/12345` or `/en/tree/12345` — no sub-routes. */
const TREE_CANVAS_PATH_RE =
  /^\/(?:en|he)\/tree\/\d{5}\/?$|^\/tree\/\d{5}\/?$/;

/** Marketing landing root: `/`, `/en`, `/he`. */
const LANDING_ROOT_PATH_RE = /^\/(?:en|he)?\/?$/;

export function isTreeCanvasPathname(pathname: string): boolean {
  return TREE_CANVAS_PATH_RE.test(pathname);
}

export function isLandingRootPathname(pathname: string): boolean {
  return LANDING_ROOT_PATH_RE.test(pathname);
}
