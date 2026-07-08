import { NextResponse } from "next/server";

import { isAdminSessionAuthorized } from "@/lib/server/route-auth";

/** Reports whether the caller already holds a valid admin session cookie - used by AdminGate to decide whether to show the passphrase form. */
export async function GET() {
  return NextResponse.json({ authed: await isAdminSessionAuthorized() });
}
