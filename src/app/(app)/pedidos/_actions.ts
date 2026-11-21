"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { parseValor, round2, texto, totalComDesconto } from "@/lib/format";
import { erroDeMigracao, TEXTO_MIGRACAO_0017 } from "@/lib/migracao";

export type EstadoPagamento = { erro?: string; ok?: boolean };

/** RF-27/RF-28 — vários pagamentos por pedido. */
export async function registrarPagamento(
  _estado: EstadoPagamento,
  formData: FormData,
): Promise<EstadoPagamento> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  const pedido_id = String(formData.get("pedido_id"));
  const valor = parseValor(formData.get("valor"));
  const forma = texto(formData.get("forma")) ?? "dinheiro";
  const agendadoMeio = texto(formData.get("agendado_meio"));
  const agendadoPara = texto(formData.get("agendado_para"));

  if (valor <= 0) return { erro: "Informe um valor maior que zero." };

  if (forma === "faturado") {
    if (agendadoMeio !== "boleto" && agendadoMeio !== "pix") {
      return { erro: "Diga se o faturado é boleto ou PIX." };
    }
    if (!agendadoPara) return { erro: "Informe a data do boleto ou do PIX." };
  }

  const linha: Record<string, unknown> = {
    pedido_id,
    tipo: forma === "faturado" ? "parcela" : (texto(formData.get("tipo")) ?? "sinal"),
    valor,
    forma,
    data_pagamento:
      forma === "faturado" ? agendadoPara : texto(formData.get("data_pagamento")),
    recebido_por: texto(formData.get("recebido_por")) ?? perfil.id,
    observacao: texto(formData.get("observacao")),
    created_by: perfil.id,
  };

  if (forma === "faturado") {
    linha.agendado_meio = agendadoMeio;
    linha.agendado_para = agendadoPara;
  }

  const { error } = await supabase.from("pagamentos").insert(linha);

  if (error) {
    if (
      forma === "faturado" &&
      (erroDeMigracao(error) || error.code === "23514" || /faturado|agendado|forma/i.test(error.message))
    ) {
      return { erro: `A forma Faturado ainda não está no banco. ${TEXTO_MIGRACAO_0017}` };
    }
    return { erro: error.message };
  }

  revalidatePath(`/pedidos/${pedido_id}`);
  revalidatePath("/quadro");
  revalidatePath("/financeiro");
  return { ok: true };
}

/** RF-44: estorno é exclusão lógica, nunca some do banco. */
export async function estornarPagamento(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const pedido_id = String(formData.get("pedido_id"));

  await supabase
    .from("pagamentos")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath(`/pedidos/${pedido_id}`);
  revalidatePath("/quadro");
  revalidatePath("/financeiro");
}

export async function atualizarPedido(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase
    .from("pedidos")
    .update({
      prazo_entrega: texto(formData.get("prazo_entrega")),
      responsavel_id: texto(formData.get("responsavel_id")),
      observacoes: texto(formData.get("observacoes")),
    })
    .eq("id", id);

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/quadro");
}

/** Fluxo 7.2 — repetir o mesmo trabalho para o cliente. */
export async function repetirPedido(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const pedido_id = String(formData.get("pedido_id"));

  const { data, error } = await supabase.rpc("repetir_orcamento", {
    p_orcamento_id: null,
    p_pedido_id: pedido_id,
  });

  if (error) redirect(`/pedidos/${pedido_id}?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data}`);
}

export type ResultadoExclusao = { erro?: string };

/**
 * RF-44 — exclusão lógica. O card sai do quadro, das fichas e dos
 * relatórios (todas as views filtram deleted_at), mas a linha continua
 * no banco com quem excluiu, quando e por quê.
 *
 * A trava de quem pode excluir mora no trigger fn_valida_exclusao_pedido
 * (SQLSTATE VG003/VG004) — aqui só traduzimos o erro.
 */
