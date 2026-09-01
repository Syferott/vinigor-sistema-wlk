"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { parseValor, texto } from "@/lib/format";
import { moverPedidoParaColuna } from "@/app/(app)/quadro/_actions";

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

  // Fiado: o cliente leva agora e paga depois. A trava de entrega com
  // saldo (RF-29) continua de pé — o que muda é que aqui ela é atendida
  // pelo caminho da exceção, com o combinado registrado no pedido, em vez
  // de barrar a venda. É o mesmo caminho do quadro, então o pedido nasce
  // rastreável: aparece em Contas a receber e a justificativa fica na
  // ficha.
  const totalItens = itens.reduce(
    (s, i) => s + Math.round(i.quantidade * i.preco_unitario * 100) / 100,
    0,
  );
  const fiado =
    formData.get("entrega_fiado") === "1" &&
    entregaImediata &&
    valorPago < totalItens;
  const combinado = texto(formData.get("fiado_justificativa"));

  if (fiado && (!combinado || combinado.length < 3)) {
    return { erro: "Escreva o combinado de pagamento para entregar fiado." };
  }

  const { data, error } = await supabase.rpc("criar_venda_balcao", {
    p_cliente_id: cliente_id,
    p_itens: itens,
    // no fiado o pedido nasce em Aprovado e a entrega vem no passo
    // seguinte, que é onde cabe a justificativa
    p_entrega_imediata: entregaImediata && !fiado,
    p_pagamento_valor: valorPago > 0 ? valorPago : null,
    p_pagamento_forma: texto(formData.get("pagamento_forma")),
    p_observacoes: texto(formData.get("observacoes")),
  });

  if (error) {
    // VG001 vem do trigger de entrega: faltou dinheiro para entregar agora.
    if (error.code === "VG001") {
      return {
        erro: "Para entregar na hora, o pagamento precisa cobrir o total. Receba o valor cheio, marque “leva agora e paga depois” ou desmarque a entrega imediata.",
      };
    }
    return { erro: error.message };
  }

  const pedidoId = data as string;

  if (fiado) {
    const { data: entregue } = await supabase
      .from("colunas")
      .select("id")
      .eq("slug", "entregue")
      .maybeSingle();

    if (!entregue) {
      return {
        erro: "Venda registrada, mas não achei a coluna Entregue para mover o pedido.",
      };
    }

    const movido = await moverPedidoParaColuna({
      pedidoId,
      colunaId: entregue.id,
      justificativa: combinado!,
    });

    // A venda já existe: mandar para a ficha com o erro é melhor do que
    // deixar o vendedor achando que nada foi gravado.
    if (!movido.ok) {
      redirect(
        `/pedidos/${pedidoId}?erro=${encodeURIComponent(
          `Venda registrada, mas não consegui marcar como entregue: ${movido.erro}`,
        )}`,
      );
    }
  }

  revalidatePath("/quadro");
  revalidatePath("/financeiro");
  redirect(`/pedidos/${pedidoId}`);
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
