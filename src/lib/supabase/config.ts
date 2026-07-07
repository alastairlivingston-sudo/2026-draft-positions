/**
 * Master switch for the Supabase-backed store. Defaults off so the existing
 * localStorage/Zustand app keeps working unmodified until the migration
 * (see the Phase 0-4 plan) reaches the cutover phase. Routes that write to
 * Supabase (cron ingest, admin refresh) no-op while this is false.
 */
export function isSupabaseEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_SUPABASE === "true";
}

/** True once the Supabase project env vars are actually present, regardless of the feature flag. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
