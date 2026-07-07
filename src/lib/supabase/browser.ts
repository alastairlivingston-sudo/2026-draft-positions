"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Anon-key Supabase client for client components. RLS restricts it to the
 * "public read access" policies in supabase/schema.sql - no writes. Used
 * from Phase 2 (shared reads) onward.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
