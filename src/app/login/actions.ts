"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { urlSite } from "@/lib/env";

export type EstadoLogin = { erro?: string; ok?: string };

export async function entrar(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const destino = String(formData.get("redirect") ?? "/quadro");

  if (!email || !senha) return { erro: "Informe e-mail e senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return {
      erro:
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : error.message,
    };
  }

  revalidatePath("/", "layout");
  redirect(destino.startsWith("/") ? destino : "/quadro");
}

export async function recuperarSenha(
  _estado: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { erro: "Informe o e-mail." };

  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${urlSite()}/nova-senha`,
  });

  if (error) return { erro: error.message };
  return { ok: "Se o e-mail estiver cadastrado, o link de recuperação chegou." };
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
