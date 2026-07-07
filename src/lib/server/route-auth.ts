import "server-only";

/**
 * Shared-secret check for admin-triggered write routes (seed, refresh-now).
 * v1 auth is a single passphrase kept in an env var - see the Phase 2 plan
 * for a proper session-based version. Callers send it as `x-admin-secret`.
 */
export function isAdminRequestAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get("x-admin-secret") === secret;
}

/**
 * Verifies a request came from Vercel Cron, per Vercel's documented
 * convention: scheduled invocations send `Authorization: Bearer CRON_SECRET`.
 */
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
