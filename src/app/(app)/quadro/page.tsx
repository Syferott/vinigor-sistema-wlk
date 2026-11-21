import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { Quadro } from "./quadro";
import { colunaDisponivel } from "@/lib/schema";
import { clientesNaHora, type ClienteRecorrenteBruto } from "@/lib/recorrencia";
import { hojeSP } from "@/lib/format";
import type {
  CardPedido,
  Coluna,
  FaturamentoCard,
  MeioFaturado,
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
  clientes: { nome: string; telefone: string | null } | null;
  nome_avulso?: string | null;
  telefone_avulso?: string | null;
  responsavel: { nome: string } | null;
  pedido_itens: { descricao: string; ordem: number }[] | null;
};

export default async function PaginaQuadro({
  searchParams,
}: PageProps<"/quadro">) {
  const { erro, excluido } = await searchParams;
  const perfil = await requerAuth();
  const supabase = await createClient();

  const temNomeAvulso = await colunaDisponivel("pedidos", "nome_avulso");
  const camposAvulso = temNomeAvulso ? "nome_avulso, telefone_avulso," : "";

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
           justificativa_saldo, ${camposAvulso} created_at, deleted_at,
           clientes(nome, telefone),
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
        .select("id, nome, email, role, ativo, senha_provisoria, created_at")
        .eq("ativo", true)
        .order("nome"),
    ]);

  const fin = new Map(
    ((financeiro ?? []) as PedidoFinanceiro[]).map((f) => [f.pedido_id, f]),
  );

  const faturadoPorPedido = new Map<string, FaturamentoCard>();
  const { data: faturados, error: erroFaturado } = await supabase
    .from("pagamentos")
    .select("pedido_id, agendado_meio, agendado_para")
    .eq("forma", "faturado")
    .is("deleted_at", null);

  if (!erroFaturado) {
    const hoje = hojeSP();
    const porPedido = new Map<string, { meio: MeioFaturado; data: string }[]>();
    for (const linha of (faturados ?? []) as {
      pedido_id: string;
      agendado_meio: MeioFaturado | null;
      agendado_para: string | null;
    }[]) {
      if (linha.agendado_meio !== "boleto" && linha.agendado_meio !== "pix") continue;
      if (!linha.agendado_para) continue;
      const lista = porPedido.get(linha.pedido_id) ?? [];
      lista.push({ meio: linha.agendado_meio, data: linha.agendado_para.slice(0, 10) });
      porPedido.set(linha.pedido_id, lista);
    }
    for (const [pedidoId, lista] of porPedido) {
      lista.sort((a, b) => a.data.localeCompare(b.data));
      const proximo = lista.find((f) => f.data >= hoje) ?? lista[lista.length - 1];
      if (proximo) faturadoPorPedido.set(pedidoId, proximo);
    }
  }

  let paraContatar: ReturnType<typeof clientesNaHora> = [];
  const { data: recorrentes, error: erroRecorrencia } = await supabase
    .from("clientes")
    .select("id, nome, telefone, recorrencia_dias")
    .eq("recorrente", true)
    .is("deleted_at", null);

  if (!erroRecorrencia && recorrentes && recorrentes.length > 0) {
    const ids = (recorrentes as ClienteRecorrenteBruto[]).map((c) => c.id);
    const { data: ultimos } = await supabase
      .from("pedidos")
      .select("cliente_id, created_at")
      .in("cliente_id", ids)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const ultimo = new Map<string, string>();
    for (const p of (ultimos ?? []) as { cliente_id: string; created_at: string }[]) {
      if (!ultimo.has(p.cliente_id)) ultimo.set(p.cliente_id, p.created_at);
    }
    paraContatar = clientesNaHora(recorrentes as ClienteRecorrenteBruto[], ultimo);
  }

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
        cliente_telefone: p.clientes?.telefone ?? null,
        nome_avulso: p.nome_avulso ?? null,
        telefone_avulso: p.telefone_avulso ?? null,
        responsavel_nome: p.responsavel?.nome ?? null,
        resumo,
        total_pago: Number(f?.total_pago ?? 0),
        saldo_devedor: Number(f?.saldo_devedor ?? p.valor_total),
        situacao: (f?.situacao ?? "sem_pagamento") as SituacaoFinanceira,
        faturamento: faturadoPorPedido.get(p.id) ?? null,
      };
    },
  );

  return (
    <Quadro
      colunas={(colunas ?? []) as Coluna[]}
      cardsIniciais={cards}
      equipe={(equipe ?? []) as Profile[]}
      podeVerTotais={perfil.role === "dono"}
      podeEditarColunas={perfil.role === "dono"}
      erroInicial={typeof erro === "string" ? erro : undefined}
      pedidoExcluido={excluido === "1"}
      paraContatar={paraContatar}
    />
  );
}
