"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { hojeSP, parseValor, texto } from "@/lib/format";

export type EstadoConta = { erro?: string; ok?: string };

export async function salvarConta(
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  const dono = await requerDono();
  const supabase = await createClient();

  const id = texto(formData.get("id"));
  const descricao = texto(formData.get("descricao"));
  const vencimento = texto(formData.get("vencimento"));
  const valor = parseValor(formData.get("valor"));

  if (!descricao) return { erro: "Descreva a conta." };
  if (!vencimento) return { erro: "Informe o vencimento." };
  if (valor <= 0) return { erro: "O valor precisa ser maior que zero." };

  const dados = {
    descricao,
    credor: texto(formData.get("credor")),
    categoria: texto(formData.get("categoria")) ?? "outro",
    valor,
    vencimento,
    observacao: texto(formData.get("observacao")),
    recorrente: formData.get("recorrente") === "on",
  };

  const { error } = id
    ? await supabase.from("contas_pagar").update(dados).eq("id", id)
    : await supabase
        .from("contas_pagar")
        .insert({ ...dados, created_by: dono.id });

  if (error) return { erro: error.message };

  revalidatePath("/contas-pagar");
  return { ok: id ? "Conta atualizada." : "Conta lançada." };
}

/** Dar baixa. Valor pago pode diferir do previsto (juros, desconto). */
export async function pagarConta(
  _estado: EstadoConta,
  formData: FormData,
): Promise<EstadoConta> {
  await requerDono();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const valorPago = parseValor(formData.get("valor_pago"));
  if (valorPago <= 0) return { erro: "Informe o valor pago." };

  const { error } = await supabase
    .from("contas_pagar")
    .update({
      pago_em: texto(formData.get("pago_em")) ?? hojeSP(),
      valor_pago: valorPago,
      forma: texto(formData.get("forma")) ?? "boleto",
    })
    .eq("id", id);

  if (error) return { erro: error.message };

  revalidatePath("/contas-pagar");
  return { ok: "Baixa registrada." };
}

/** Desfaz a baixa — para quando a conta foi marcada por engano. */
export async function estornarConta(formData: FormData) {
  await requerDono();
  const supabase = await createClient();

  await supabase
    .from("contas_pagar")
    .update({ pago_em: null, valor_pago: null, forma: null })
    .eq("id", String(formData.get("id")));

  revalidatePath("/contas-pagar");
}

/**
 * Luz, água e aluguel voltam todo mês. Em vez de agendar geração
 * automática — que enche a tela de conta que talvez não venha —, aqui o
 * dono duplica a conta para o mês seguinte com um clique, quando ela
 * chegar.
 */
export async function repetirNoProximoMes(formData: FormData) {
  const dono = await requerDono();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const { data: conta } = await supabase
    .from("contas_pagar")
    .select("descricao, credor, categoria, valor, vencimento, observacao, recorrente")
    .eq("id", id)
    .maybeSingle();

  if (!conta) return;

  const proximo = new Date(`${conta.vencimento}T12:00:00`);
  proximo.setMonth(proximo.getMonth() + 1);

  await supabase.from("contas_pagar").insert({
    ...conta,
    vencimento: proximo.toISOString().slice(0, 10),
    created_by: dono.id,
  });

  revalidatePath("/contas-pagar");
}

/** RF-44: exclusão lógica. */
export async function excluirConta(formData: FormData) {
  await requerDono();
  const supabase = await createClient();

  await supabase
    .from("contas_pagar")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", String(formData.get("id")));

  revalidatePath("/contas-pagar");
}
