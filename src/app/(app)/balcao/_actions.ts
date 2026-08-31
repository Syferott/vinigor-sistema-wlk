"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { parseValor, texto } from "@/lib/format";

export type EstadoVenda = { erro?: string };

type ItemVenda = {
  servico_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};

export async function finalizarVenda(
  _estado: EstadoVenda,
  formData: FormData,
): Promise<EstadoVenda> {
  await requerAuth();
  const supabase = await createClient();

  const cliente_id = texto(formData.get("cliente_id"));
  if (!cliente_id) return { erro: "Escolha o cliente da venda." };

  let itens: ItemVenda[];
  try {
    itens = JSON.parse(String(formData.get("itens") ?? "[]"));
  } catch {
    return { erro: "Não consegui ler os itens da venda." };
  }
  if (itens.length === 0) return { erro: "Adicione ao menos um item." };

  const entregaImediata = formData.get("entrega_imediata") === "1";
  const valorPago = parseValor(formData.get("pagamento_valor"));

  const { data, error } = await supabase.rpc("criar_venda_balcao", {
    p_cliente_id: cliente_id,
    p_itens: itens,
    p_entrega_imediata: entregaImediata,
    p_pagamento_valor: valorPago > 0 ? valorPago : null,
    p_pagamento_forma: texto(formData.get("pagamento_forma")),
    p_observacoes: texto(formData.get("observacoes")),
  });

  if (error) {
    // VG001 vem do trigger de entrega: faltou dinheiro para entregar agora.
    if (error.code === "VG001") {
      return {
        erro: "Para entregar na hora, o pagamento precisa cobrir o total. Receba o valor cheio ou desmarque a entrega imediata.",
      };
    }
    return { erro: error.message };
  }

  revalidatePath("/quadro");
  revalidatePath("/financeiro");
  redirect(`/pedidos/${data}`);
}

/**
 * Cliente genérico para quem não quer se cadastrar. Criado só na primeira
 * vez que alguém usa — não polui a base de quem nunca precisar.
 */
export async function consumidorFinal(): Promise<{
  id: string;
  nome: string;
  telefone: null;
  documento: null;
} | null> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  const { data: existente } = await supabase
    .from("clientes")
    .select("id, nome")
    .eq("nome", "Consumidor final")
    .is("deleted_at", null)
    .maybeSingle();

  if (existente) {
    return { id: existente.id, nome: existente.nome, telefone: null, documento: null };
  }

  const { data } = await supabase
    .from("clientes")
    .insert({
      nome: "Consumidor final",
      tipo: "PF",
      observacoes: "Cliente genérico para venda de balcão sem cadastro.",
      created_by: perfil.id,
    })
    .select("id, nome")
    .single();

  if (!data) return null;

  revalidatePath("/clientes");
  return { id: data.id, nome: data.nome, telefone: null, documento: null };
}
