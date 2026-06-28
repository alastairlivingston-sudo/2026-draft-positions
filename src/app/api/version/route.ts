import { NextResponse } from "next/server";

/**
 * Reports the build this server is running, so a long-open tab can notice
 * it's on stale JS from before the latest deploy and prompt a reload - see
 * useLivePolling's staleBuild check. NEXT_PUBLIC_BUILD_ID is inlined at
 * build time (next.config.ts), so this always reflects the deployed build,
 * not whatever happens to be in the request's runtime environment.
 */
export async function GET() {
  return NextResponse.json({ buildId: process.env.NEXT_PUBLIC_BUILD_ID ?? "" });
}
