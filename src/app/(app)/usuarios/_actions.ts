"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requerDono } from "@/lib/auth";
import { texto } from "@/lib/format";
import type { Papel } from "@/lib/types";

export type EstadoUsuario = { erro?: string; ok?: string };

/** Sobra algum dono ativo se este aqui deixar de ser? */
async function sobraOutroDonoAtivo(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "dono")
    .eq("ativo", true)
    .neq("id", id);

  return (count ?? 0) > 0;
}

/** RF-41 — só o dono cadastra usuários. */
export async function criarUsuario(
  _estado: EstadoUsuario,
  formData: FormData,
): Promise<EstadoUsuario> {
  await requerDono();

  const email = texto(formData.get("email"));
  const nome = texto(formData.get("nome"));
  const senha = String(formData.get("senha") ?? "");
  const role: Papel = texto(formData.get("role")) === "dono" ? "dono" : "operador";

  if (!email || !nome) return { erro: "Informe nome e e-mail." };
  if (senha.length < 8) return { erro: "A senha precisa ter ao menos 8 caracteres." };

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { erro: (e as Error).message };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });

  if (error) return { erro: error.message };

  // O trigger cria o perfil inativo e sem papel escolhido — de propósito.
  // Ativar é decisão do dono, e acontece aqui, no único caminho que exige
  // service_role. O papel pedido pelo próprio usuário nunca vale nada.
  const { error: erroPerfil } = await admin
    .from("profiles")
    .update({ nome, role, ativo: true, senha_provisoria: true })
    .eq("id", data.user.id);

  if (erroPerfil) return { erro: erroPerfil.message };

  revalidatePath("/usuarios");
  return {
    ok:
      role === "dono"
        ? `${nome} cadastrado como dono — acesso total, incluindo relatórios.`
        : `${nome} cadastrado como operador.`,
  };
}

export async function atualizarUsuario(formData: FormData) {
  await requerDono();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const nome = texto(formData.get("nome"));
  const roleEnviado = texto(formData.get("role"));

  const dados: { nome?: string; role?: Papel } = {};
  if (nome) dados.nome = nome;

  // O select do próprio dono vem desabilitado, e campo desabilitado não é
  // enviado no form. Sem esta guarda, salvar o próprio nome rebaixaria o
  // dono a operador — e, sendo o único, ninguém poderia promovê-lo de volta.
  if (roleEnviado === "dono" || roleEnviado === "operador") {
    if (roleEnviado === "operador" && !(await sobraOutroDonoAtivo(id))) {
      redirect("/usuarios?erro=ultimo-dono");
    }
    dados.role = roleEnviado;
  }

  if (Object.keys(dados).length === 0) return;

  await supabase.from("profiles").update(dados).eq("id", id);
  revalidatePath("/usuarios");
}

export async function alternarAtivo(formData: FormData) {
  const dono = await requerDono();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "1";

  // Nada de se desativar sozinho e ficar sem dono no sistema.
  if (id === dono.id) return;

  if (!ativo && !(await sobraOutroDonoAtivo(id))) {
    redirect("/usuarios?erro=ultimo-dono");
  }

  await supabase.from("profiles").update({ ativo }).eq("id", id);
  revalidatePath("/usuarios");
}
