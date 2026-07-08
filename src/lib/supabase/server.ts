import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Anon-key Supabase client for server components / route handlers that need
 * request-scoped cookies (none exist yet - the app has no auth at all, but
 * this is the standard SSR client shape, ready for Supabase Auth later).
 * Same "public read access" RLS restrictions as the browser client; use
 * src/lib/supabase/admin.ts for privileged writes.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render - middleware refreshes
          // sessions instead. No-op here, matching Supabase's documented
          // Next.js SSR pattern.
        }
      },
    },
  });
}
