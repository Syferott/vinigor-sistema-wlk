"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { texto } from "@/lib/format";

/** Erro do banco (RLS ou trigger) vira mensagem na própria tela. */
function voltar(erro?: string): never {
  revalidatePath("/quadro/colunas");
  revalidatePath("/quadro");
  redirect(
    erro ? `/quadro/colunas?erro=${encodeURIComponent(erro)}` : "/quadro/colunas",
  );
}

/**
 * O slug é o nome que o código usa (o balcão procura "aprovado", a
 * conclusão procura "concluido"). Nasce do título e nunca mais muda —
 * por isso é gerado aqui e não fica editável na tela.
 */
function gerarSlug(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "coluna"
  );
}

export async function criarColuna(formData: FormData) {
  await requerDono();
  const supabase = await createClient();

  const nome = texto(formData.get("nome"));
  if (!nome) voltar("Dê um nome para a coluna.");

  const { data: existentes } = await supabase.from("colunas").select("slug, ordem");
  const slugs = new Set((existentes ?? []).map((c) => c.slug));

  let slug = gerarSlug(nome);
  for (let i = 2; slugs.has(slug); i++) slug = `${gerarSlug(nome)}_${i}`;

  const ultima = Math.max(0, ...(existentes ?? []).map((c) => Number(c.ordem)));

  const { error } = await supabase.from("colunas").insert({
    slug,
    nome,
    ordem: ultima + 1,
    cor: texto(formData.get("cor")) ?? "#8CC63E",
  });

  voltar(error?.message);
}

export async function atualizarColuna(formData: FormData) {
  await requerDono();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const nome = texto(formData.get("nome"));
  if (!nome) voltar("O nome da coluna não pode ficar vazio.");

  const { error } = await supabase
    .from("colunas")
    .update({
      nome,
      cor: texto(formData.get("cor")) ?? "#8CC63E",
      ativo: formData.get("ativo") === "on",
    })
    .eq("id", id);

  voltar(error?.message);
}

/**
 * Troca de lugar com a vizinha. Duas linhas em vez de renumerar tudo:
 * a ordem é só relativa, e assim duas telas abertas não brigam pelo
 * mesmo número.
 */
export async function moverColuna(formData: FormData) {
  await requerDono();
  const supabase = await createClient();

  const id = String(formData.get("id"));
  const paraCima = formData.get("direcao") === "cima";

  const { data: colunas } = await supabase
    .from("colunas")
    .select("id, ordem")
    .order("ordem");

  const lista = colunas ?? [];
  const i = lista.findIndex((c) => c.id === id);
  const j = paraCima ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= lista.length) voltar();

  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("colunas").update({ ordem: lista[j].ordem }).eq("id", lista[i].id),
    supabase.from("colunas").update({ ordem: lista[i].ordem }).eq("id", lista[j].id),
  ]);

  voltar(e1?.message ?? e2?.message);
}
