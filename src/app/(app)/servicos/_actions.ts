"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { parseValor, texto } from "@/lib/format";

export type EstadoServico = { erro?: string; ok?: boolean };

export async function salvarServico(
  _estado: EstadoServico,
  formData: FormData,
): Promise<EstadoServico> {
  const perfil = await requerAuth();
  const supabase = await createClient();

  const id = texto(formData.get("id"));
  const nome = texto(formData.get("nome"));
  if (!nome) return { erro: "Informe o nome do serviço." };

  const dados = {
    nome,
    unidade: texto(formData.get("unidade")) ?? "un",
    preco_base: parseValor(formData.get("preco_base")),
    descricao_padrao: texto(formData.get("descricao_padrao")),
    ativo: formData.get("ativo") !== "0",
  };

  const { error } = id
    ? await supabase.from("servicos").update(dados).eq("id", id)
    : await supabase
        .from("servicos")
        .insert({ ...dados, created_by: perfil.id });

  if (error) return { erro: error.message };

  revalidatePath("/servicos");
  return { ok: true };
}

export async function alternarAtivo(formData: FormData) {
  await requerAuth();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "1";

  await supabase.from("servicos").update({ ativo }).eq("id", id);
  revalidatePath("/servicos");
}
