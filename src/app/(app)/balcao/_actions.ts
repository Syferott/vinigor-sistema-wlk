"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { parseValor, texto } from "@/lib/format";
import { erroDeMigracao, TEXTO_MIGRACAO_0017 } from "@/lib/migracao";
import { registrarPagamento } from "@/app/(app)/pedidos/_actions";
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

  const nomeAvulso = texto(formData.get("nome_avulso"));
  const telefoneAvulso = texto(formData.get("telefone_avulso"));
  let cliente_id = texto(formData.get("cliente_id"));
  if (!cliente_id && nomeAvulso) {
    const generico = await consumidorFinal();
    cliente_id = generico?.id ?? null;
  }
  if (!cliente_id) {
    return { erro: "Escolha o cliente ou escreva o nome na venda." };
  }

  let itens: ItemVenda[];
  try {
    itens = JSON.parse(String(formData.get("itens") ?? "[]"));
  } catch {
    return { erro: "Não consegui ler os itens da venda." };
  }
  if (itens.length === 0) return { erro: "Adicione ao menos um item." };

  const entregaImediata = formData.get("entrega_imediata") === "1";
  const forma = texto(formData.get("pagamento_forma"));
  const faturado = forma === "faturado";
  const valorPago = faturado ? 0 : parseValor(formData.get("pagamento_valor"));

  if (faturado) {
    const meio = texto(formData.get("agendado_meio"));
    const data = texto(formData.get("agendado_para"));
    if (meio !== "boleto" && meio !== "pix") {
      return { erro: "Diga se o faturado é boleto ou PIX." };
    }
    if (!data) return { erro: "Informe a data do boleto ou do PIX." };
    if (entregaImediata && formData.get("entrega_fiado") !== "1") {
      return {
        erro: "Faturado deixa o valor em aberto. Desmarque “Entrega agora” para mandar para produção, ou marque “leva agora e paga depois”.",
      };
    }
  }

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
    p_entrega_imediata: entregaImediata && !fiado && !faturado,
    p_pagamento_valor: valorPago > 0 ? valorPago : null,
    p_pagamento_forma: faturado ? "dinheiro" : forma,
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
  let avisoNome = "";

  if (nomeAvulso || telefoneAvulso) {
    const { error: erroNome } = await supabase
      .from("pedidos")
      .update({
        nome_avulso: nomeAvulso,
        telefone_avulso: telefoneAvulso,
      })
      .eq("id", pedidoId);

    if (erroNome && erroDeMigracao(erroNome)) {
      const obs = [
        texto(formData.get("observacoes")),
        nomeAvulso ? `Cliente (sem cadastro): ${nomeAvulso}` : null,
        telefoneAvulso ? `Telefone: ${telefoneAvulso}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      await supabase.from("pedidos").update({ observacoes: obs }).eq("id", pedidoId);
      avisoNome = `A venda entrou. O nome avulso foi para as observações porque a migration 0017 ainda não rodou. ${TEXTO_MIGRACAO_0017}`;
    } else if (erroNome) {
      avisoNome = `A venda entrou, mas o nome avulso não gravou: ${erroNome.message}`;
    }
  }

  if (faturado) {
    const dados = new FormData();
    dados.set("pedido_id", pedidoId);
    dados.set("valor", String(parseValor(formData.get("valor_faturado"))));
    dados.set("forma", "faturado");
    dados.set("tipo", "parcela");
    dados.set("agendado_meio", texto(formData.get("agendado_meio")) ?? "");
    dados.set("agendado_para", texto(formData.get("agendado_para")) ?? "");
    const lancado = await registrarPagamento({}, dados);
    if (!lancado.ok) {
      redirect(
        `/pedidos/${pedidoId}?erro=${encodeURIComponent(
          `Venda registrada, mas o faturado não entrou: ${lancado.erro ?? ""}`,
        )}`,
      );
    }
  }

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
  if (avisoNome) {
    redirect(`/pedidos/${pedidoId}?erro=${encodeURIComponent(avisoNome)}`);
  }
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
