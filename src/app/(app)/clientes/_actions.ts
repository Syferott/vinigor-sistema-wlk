"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { texto } from "@/lib/format";
import type { Cliente } from "@/lib/types";

export type EstadoCliente = {
  erro?: string;
  duplicados?: Pick<Cliente, "id" | "nome" | "telefone" | "documento">[];
  valores?: Record<string, string>;
};

export async function salvarCliente(
  _estado: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  const id = texto(formData.get("id"));
  const forcar = formData.get("forcar") === "1";

  const dados = {
    nome: texto(formData.get("nome")) ?? "",
    tipo: (texto(formData.get("tipo")) ?? "PF") as "PF" | "PJ",
    documento: texto(formData.get("documento")),
    telefone: texto(formData.get("telefone")),
    email: texto(formData.get("email")),
    endereco: texto(formData.get("endereco")),
    observacoes: texto(formData.get("observacoes")),
    condicoes_padrao: texto(formData.get("condicoes_padrao")),
  };

  const valores = Object.fromEntries(
    Object.entries(dados).map(([k, v]) => [k, v ?? ""]),
  ) as Record<string, string>;

  if (!dados.nome) {
    return { erro: "O nome é obrigatório.", valores };
  }

  // RF-04: duplicidade é aviso, não trava.
  if (!forcar && (dados.documento || dados.telefone)) {
    const { data: dups } = await supabase.rpc("clientes_duplicados", {
      p_documento: dados.documento,
      p_telefone: dados.telefone,
      p_ignorar: id,
    });

    if (dups && dups.length > 0) {
      return { duplicados: dups, valores };
    }
  }

  if (id) {
    const { error } = await supabase
      .from("clientes")
      .update(dados)
      .eq("id", id);
    if (error) return { erro: error.message, valores };
  } else {
    const { data, error } = await supabase
      .from("clientes")
      .insert({ ...dados, created_by: perfil.id })
      .select("id")
      .single();
    if (error) return { erro: error.message, valores };

    revalidatePath("/clientes");
    redirect(`/clientes/${data.id}`);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}`);
}

/** RF-44: exclusão sempre lógica. Nada some do banco. */
export async function excluirCliente(formData: FormData) {
  await requerAuth();
  const id = String(formData.get("id"));
  const supabase = await createClient();

  const { count } = await supabase
    .from("pedidos")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", id)
    .is("deleted_at", null);

  if (count && count > 0) {
    redirect(`/clientes/${id}?erro=tem-pedidos`);
  }

  await supabase
    .from("clientes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  revalidatePath("/clientes");
  redirect("/clientes");
}

export type EstadoClienteRapido = {
  erro?: string;
  cliente?: Pick<
    Cliente,
    "id" | "nome" | "telefone" | "documento" | "condicoes_padrao"
  >;
};

/**
 * Cadastro enxuto, feito de dentro do orçamento — evita sair da tela,
 * cadastrar em Clientes e voltar. Só o essencial do balcão; o resto da
 * ficha se completa depois.
 */
export async function criarClienteRapido(
  _estado: EstadoClienteRapido,
  formData: FormData,
): Promise<EstadoClienteRapido> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  const nome = texto(formData.get("nome"));
  if (!nome) return { erro: "Informe o nome do cliente." };

  const { data, error } = await supabase
    .from("clientes")
    .insert({
      nome,
      tipo: (texto(formData.get("tipo")) ?? "PF") as "PF" | "PJ",
      telefone: texto(formData.get("telefone")),
      documento: texto(formData.get("documento")),
      created_by: perfil.id,
    })
    .select("id, nome, telefone, documento, condicoes_padrao")
    .single();

  if (error) return { erro: error.message };

  revalidatePath("/clientes");
  return { cliente: data as EstadoClienteRapido["cliente"] };
}
