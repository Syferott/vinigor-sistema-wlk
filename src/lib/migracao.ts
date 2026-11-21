/** Erro típico de coluna, função ou forma que a migration 0017 ainda não criou. */
export function erroDeMigracao(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const m = (error.message ?? "").toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    error.code === "PGRST202" ||
    error.code === "42883" ||
    m.includes("does not exist") ||
    m.includes("schema cache") ||
    m.includes("could not find the")
  );
}

export const TEXTO_MIGRACAO_0017 =
  "Falta aplicar a migration 0017 no SQL Editor do Supabase (arquivo supabase/migrations/0017_operacao_grafica.sql). Pode rodar de novo: não apaga dado. O resto do sistema continua funcionando.";
