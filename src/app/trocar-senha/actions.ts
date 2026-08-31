"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EstadoTroca = { erro?: string };

export async function trocarSenha(
  _estado: EstadoTroca,
  formData: FormData,
): Promise<EstadoTroca> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 8)
    return { erro: "A senha precisa ter ao menos 8 caracteres." };
  if (senha !== confirmacao) return { erro: "As senhas não são iguais." };

  const supabase = await createClient();

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) {
    return {
      erro:
        error.message.includes("should be different")
          ? "A nova senha precisa ser diferente da atual."
          : error.message,
    };
  }

  // Baixa a marca de senha provisória. É SECURITY DEFINER porque escrever
  // em profiles é privilégio do dono — a função mexe só na própria linha.
  const { error: erroMarca } = await supabase.rpc("marcar_senha_definida");
  if (erroMarca) return { erro: erroMarca.message };

  revalidatePath("/", "layout");
  redirect("/quadro");
}
