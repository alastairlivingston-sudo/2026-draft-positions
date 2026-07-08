import { NextResponse } from "next/server";

import { applyAdminAction, DEFAULT_ADMIN_ACTOR, type AdminActionRequest } from "@/lib/store/mutations";
import { fetchLeagueDataFromSupabase, writeBackLeagueData } from "@/lib/server/league-data";
import { isAdminSessionAuthorized } from "@/lib/server/route-auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Single RPC-style endpoint for every admin dashboard write (see
 * useLeagueActions) - dispatches to the pure apply* functions in
 * src/lib/store/mutations.ts against a fresh Supabase snapshot, then
 * writes back only what changed. Session-cookie gated (see
 * /api/admin/login) rather than a header, since this is called on every
 * admin click, not just once.
 */
export async function POST(request: Request) {
  if (!(await isAdminSessionAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: AdminActionRequest = await request.json();

  try {
    const supabase = createSupabaseAdminClient();
    const before = await fetchLeagueDataFromSupabase(supabase);
    const after = applyAdminAction(before, body, DEFAULT_ADMIN_ACTOR);
    if (!after) return NextResponse.json({ ok: true, noop: true });

    await writeBackLeagueData(supabase, before, after);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[/api/admin/mutate] failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Mutation failed" }, { status: 500 });
  }
}