export async function excluirPedido(
  _estado: ResultadoExclusao,
  formData: FormData,
): Promise<ResultadoExclusao> {
  await requerAuth();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const motivo = texto(formData.get("motivo"));

  if (!motivo || motivo.length < 3) {
    return { erro: "Escreva o motivo da exclusão." };
  }

  const { error } = await supabase
    .from("pedidos")
    .update({ deleted_at: new Date().toISOString(), exclusao_motivo: motivo })
    .eq("id", id);

  if (error) return { erro: error.message };

  revalidatePath("/quadro");
  revalidatePath("/financeiro");
  revalidatePath("/relatorios");
  redirect("/quadro?excluido=1");
}

export type EstadoItens = { erro?: string; ok?: boolean; aviso?: string };

type ItemEnviado = {
  id?: string | null;
  servico_id?: string | null;
  descricao?: string;
  quantidade?: number;
  preco_unitario?: number;
  especificacoes?: Record<string, string> | null;
};

function traduzirErroItem(error: { code?: string; message?: string }): string {
  const m = error.message ?? "";
  if (
    error.code === "42501" ||
    /cópia congelada|Apenas o dono|Sem permissão para alterar itens/i.test(m)
  ) {
    return "Alterar ou remover um item que já está no pedido precisa da migration 0017. Incluir um item novo já funciona sem ela. Recarregue a tela e confira o que ficou gravado.";
  }
  return m || "Não consegui salvar os itens.";
}

/**
 * Acréscimo durante a produção, no balcão ou no pedido que veio de
 * orçamento. O saldo é valor_total menos o que já entrou — a view
 * recalcula sozinha quando o total muda. O desconto do orçamento, se
 * houver, continua valendo.
 */
