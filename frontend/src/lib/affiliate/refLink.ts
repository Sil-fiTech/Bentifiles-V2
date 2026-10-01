/**
 * Appends the current `?ref=<affiliate code>` (if present in the address bar) to
 * an internal path, so affiliate attribution survives navigation from the
 * landing page into the auth flow. Reads `window.location` at call time — intended
 * for use inside click handlers, so it never turns a page into a dynamic route.
 */
export function withRefParam(path: string): string {
  if (typeof window === 'undefined') return path;
  let ref: string | null = null;
  try {
    ref = new URLSearchParams(window.location.search).get('ref');
  } catch {
    return path;
  }
  if (!ref || !ref.trim()) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}ref=${encodeURIComponent(ref.trim())}`;
}
