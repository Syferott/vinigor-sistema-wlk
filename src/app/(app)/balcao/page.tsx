import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { Balcao } from "./balcao";
import type { ClienteOpcao } from "@/components/seletor-cliente";
import type { Servico } from "@/lib/types";

export const metadata = { title: "Venda balcão" };

export default async function PaginaBalcao() {
  await requerAuth();
  const supabase = await createClient();

  const [{ data: clientes }, { data: servicos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, telefone, documento, condicoes_padrao")
      .is("deleted_at", null)
      .order("nome")
      .limit(1000),
    supabase
      .from("servicos")
      .select("*")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("nome"),
  ]);

  return (
    <>
      <CabecalhoPagina
        titulo="Venda balcão"
        descricao="Venda direta, sem orçamento. Vira pedido na hora."
      />
      <Conteudo>
        <Balcao
          clientes={(clientes ?? []) as ClienteOpcao[]}
          servicos={(servicos ?? []) as Servico[]}
        />
      </Conteudo>
    </>
  );
}