export async function salvarItensPedido(
  _estado: EstadoItens,
  formData: FormData,
): Promise<EstadoItens> {
  await requerAuth();
  const supabase = await createClient();
  const pedidoId = String(formData.get("pedido_id"));

  let brutos: ItemEnviado[];
  try {
    brutos = JSON.parse(String(formData.get("itens") ?? "[]"));
  } catch {
    return { erro: "Não consegui ler os itens." };
  }

  const itens = brutos
    .map((i) => ({
      id: i.id || null,
      servico_id: i.servico_id || null,
      descricao: (i.descricao ?? "").trim(),
      quantidade: round2(Number(i.quantidade)),
      preco_unitario: round2(Number(i.preco_unitario)),
      especificacoes: i.especificacoes ?? {},
    }))
    .filter((i) => i.descricao && i.quantidade > 0);

  if (itens.length === 0) return { erro: "O pedido precisa de ao menos um item." };
  if (itens.some((i) => i.preco_unitario < 0)) {
    return { erro: "Preço não pode ser negativo." };
  }

  const { data: pedido, error: erroPedido } = await supabase
    .from("pedidos")
    .select("id, orcamento_id")
    .eq("id", pedidoId)
    .is("deleted_at", null)
    .maybeSingle();

  if (erroPedido || !pedido) {
    return { erro: erroPedido?.message ?? "Pedido não encontrado." };
  }

  let desconto: { tipo: string; valor: number } | null = null;
  if (pedido.orcamento_id) {
    const { data: orc } = await supabase
      .from("orcamentos")
      .select("desconto_tipo, desconto_valor")
      .eq("id", pedido.orcamento_id)
      .maybeSingle();
    if (orc) {
      desconto = { tipo: orc.desconto_tipo, valor: Number(orc.desconto_valor) };
    }
  }

  const subDesejado = itens.reduce(
    (s, i) => s + round2(i.quantidade * i.preco_unitario),
    0,
  );
  if (totalComDesconto(subDesejado, desconto) <= 0) {
    return { erro: "O total precisa ser maior que zero." };
  }

  const { data: atuais } = await supabase
    .from("pedido_itens")
    .select("id, descricao, quantidade, preco_unitario, servico_id")
    .eq("pedido_id", pedidoId);

  const porId = new Map(
    (
      (atuais ?? []) as {
        id: string;
        descricao: string;
        quantidade: number;
        preco_unitario: number;
        servico_id: string | null;
      }[]
    ).map((i) => [i.id, i]),
  );

  const manter = new Set(
    itens.map((i) => i.id).filter((id): id is string => Boolean(id)),
  );
  const remover = [...porId.keys()].filter((id) => !manter.has(id));

  let falha: string | undefined;

  for (const item of itens) {
    if (!item.id || !porId.has(item.id)) continue;
    const atual = porId.get(item.id)!;
    const igual =
      atual.descricao === item.descricao &&
      round2(Number(atual.quantidade)) === item.quantidade &&
      round2(Number(atual.preco_unitario)) === item.preco_unitario &&
      (atual.servico_id ?? null) === item.servico_id;
    if (igual) continue;

    const { error } = await supabase
      .from("pedido_itens")
      .update({
        descricao: item.descricao,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        servico_id: item.servico_id,
      })
      .eq("id", item.id)
      .eq("pedido_id", pedidoId);

    if (error) {
      falha = traduzirErroItem(error);
      break;
    }
  }

  if (!falha && remover.length > 0) {
    const { error } = await supabase.from("pedido_itens").delete().in("id", remover);
    if (error) falha = traduzirErroItem(error);
  }

  if (!falha) {
    let ordem = porId.size;
    for (const item of itens) {
      if (item.id && porId.has(item.id)) continue;
      ordem += 1;
      const { error } = await supabase.from("pedido_itens").insert({
        pedido_id: pedidoId,
        servico_id: item.servico_id,
        descricao: item.descricao,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        especificacoes: item.especificacoes,
        ordem,
      });
      if (error) {
        falha = error.message;
        break;
      }
    }
  }

  const { data: gravados } = await supabase
    .from("pedido_itens")
    .select("quantidade, preco_unitario")
    .eq("pedido_id", pedidoId);

  const subtotal = (
    (gravados ?? []) as { quantidade: number; preco_unitario: number }[]
  ).reduce((s, i) => s + round2(Number(i.quantidade) * Number(i.preco_unitario)), 0);
  let total = totalComDesconto(subtotal, desconto);

  if (total > 0) {
    await supabase.from("pedidos").update({ valor_total: total }).eq("id", pedidoId);
  }

  let aviso: string | undefined;

  if (!falha && pedido.orcamento_id) {
    const { error } = await supabase.rpc("espelhar_itens_orcamento", {
      p_orcamento_id: pedido.orcamento_id,
      p_itens: itens.map((i) => ({
        servico_id: i.servico_id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        especificacoes: i.especificacoes,
      })),
    });

    if (error) {
      aviso = erroDeMigracao(error)
        ? `O pedido foi atualizado e o saldo recalculado. O texto do orçamento aprovado só acompanha depois da migration 0017. ${TEXTO_MIGRACAO_0017}`
        : `O pedido foi atualizado. O orçamento não acompanhou: ${error.message}`;
    } else {
      const { data: orc } = await supabase
        .from("orcamentos")
        .select("total")
        .eq("id", pedido.orcamento_id)
        .maybeSingle();
      if (orc) {
        total = Number(orc.total);
        await supabase.from("pedidos").update({ valor_total: total }).eq("id", pedidoId);
      }
    }
  }

  const { data: fin } = await supabase
    .from("vw_pedido_financeiro")
    .select("total_pago")
    .eq("pedido_id", pedidoId)
    .maybeSingle();
  const pago = Number(fin?.total_pago ?? 0);
  if (!falha && pago > total) {
    const extra =
      "O novo total ficou abaixo do que já entrou no caixa. O saldo fica zerado.";
    aviso = aviso ? `${aviso} ${extra}` : extra;
  }

  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/quadro");
  revalidatePath("/financeiro");
  if (pedido.orcamento_id) revalidatePath(`/orcamentos/${pedido.orcamento_id}`);

  if (falha) return { erro: falha };
  return { ok: true, aviso };
}
