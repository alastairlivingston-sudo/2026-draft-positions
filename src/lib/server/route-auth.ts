import "server-only";

/**
 * Verifies a request came from Vercel Cron, per Vercel's documented
 * convention: scheduled invocations send `Authorization: Bearer CRON_SECRET`.
 */
export function isCronRequestAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
