import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE } from "@/lib/server/route-auth";

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/**
 * Verifies the shared admin passphrase and, on success, sets an httpOnly
 * session cookie so the admin dashboard doesn't have to re-send it on
 * every click (see AdminGate / useLeagueActions). v1 auth model: the
 * cookie value is the passphrase itself, checked directly against
 * ADMIN_SECRET on each admin mutation - see isAdminSessionAuthorized.
 */
export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "ADMIN_SECRET is not configured" }, { status: 500 });
  }

  const { passphrase } = await request.json();
  if (passphrase !== secret) {
    return NextResponse.json({ error: "Incorrect passphrase" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS_SECONDS,
  });

  return NextResponse.json({ ok: true });
}
