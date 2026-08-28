"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoSenha = { erro?: string };

export async function definirSenha(
  _estado: EstadoSenha,
  formData: FormData,
): Promise<EstadoSenha> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 8)
    return { erro: "A senha precisa ter ao menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "As senhas não são iguais." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) return { erro: error.message };

  revalidatePath("/", "layout");
  redirect("/quadro");
}
