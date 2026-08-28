"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { hojeSP, parseValor, somaDias, texto } from "@/lib/format";
import type { HistoricoPreco } from "@/lib/types";

export type EstadoOrcamento = { erro?: string; ok?: boolean };

/** Cria o rascunho e manda direto para o editor de itens. */
export async function criarOrcamento(
  _estado: EstadoOrcamento,
  formData: FormData,
): Promise<EstadoOrcamento> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  const cliente_id = texto(formData.get("cliente_id"));
  if (!cliente_id) return { erro: "Escolha o cliente." };

  const validadeDias = Number(formData.get("validade_dias") ?? 15) || 15;
  const prazo = Number(formData.get("prazo_producao_dias") ?? 0) || null;

  // A numeração (ORC-2026-0142) é gerada no banco: proximo_numero() é
  // SECURITY DEFINER e revogada do cliente, então não há corrida de número.
  const { data, error } = await supabase.rpc("criar_orcamento", {
    p_cliente_id: cliente_id,
    p_validade: somaDias(hojeSP(), validadeDias),
    p_prazo_producao: prazo,
    p_observacoes: texto(formData.get("observacoes")),
  });

  if (error) return { erro: error.message };

  void perfil;
  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data}`);
}

/** RF-11: últimos 5 preços cobrados deste serviço para este cliente. */
export async function historicoPreco(
  clienteId: string,
  servicoId: string | null,
  descricao?: string,
): Promise<HistoricoPreco[]> {
  await requerAuth();
  const supabase = await createClient();

  let query = supabase
    .from("vw_historico_preco")
    .select(
      "cliente_id, servico_id, descricao, pedido_id, pedido_numero, data, quantidade, preco_unitario, total",
    )
    .eq("cliente_id", clienteId)
    .order("data", { ascending: false })
    .limit(5);

  if (servicoId) {
    query = query.eq("servico_id", servicoId);
  } else if (descricao) {
    query = query.ilike("descricao", `%${descricao.replace(/[%,()]/g, " ")}%`);
  } else {
    return [];
  }

  const { data } = await query;
  return (data ?? []) as HistoricoPreco[];
}

export async function adicionarItem(
  _estado: EstadoOrcamento,
  formData: FormData,
): Promise<EstadoOrcamento> {
  await requerAuth();
  const supabase = await createClient();

  const orcamento_id = String(formData.get("orcamento_id"));
  const descricao = texto(formData.get("descricao"));
  if (!descricao) return { erro: "Descreva o item." };

  const quantidade = parseValor(formData.get("quantidade"));
  if (quantidade <= 0) return { erro: "Quantidade precisa ser maior que zero." };

  const { count } = await supabase
    .from("orcamento_itens")
    .select("id", { count: "exact", head: true })
    .eq("orcamento_id", orcamento_id);

  const { error } = await supabase.from("orcamento_itens").insert({
    orcamento_id,
    servico_id: texto(formData.get("servico_id")),
    descricao,
    quantidade,
    preco_unitario: parseValor(formData.get("preco_unitario")),
    especificacoes: {
      material: texto(formData.get("material")) ?? "",
      tamanho: texto(formData.get("tamanho")) ?? "",
      cores: texto(formData.get("cores")) ?? "",
      acabamento: texto(formData.get("acabamento")) ?? "",
    },
    ordem: (count ?? 0) + 1,
  });

  if (error) return { erro: error.message };

  revalidatePath(`/orcamentos/${orcamento_id}`);
  return { ok: true };
}

export async function removerItem(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const orcamento_id = String(formData.get("orcamento_id"));

  await supabase.from("orcamento_itens").delete().eq("id", id);
  revalidatePath(`/orcamentos/${orcamento_id}`);
}

export async function atualizarCabecalho(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  await supabase
    .from("orcamentos")
    .update({
      validade: texto(formData.get("validade")),
      prazo_producao_dias: Number(formData.get("prazo_producao_dias")) || null,
      desconto_tipo: texto(formData.get("desconto_tipo")) ?? "valor",
      desconto_valor: parseValor(formData.get("desconto_valor")),
      observacoes: texto(formData.get("observacoes")),
    })
    .eq("id", id);

  revalidatePath(`/orcamentos/${id}`);
}

export async function mudarStatus(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));

  await supabase
    .from("orcamentos")
    .update({
      status,
      recusado_motivo:
        status === "recusado" ? texto(formData.get("motivo")) : null,
    })
    .eq("id", id);

  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/orcamentos");
}

/** RF-15: aprovar -> vira pedido no quadro (transação no banco). */
export async function aprovarOrcamento(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data, error } = await supabase.rpc("aprovar_orcamento", {
    p_orcamento_id: id,
    p_prazo_entrega: texto(formData.get("prazo_entrega")),
    p_responsavel: texto(formData.get("responsavel_id")),
  });

  if (error) {
    redirect(`/orcamentos/${id}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/quadro");
  revalidatePath("/orcamentos");
  redirect(`/pedidos/${data}`);
}

/** RF-16: orçamento aprovado é imutável — alterar gera -v2. */
export async function novaVersao(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));

  const { data, error } = await supabase.rpc("nova_versao_orcamento", {
    p_orcamento_id: id,
  });

  if (error) {
    redirect(`/orcamentos/${id}?erro=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/orcamentos");
  redirect(`/orcamentos/${data}`);
}
