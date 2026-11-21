import "server-only";
import { createClient } from "@/lib/supabase/server";

/** A tela segue no ar quando a coluna da 0017 ainda não existe. */
export async function colunaDisponivel(
  tabela: "clientes" | "pedidos" | "pagamentos",
  coluna: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from(tabela).select(coluna).limit(1);
  return !error;
}
