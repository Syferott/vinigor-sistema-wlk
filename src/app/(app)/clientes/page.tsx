import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { BotaoLink } from "@/components/botao-link";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { documentoBR, telefoneBR, soDigitos } from "@/lib/format";
import type { Cliente } from "@/lib/types";

export const metadata = { title: "Clientes" };

export default async function PaginaClientes({
  searchParams,
}: PageProps<"/clientes">) {
  const { q } = await searchParams;
  const busca = typeof q === "string" ? q.trim() : "";
  const supabase = await createClient();

  // RF-02: busca parcial, sem case-sensitive, por nome, telefone ou documento
  let query = supabase
    .from("clientes")
    .select("id, nome, tipo, documento, telefone, email, created_at")
    .is("deleted_at", null)
    .order("nome")
    .limit(200);

  if (busca) {
    const limpo = busca.replace(/[,()*%]/g, " ").trim();
    const digitos = soDigitos(busca);
    const filtros = [`nome.ilike.*${limpo}*`];
    if (digitos.length >= 3) {
      filtros.push(
        `documento_norm.ilike.*${digitos}*`,
        `telefone_norm.ilike.*${digitos}*`,
      );
    }
    query = query.or(filtros.join(","));
  }

  const { data } = await query;
  const clientes = (data ?? []) as Cliente[];

  return (
    <>
      <CabecalhoPagina
        titulo="Clientes"
        descricao={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}${busca ? " encontrados" : ""}`}
      >
        <BotaoLink href="/clientes/novo">
          <Plus /> Novo cliente
        </BotaoLink>
      </CabecalhoPagina>

      <Conteudo className="grid gap-4">
        <form className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={busca}
            placeholder="Buscar por nome, telefone ou documento…"
            className="bg-card pl-9"
            aria-label="Buscar cliente"
          />
        </form>

        {clientes.length === 0 ? (
          <EstadoVazio
            titulo={busca ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"}
            descricao={
              busca
                ? "Tente outro trecho do nome, o telefone ou o documento."
                : "Cadastre o primeiro cliente para começar a orçar."
            }
          >
            <BotaoLink href="/clientes/novo">
              <Plus /> Novo cliente
            </BotaoLink>
          </EstadoVazio>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">Tipo</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Documento
                  </TableHead>
                  <TableHead>Telefone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clientes.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link
                        href={`/clientes/${c.id}`}
                        className="block hover:underline"
                      >
                        {c.nome}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {c.tipo}
                    </TableCell>
                    <TableCell className="hidden tabular md:table-cell">
                      {documentoBR(c.documento)}
                    </TableCell>
                    <TableCell className="tabular">
                      {telefoneBR(c.telefone)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Conteudo>
    </>
  );
}
