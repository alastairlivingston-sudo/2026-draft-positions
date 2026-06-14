import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "wc_admin_session";
const DEFAULT_ADMIN_PASSWORD = "worldcup2026";
const FALLBACK_SECRET = "fantasy-wc-mvp";

/**
 * Returns the configured admin password, falling back to a default so
 * the app is usable immediately. Set ADMIN_PASSWORD in production.
 *
 * NOTE: This is an intentionally simple MVP auth scheme (one shared
 * password -> signed session cookie). When adding Supabase Auth,
 * replace `checkAdminPassword`/`isAdminAuthenticated` with
 * `supabase.auth.getUser()` + a role check, and keep the same
 * call sites (admin pages + API routes already gate on
 * `isAdminAuthenticated()`).
 */
export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function checkAdminPassword(password: string): boolean {
  return password.length > 0 && password === getAdminPassword();
}

/** Deterministic session token derived from the admin password + a fixed secret. */
export function getAdminSessionToken(): string {
  const data = `${getAdminPassword()}:${FALLBACK_SECRET}`;
  return Buffer.from(data).toString("base64");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE_NAME);
  return session?.value === getAdminSessionToken();
}
