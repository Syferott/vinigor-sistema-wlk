import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { BadgeFinanceiro } from "@/components/badges";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dataBR, linkWhatsapp, telefoneBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import type { SituacaoFinanceira } from "@/lib/types";

export const metadata = { title: "Contas a receber" };

type Linha = {
  pedido_id: string;
  numero: string;
  cliente_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  prazo_entrega: string | null;
  valor_total: number;
  total_pago: number;
  saldo_devedor: number;
  situacao: SituacaoFinanceira;
  coluna_nome: string;
  entregue: boolean;
  dias_de_atraso: number | null;
};

export default async function PaginaFinanceiro() {
  await requerDono();
  const supabase = await createClient();

  // A view carrega is_dono() no WHERE: para o operador ela volta vazia.
  const { data } = await supabase
    .from("vw_contas_receber")
    .select("*")
    .order("prazo_entrega", { ascending: true, nullsFirst: false });

  const linhas = (data ?? []) as Linha[];
  const total = linhas.reduce((s, l) => s + Number(l.saldo_devedor), 0);
  const entregues = linhas.filter((l) => l.entregue);
  const totalEntregues = entregues.reduce(
    (s, l) => s + Number(l.saldo_devedor),
    0,
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a receber"
        descricao="Pedidos com saldo em aberto, do prazo mais próximo ao mais distante."
      />

      <Conteudo className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador rotulo="Total a receber" valor={brl(total)} destaque />
          <Indicador rotulo="Pedidos em aberto" valor={String(linhas.length)} />
          <Indicador
            rotulo="Já entregue e não pago"
            valor={brl(totalEntregues)}
            destaque={totalEntregues > 0}
          />
        </div>

        {linhas.length === 0 ? (
          <EstadoVazio
            titulo="Nada a receber"
            descricao="Todos os pedidos estão quitados."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden md:table-cell">Etapa</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Situação
                  </TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => {
                  const atrasado =
                    l.dias_de_atraso !== null && l.dias_de_atraso > 0;
                  const wa = linkWhatsapp(l.cliente_telefone);
                  return (
                    <TableRow key={l.pedido_id}>
                      <TableCell className="font-medium tabular">
                        <Link
                          href={`/pedidos/${l.pedido_id}`}
                          className="hover:underline"
                        >
                          {l.numero}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <Link
                          href={`/clientes/${l.cliente_id}`}
                          className="block truncate hover:underline"
                        >
                          {l.cliente_nome}
                        </Link>
                        {l.cliente_telefone && (
                          <span className="text-xs text-muted-foreground tabular">
                            {telefoneBR(l.cliente_telefone)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {l.coluna_nome}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "tabular",
                          atrasado && "font-medium text-red-600",
                        )}
                      >
                        {dataBR(l.prazo_entrega)}
                        {atrasado && (
                          <span className="block text-xs">
                            {l.dias_de_atraso}d de atraso
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <BadgeFinanceiro situacao={l.situacao} />
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular text-red-700">
                        {brl(l.saldo_devedor)}
                      </TableCell>
                      <TableCell>
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex text-muted-foreground hover:text-[#5b8f1f]"
                            aria-label={`Cobrar ${l.cliente_nome} no WhatsApp`}
                          >
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Conteudo>
    </>
  );
}

function Indicador({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular",
            destaque && "text-red-700",
          )}
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}
