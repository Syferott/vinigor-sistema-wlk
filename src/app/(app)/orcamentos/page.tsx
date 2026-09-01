import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { AvisoExclusao } from "./aviso";
import { BadgeStatus } from "@/components/badges";
import { BotaoLink } from "@/components/botao-link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dataBR } from "@/lib/format";
import { STATUS_ORCAMENTO, type StatusOrcamento } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "Orçamentos" };

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: "", rotulo: "Todos" },
  { valor: "rascunho", rotulo: "Rascunho" },
  { valor: "enviado", rotulo: "Enviado" },
  { valor: "aprovado", rotulo: "Aprovado" },
  { valor: "recusado", rotulo: "Recusado" },
  { valor: "expirado", rotulo: "Expirado" },
];

type Linha = {
  id: string;
  numero: string;
  status: StatusOrcamento;
  data_orcamento: string;
  validade: string;
  total: number;
  clientes: { nome: string } | null;
};

export default async function PaginaOrcamentos({
  searchParams,
}: PageProps<"/orcamentos">) {
  const { status, excluido } = await searchParams;
  await requerAuth();
  const supabase = await createClient();

  const filtro =
    typeof status === "string" && status in STATUS_ORCAMENTO ? status : "";

  let query = supabase
    .from("orcamentos")
    .select("id, numero, status, data_orcamento, validade, total, clientes(nome)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (filtro) query = query.eq("status", filtro);

  const { data } = await query;
  const orcamentos = (data ?? []) as unknown as Linha[];

  return (
    <>
      <AvisoExclusao excluido={excluido === "1"} />

      <CabecalhoPagina
        titulo="Orçamentos"
        descricao={`${orcamentos.length} ${orcamentos.length === 1 ? "orçamento" : "orçamentos"}`}
      >
        <BotaoLink href="/orcamentos/novo">
          <Plus /> Novo orçamento
        </BotaoLink>
      </CabecalhoPagina>

      <Conteudo className="grid gap-4">
        <nav className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={f.valor ? `/orcamentos?status=${f.valor}` : "/orcamentos"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                filtro === f.valor
                  ? "border-[#8cc63e] bg-[#8cc63e] font-medium text-[#1b2410]"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {f.rotulo}
            </Link>
          ))}
        </nav>

        {orcamentos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum orçamento aqui"
            descricao="Crie um orçamento a partir de um cliente — o sistema mostra os preços já cobrados antes."
          >
            <BotaoLink href="/orcamentos/novo">
              <Plus /> Novo orçamento
            </BotaoLink>
          </EstadoVazio>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Data</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Validade
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orcamentos.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium tabular">
                      <Link
                        href={`/orcamentos/${o.id}`}
                        className="hover:underline"
                      >
                        {o.numero}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {o.clientes?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="hidden tabular sm:table-cell">
                      {dataBR(o.data_orcamento)}
                    </TableCell>
                    <TableCell className="hidden tabular md:table-cell">
                      {dataBR(o.validade)}
                    </TableCell>
                    <TableCell>
                      <BadgeStatus status={o.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular">
                      {brl(o.total)}
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
