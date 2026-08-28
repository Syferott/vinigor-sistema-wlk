import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { BadgeFinanceiro, BadgeStatus } from "@/components/badges";
import { BotaoLink } from "@/components/botao-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  brl,
  dataBR,
  documentoBR,
  linkWhatsapp,
  telefoneBR,
} from "@/lib/format";
import { FilePlus2, MessageCircle, Pencil } from "lucide-react";
import type {
  Cliente,
  Orcamento,
  PedidoFinanceiro,
  SituacaoFinanceira,
} from "@/lib/types";

export const metadata = { title: "Ficha do cliente" };

type PedidoLinha = {
  id: string;
  numero: string;
  prazo_entrega: string | null;
  valor_total: number;
  created_at: string;
  colunas: { nome: string; is_final: boolean } | null;
};

export default async function FichaCliente({
  params,
}: PageProps<"/clientes/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: cliente }, { data: orcamentos }, { data: pedidos }, { data: financeiro }] =
    await Promise.all([
      supabase.from("clientes").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("orcamentos")
        .select("id, numero, status, data_orcamento, validade, total, versao")
        .eq("cliente_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("pedidos")
        .select(
          "id, numero, prazo_entrega, valor_total, created_at, colunas(nome, is_final)",
        )
        .eq("cliente_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("vw_pedido_financeiro")
        .select("pedido_id, valor_total, total_pago, saldo_devedor, situacao")
        .eq("cliente_id", id),
    ]);

  if (!cliente) notFound();
  const c = cliente as Cliente;

  const fin = (financeiro ?? []) as PedidoFinanceiro[];
  const porPedido = new Map(fin.map((f) => [f.pedido_id, f]));

  const totalFaturado = fin.reduce((s, f) => s + Number(f.valor_total), 0);
  const totalPago = fin.reduce((s, f) => s + Number(f.total_pago), 0);
  const saldoAberto = fin.reduce((s, f) => s + Number(f.saldo_devedor), 0);

  const wa = linkWhatsapp(c.telefone);
  const listaOrcamentos = (orcamentos ?? []) as Orcamento[];
  const listaPedidos = (pedidos ?? []) as unknown as PedidoLinha[];

  return (
    <>
      <CabecalhoPagina titulo={c.nome} descricao={c.tipo === "PJ" ? "Pessoa jurídica" : "Pessoa física"}>
        {wa && (
          <BotaoLink variant="outline" href={wa}>
            <MessageCircle /> WhatsApp
          </BotaoLink>
        )}
        <BotaoLink variant="outline" href={`/clientes/${c.id}/editar`}>
          <Pencil /> Editar
        </BotaoLink>
        <BotaoLink href={`/orcamentos/novo?cliente=${c.id}`}>
          <FilePlus2 /> Novo orçamento
        </BotaoLink>
      </CabecalhoPagina>

      <Conteudo className="grid gap-6">
        {/* Situação financeira do cliente (RF-03) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador rotulo="Total faturado" valor={brl(totalFaturado)} />
          <Indicador rotulo="Total pago" valor={brl(totalPago)} />
          <Indicador
            rotulo="Saldo em aberto"
            valor={brl(saldoAberto)}
            destaque={saldoAberto > 0}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">Dados cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <Campo rotulo="Documento" valor={documentoBR(c.documento)} />
              <Campo rotulo="Telefone" valor={telefoneBR(c.telefone)} />
              <Campo rotulo="E-mail" valor={c.email ?? "—"} />
              <Campo rotulo="Endereço" valor={c.endereco ?? "—"} />
              <Campo rotulo="Cliente desde" valor={dataBR(c.created_at)} />
              {c.observacoes && (
                <div>
                  <p className="text-xs text-muted-foreground">Observações</p>
                  <p className="whitespace-pre-wrap">{c.observacoes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="orcamentos">
            <TabsList>
              <TabsTrigger value="orcamentos">
                Orçamentos ({listaOrcamentos.length})
              </TabsTrigger>
              <TabsTrigger value="pedidos">
                Pedidos ({listaPedidos.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orcamentos" className="mt-4">
              {listaOrcamentos.length === 0 ? (
                <EstadoVazio
                  titulo="Nenhum orçamento"
                  descricao="Quando você orçar para este cliente, o histórico de preços aparece aqui."
                />
              ) : (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Validade
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listaOrcamentos.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium tabular">
                            <Link
                              href={`/orcamentos/${o.id}`}
                              className="hover:underline"
                            >
                              {o.numero}
                            </Link>
                          </TableCell>
                          <TableCell className="tabular">
                            {dataBR(o.data_orcamento)}
                          </TableCell>
                          <TableCell className="hidden tabular sm:table-cell">
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
            </TabsContent>

            <TabsContent value="pedidos" className="mt-4">
              {listaPedidos.length === 0 ? (
                <EstadoVazio titulo="Nenhum pedido" />
              ) : (
                <div className="overflow-hidden rounded-xl border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="hidden sm:table-cell">
                          Prazo
                        </TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listaPedidos.map((p) => {
                        const f = porPedido.get(p.id);
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium tabular">
                              <Link
                                href={`/pedidos/${p.id}`}
                                className="hover:underline"
                              >
                                {p.numero}
                              </Link>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {p.colunas?.nome ?? "—"}
                            </TableCell>
                            <TableCell className="hidden tabular sm:table-cell">
                              {dataBR(p.prazo_entrega)}
                            </TableCell>
                            <TableCell>
                              <BadgeFinanceiro
                                situacao={
                                  (f?.situacao ?? "sem_pagamento") as SituacaoFinanceira
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium tabular">
                              {brl(p.valor_total)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
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
          className={`mt-1 text-2xl font-semibold tabular ${
            destaque ? "text-red-700" : ""
          }`}
        >
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="tabular">{valor}</p>
    </div>
  );
}
