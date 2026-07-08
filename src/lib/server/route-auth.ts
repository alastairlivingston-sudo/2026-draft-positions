import "server-only";

import { cookies } from "next/headers";

/** Name of the cookie set by /api/admin/login once the passphrase is verified. */
export const ADMIN_SESSION_COOKIE = "admin_session";

/**
 * Shared-secret check for one-off admin-triggered write routes (seed,
 * refresh-now) that aren't called often enough to need a login session.
 * Callers send the passphrase directly as `x-admin-secret`.
 */
export function isAdminRequestAuthorized(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get("x-admin-secret") === secret;
}

/**
 * Session-cookie check for the frequently-called admin mutate route (see
 * /api/admin/login) - the cookie value is the passphrase itself (httpOnly,
 * secure, sameSite=lax), so this is just a stand-in for a real session
 * store under the v1 shared-passphrase model: whoever holds a cookie that
 * matches ADMIN_SECRET is authorized, exactly as if they'd sent the header
 * on every request.
 */
export async function isAdminSessionAuthorized(): Promise<boolean> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_SESSION_COOKIE)?.value === secret;
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
