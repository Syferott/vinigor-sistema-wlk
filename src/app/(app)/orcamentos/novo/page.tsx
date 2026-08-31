import { createClient } from "@/lib/supabase/server";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { FormularioNovoOrcamento } from "./formulario";
import type { ClienteOpcao } from "@/components/seletor-cliente";

export const metadata = { title: "Novo orçamento" };

export default async function NovoOrcamento({
  searchParams,
}: PageProps<"/orcamentos/novo">) {
  const { cliente } = await searchParams;
  const supabase = await createClient();

  const [{ data: clientes }, { data: config }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nome, telefone, documento, condicoes_padrao")
      .is("deleted_at", null)
      .order("nome")
      .limit(1000),
    supabase
      .from("configuracoes")
      .select("chave, valor")
      .eq("chave", "validade_orcamento_dias")
      .maybeSingle(),
  ]);

  return (
    <>
      <CabecalhoPagina
        titulo="Novo orçamento"
        descricao="Escolha o cliente. Os itens e os preços entram na próxima tela."
      />
      <Conteudo>
        <FormularioNovoOrcamento
          clientes={(clientes ?? []) as ClienteOpcao[]}
          clienteInicial={typeof cliente === "string" ? cliente : undefined}
          validadePadrao={Number(config?.valor ?? 15) || 15}
        />
      </Conteudo>
    </>
  );
}
