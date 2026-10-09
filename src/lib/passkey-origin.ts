/** Canonical HTTPS origin used by passkey challenges and signature verification.
 * Accepts a hostname entered without scheme in Cloudflare, never downgrades to HTTP.
 */
export function normalizePasskeyOrigin(configured: string | null | undefined): string | null {
  if (!configured?.trim()) return null;
  const raw = configured.trim();
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username ||
        parsed.password || parsed.port || parsed.pathname !== "/" ||
        parsed.search || parsed.hash) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isPermittedPasskeyRequest(configured: string | null | undefined, request: Request): boolean {
  const expected = normalizePasskeyOrigin(configured);
  if (!expected || request.headers.get("origin") !== expected) return false;
  try {
    return new URL(request.url).origin === expected;
  } catch {
    return false;
  }
}

export function passkeyHostMatches(configured: string | null | undefined, request: Request): boolean {
  const expected = normalizePasskeyOrigin(configured);
  if (!expected) return false;
  try {
    return new URL(request.url).origin === expected;
  } catch {
    return false;
  }
}
