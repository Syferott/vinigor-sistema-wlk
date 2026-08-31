import { createBrowserClient } from "@supabase/ssr";
import { chavePublicavel, urlSupabase } from "@/lib/env";

export function createClient() {
  return createBrowserClient(
    urlSupabase(),
    chavePublicavel(),
  );
}
