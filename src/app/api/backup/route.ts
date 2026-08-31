import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { perfilAtual } from "@/lib/auth";
import { hojeSP } from "@/lib/format";

/** Ordem pensada para restauração: pais antes dos filhos. */
const TABELAS = [
  "configuracoes",
  "colunas",
  "profiles",
  "clientes",
  "servicos",
  "orcamentos",
  "orcamento_itens",
  "pedidos",
  "pedido_itens",
  "pedido_eventos",
  "pedido_comentarios",
  "pedido_anexos",
  "pagamentos",
] as const;

type Linha = Record<string, unknown>;

function paraCsv(linhas: Linha[]): string {
  if (linhas.length === 0) return "";

  const colunas = [...new Set(linhas.flatMap((l) => Object.keys(l)))];

  const celula = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  return [
    colunas.join(","),
    ...linhas.map((l) => colunas.map((c) => celula(l[c])).join(",")),
  ].join("\r\n");
}

/**
 * Backup dos dados operacionais. Só o dono — o conteúdo é o cadastro
 * inteiro de clientes, preços e faturamento. A leitura passa pela sessão
 * do usuário, então a RLS continua valendo: não há atalho aqui.
 */
export async function GET(request: NextRequest) {
  const perfil = await perfilAtual();
  if (!perfil?.ativo) {
    return NextResponse.json({ erro: "Sem sessão." }, { status: 401 });
  }
  if (perfil.role !== "dono") {
    return NextResponse.json(
      { erro: "Backup é exclusivo do dono." },
      { status: 403 },
    );
  }

  const supabase = await createClient();
  const formato = request.nextUrl.searchParams.get("formato") ?? "json";
  const tabela = request.nextUrl.searchParams.get("tabela");
  const data = hojeSP();

  if (formato === "csv") {
    if (!tabela || !TABELAS.includes(tabela as (typeof TABELAS)[number])) {
      return NextResponse.json({ erro: "Tabela inválida." }, { status: 400 });
    }

    const { data: linhas, error } = await supabase.from(tabela).select("*");
    if (error) {
      return NextResponse.json({ erro: error.message }, { status: 500 });
    }

    // BOM para o Excel abrir acentuação corretamente
    return new NextResponse("﻿" + paraCsv((linhas ?? []) as Linha[]), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="vinigor-${tabela}-${data}.csv"`,
      },
    });
  }

  const backup: Record<string, unknown> = {
    gerado_em: new Date().toISOString(),
    gerado_por: perfil.email,
    observacao:
      "Backup lógico das tabelas operacionais. Não inclui arquivos do Storage nem contas do Auth.",
  };

  for (const t of TABELAS) {
    const { data: linhas, error } = await supabase.from(t).select("*");
    backup[t] = error ? { erro: error.message } : (linhas ?? []);
  }

  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="vinigor-backup-${data}.json"`,
    },
  });
}
