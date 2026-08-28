import "server-only";
import { createClient as criarClienteSupabase } from "@supabase/supabase-js";

/**
 * Cliente com service_role. Ignora RLS — use SOMENTE dentro de server
 * actions já protegidas por requerDono(). A chave nunca vai para o browser
 * (o import de "server-only" quebra o build se alguém tentar).
 */
export function createAdminClient() {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — necessária para criar usuários.",
    );
  }

  return criarClienteSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    chave,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
