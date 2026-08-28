import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const perfilAtual = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (data as Profile | null) ?? null;
});

export async function requerAuth(): Promise<Profile> {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (!perfil.ativo) redirect("/login?erro=inativo");
  return perfil;
}

/**
 * Módulos de visão agregada. A trava real está na RLS — estas views
 * devolvem zero linha para o operador — isto aqui é só a porta da frente.
 */
export async function requerDono(): Promise<Profile> {
  const perfil = await requerAuth();
  if (perfil.role !== "dono") redirect("/quadro?erro=sem-permissao");
  return perfil;
}
