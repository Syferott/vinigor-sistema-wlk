import "server-only";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";
import { chaveServico, urlSupabase } from "@/lib/env";

/**
 * Cliente com service_role. Ignora RLS — use SOMENTE dentro de server
 * actions já protegidas por requerDono(). A chave nunca vai para o browser
 * (o import de "server-only" quebra o build se alguém tentar).
 */
export function createAdminClient() {
  return criarClienteSupabase(
    urlSupabase(),
    chaveServico(),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
