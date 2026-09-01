"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";

export type ResultadoMover =
  | { ok: true }
  | {
      ok: false;
      erro: string;
      /** RF-29: entrega com saldo — cabe exceção, com justificativa. */
      exigeJustificativa?: boolean;
      /** Conclusão com saldo: aqui não há exceção, só receber. */
      exigePagamento?: boolean;
      /** Quanto falta, lido na hora do erro. */
      saldo?: number;
    };

/**
 * RF-18 + RF-29. A trava de entrega com saldo mora no banco (trigger
 * fn_valida_entrega, SQLSTATE VG001/VG002). Aqui só traduzimos o erro.
 */
export async function moverPedido(input: {
  pedidoId: string;
  colunaId: string;
  posicao: number;
  justificativa?: string;
}): Promise<ResultadoMover> {
  await requerAuth();
  const supabase = await createClient();

  if (input.justificativa) {
    const { error: erroExcecao } = await supabase
      .from("pedidos")
      .update({
        entregue_com_saldo: true,
        justificativa_saldo: input.justificativa,
      })
      .eq("id", input.pedidoId);

    if (erroExcecao) return { ok: false, erro: erroExcecao.message };
  }

  const { error } = await supabase.rpc("mover_pedido", {
    p_pedido_id: input.pedidoId,
    p_coluna_id: input.colunaId,
    p_posicao: input.posicao,
  });

  if (error) {
    // VG008 vem da conclusão com saldo em aberto. Diferente da entrega,
    // não tem válvula de exceção: o caminho é receber o que falta, então
    // devolvemos o valor para a tela já abrir o recebimento preenchido.
    if (error.code === "VG008") {
      const { data: fin } = await supabase
        .from("vw_pedido_financeiro")
        .select("saldo_devedor")
        .eq("pedido_id", input.pedidoId)
        .maybeSingle();

      return {
        ok: false,
        erro: error.message,
        exigePagamento: true,
        saldo: Number(fin?.saldo_devedor ?? 0),
      };
    }

    const exige = error.code === "VG001" || error.code === "VG002";
    return { ok: false, erro: error.message, exigeJustificativa: exige };
  }

  revalidatePath("/quadro");
  return { ok: true };
}

/**
 * Move para o fim da coluna destino. É o caminho usado quando não há
 * arrasto — dentro do pedido, no celular.
 */
export async function moverPedidoParaColuna(input: {
  pedidoId: string;
  colunaId: string;
  justificativa?: string;
}): Promise<ResultadoMover> {
  await requerAuth();
  const supabase = await createClient();

  const { data: ultimo } = await supabase
    .from("pedidos")
    .select("posicao")
    .eq("coluna_id", input.colunaId)
    .is("deleted_at", null)
    .order("posicao", { ascending: false })
    .limit(1)
    .maybeSingle();

  const resultado = await moverPedido({
    ...input,
    posicao: Number(ultimo?.posicao ?? 0) + 1,
  });

  if (resultado.ok) revalidatePath(`/pedidos/${input.pedidoId}`);
  return resultado;
}

export async function definirResponsavel(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("pedido_id"));
  const responsavel = String(formData.get("responsavel_id") || "") || null;

  await supabase
    .from("pedidos")
    .update({ responsavel_id: responsavel })
    .eq("id", id);

  revalidatePath("/quadro");
  revalidatePath(`/pedidos/${id}`);
}

export async function definirPrazo(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("pedido_id"));
  const prazo = String(formData.get("prazo_entrega") || "") || null;

  await supabase.from("pedidos").update({ prazo_entrega: prazo }).eq("id", id);

  revalidatePath("/quadro");
  revalidatePath(`/pedidos/${id}`);
}

/**
 * Recebe o que falta e conclui, na mesma ação. Separado em duas chamadas
 * do banco de propósito: se o pagamento entrar e a mudança de coluna
 * falhar, o dinheiro registrado continua valendo — é o que de fato
 * aconteceu no balcão.
 */
export async function receberEConcluir(input: {
  pedidoId: string;
  colunaId: string;
  /** Ausente fora do quadro (na ficha não há arrasto): vai para o fim. */
  posicao?: number;
  valor: number;
  forma: string;
}): Promise<ResultadoMover> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  if (input.valor > 0) {
    const { data: fin } = await supabase
      .from("vw_pedido_financeiro")
      .select("saldo_devedor")
      .eq("pedido_id", input.pedidoId)
      .maybeSingle();

    const saldo = Number(fin?.saldo_devedor ?? 0);

    const { error } = await supabase.from("pagamentos").insert({
      pedido_id: input.pedidoId,
      tipo: input.valor >= saldo ? "quitacao" : "parcela",
      valor: input.valor,
      forma: input.forma,
      recebido_por: perfil.id,
      created_by: perfil.id,
    });

    if (error) return { ok: false, erro: error.message };

    revalidatePath("/financeiro");
    revalidatePath(`/pedidos/${input.pedidoId}`);
  }

  if (input.posicao === undefined) {
    return moverPedidoParaColuna({
      pedidoId: input.pedidoId,
      colunaId: input.colunaId,
    });
  }

  return moverPedido({
    pedidoId: input.pedidoId,
    colunaId: input.colunaId,
    posicao: input.posicao,
  });
}
