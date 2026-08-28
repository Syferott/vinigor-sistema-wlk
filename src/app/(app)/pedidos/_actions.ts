"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { parseValor, texto } from "@/lib/format";

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

  if (valor <= 0) return { erro: "Informe um valor maior que zero." };

  const { error } = await supabase.from("pagamentos").insert({
    pedido_id,
    tipo: texto(formData.get("tipo")) ?? "sinal",
    valor,
    forma: texto(formData.get("forma")) ?? "dinheiro",
    data_pagamento: texto(formData.get("data_pagamento")),
    recebido_por: texto(formData.get("recebido_por")) ?? perfil.id,
    observacao: texto(formData.get("observacao")),
    created_by: perfil.id,
  });

  if (error) return { erro: error.message };

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
