import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { Quadro } from "./quadro";
import type {
  CardPedido,
  Coluna,
  PedidoFinanceiro,
  Profile,
  SituacaoFinanceira,
} from "@/lib/types";

export const metadata = { title: "Quadro de produção" };

type PedidoBruto = {
  id: string;
  numero: string;
  orcamento_id: string | null;
  cliente_id: string;
  coluna_id: string;
  posicao: number;
  prazo_entrega: string | null;
  valor_total: number;
  responsavel_id: string | null;
  observacoes: string | null;
  entregue_em: string | null;
  entregue_com_saldo: boolean;
  justificativa_saldo: string | null;
  created_at: string;
  deleted_at: string | null;
  clientes: { nome: string } | null;
  responsavel: { nome: string } | null;
  pedido_itens: { descricao: string; ordem: number }[] | null;
};

export default async function PaginaQuadro({
  searchParams,
}: PageProps<"/quadro">) {
  const { erro } = await searchParams;
  const perfil = await requerAuth();
  const supabase = await createClient();

  const [{ data: colunas }, { data: pedidos }, { data: financeiro }, { data: equipe }] =
    await Promise.all([
      supabase
        .from("colunas")
        .select("*")
        .eq("ativo", true)
        .order("ordem"),
      supabase
        .from("pedidos")
        .select(
          `id, numero, orcamento_id, cliente_id, coluna_id, posicao, prazo_entrega,
           valor_total, responsavel_id, observacoes, entregue_em, entregue_com_saldo,
           justificativa_saldo, created_at, deleted_at,
           clientes(nome),
           responsavel:profiles!pedidos_responsavel_id_fkey(nome),
           pedido_itens(descricao, ordem)`,
        )
        .is("deleted_at", null)
        .order("posicao"),
      supabase
        .from("vw_pedido_financeiro")
        .select("pedido_id, total_pago, saldo_devedor, situacao"),
      supabase
        .from("profiles")
        .select("id, nome, email, role, ativo, created_at")
        .eq("ativo", true)
        .order("nome"),
    ]);

  const fin = new Map(
    ((financeiro ?? []) as PedidoFinanceiro[]).map((f) => [f.pedido_id, f]),
  );

  const cards: CardPedido[] = ((pedidos ?? []) as unknown as PedidoBruto[]).map(
    (p) => {
      const f = fin.get(p.id);
      const itens = [...(p.pedido_itens ?? [])].sort((a, b) => a.ordem - b.ordem);
      const resumo =
        itens.length === 0
          ? "Sem itens"
          : itens.length === 1
            ? itens[0].descricao
            : `${itens[0].descricao} +${itens.length - 1}`;

      return {
        ...p,
        cliente_nome: p.clientes?.nome ?? "—",
        responsavel_nome: p.responsavel?.nome ?? null,
        resumo,
        total_pago: Number(f?.total_pago ?? 0),
        saldo_devedor: Number(f?.saldo_devedor ?? p.valor_total),
        situacao: (f?.situacao ?? "sem_pagamento") as SituacaoFinanceira,
      };
    },
  );

  return (
    <Quadro
      colunas={(colunas ?? []) as Coluna[]}
      cardsIniciais={cards}
      equipe={(equipe ?? []) as Profile[]}
      podeVerTotais={perfil.role === "dono"}
      erroInicial={typeof erro === "string" ? erro : undefined}
    />
  );
}
