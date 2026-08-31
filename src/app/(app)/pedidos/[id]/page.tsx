import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { BadgeFinanceiro } from "@/components/badges";
import { DialogPagamento } from "./pagamentos";
import { SeletorEtapa } from "./etapa";
import { atualizarPedido, estornarPagamento, repetirPedido } from "../_actions";
import { Button } from "@/components/ui/button";
import { BotaoLink } from "@/components/botao-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Copy,
  ExternalLink,
  Undo2,
} from "lucide-react";
import { brl, dataBR, dataHoraBR, qtd } from "@/lib/format";
import {
  FORMAS_PAGAMENTO,
  TIPOS_PAGAMENTO,
  type ItemOrcamento,
  type Coluna,
  type Pagamento,
  type PedidoFinanceiro,
  type Profile,
} from "@/lib/types";

export const metadata = { title: "Pedido" };

type Evento = {
  id: string;
  created_at: string;
  observacao: string | null;
  origem: { nome: string } | null;
  destino: { nome: string } | null;
  profiles: { nome: string } | null;
};

export default async function PaginaPedido({
  params,
  searchParams,
}: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const { erro } = await searchParams;
  const perfil = await requerAuth();
  const supabase = await createClient();

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      `*, clientes(id, nome, telefone), colunas(nome, cor, is_final),
       responsavel:profiles!pedidos_responsavel_id_fkey(nome)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!pedido) notFound();

  const [
    { data: itens },
    { data: pagamentos },
    { data: financeiro },
    { data: eventos },
    { data: equipe },
    { data: config },
    { data: colunas },
  ] = await Promise.all([
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("ordem"),
    supabase
      .from("pagamentos")
      .select("*, recebedor:profiles!pagamentos_recebido_por_fkey(nome)")
      .eq("pedido_id", id)
      .is("deleted_at", null)
      .order("data_pagamento", { ascending: false }),
    supabase
      .from("vw_pedido_financeiro")
      .select("*")
      .eq("pedido_id", id)
      .maybeSingle(),
    supabase
      .from("pedido_eventos")
      .select(
        `id, created_at, observacao,
         origem:colunas!pedido_eventos_coluna_origem_id_fkey(nome),
         destino:colunas!pedido_eventos_coluna_destino_id_fkey(nome),
         profiles(nome)`,
      )
      .eq("pedido_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, nome, email, role, ativo, senha_provisoria, created_at")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("configuracoes")
      .select("valor")
      .eq("chave", "sinal_percentual_padrao")
      .maybeSingle(),
    supabase.from("colunas").select("*").eq("ativo", true).order("ordem"),
  ]);

  const p = pedido as Record<string, unknown> & {
    id: string;
    numero: string;
    valor_total: number;
    prazo_entrega: string | null;
    responsavel_id: string | null;
    observacoes: string | null;
    orcamento_id: string | null;
    coluna_id: string;
    entregue_em: string | null;
    entregue_com_saldo: boolean;
    justificativa_saldo: string | null;
    clientes: { id: string; nome: string } | null;
    colunas: { nome: string; cor: string; is_final: boolean } | null;
  };

  const fin = (financeiro ?? {
    valor_total: p.valor_total,
    total_pago: 0,
    saldo_devedor: p.valor_total,
    situacao: "sem_pagamento",
  }) as PedidoFinanceiro;

  const listaPagamentos = (pagamentos ?? []) as unknown as (Pagamento & {
    recebedor: { nome: string } | null;
  })[];

  return (
    <>
      <CabecalhoPagina
        titulo={p.numero}
        descricao={p.clientes?.nome ?? undefined}
      >
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${p.colunas?.cor ?? "#8cc63e"}22`,
            color: "#3f5a15",
          }}
        >
          {p.colunas?.nome}
        </span>
        <BotaoLink variant="ghost" size="icon"  aria-label="Voltar ao quadro" href="/quadro">
          <ArrowLeft />
        </BotaoLink>
      </CabecalhoPagina>

      <Conteudo className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 gap-6">
          {typeof erro === "string" && (
            <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="size-4 shrink-0" />
              {decodeURIComponent(erro)}
            </p>
          )}

          {p.entregue_com_saldo && p.justificativa_saldo && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Entregue com saldo em aberto.</strong>{" "}
              {p.justificativa_saldo}
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Itens (cópia congelada do orçamento)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto scroll-fino">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Unitário</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {((itens ?? []) as ItemOrcamento[]).map((i) => {
                      const specs = Object.entries(i.especificacoes ?? {})
                        .filter(([, v]) => v)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" · ");
                      return (
                        <TableRow key={i.id}>
                          <TableCell className="max-w-md">
                            <p className="font-medium">{i.descricao}</p>
                            {specs && (
                              <p className="text-xs text-muted-foreground">
                                {specs}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {qtd(i.quantidade)}
                          </TableCell>
                          <TableCell className="text-right tabular">
                            {brl(i.preco_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular">
                            {brl(i.total)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pagamentos ({listaPagamentos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {listaPagamentos.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhum pagamento registrado.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Forma
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Recebido por
                      </TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaPagamentos.map((g) => (
                      <TableRow key={g.id}>
                        <TableCell className="tabular">
                          {dataBR(g.data_pagamento)}
                        </TableCell>
                        <TableCell>{TIPOS_PAGAMENTO[g.tipo]}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {FORMAS_PAGAMENTO[g.forma]}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {g.recebedor?.nome ?? "—"}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular">
                          {brl(g.valor)}
                        </TableCell>
                        <TableCell>
                          <form action={estornarPagamento}>
                            <input type="hidden" name="id" value={g.id} />
                            <input type="hidden" name="pedido_id" value={p.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              aria-label="Estornar pagamento"
                              title="Estornar (exclusão lógica)"
                            >
                              <Undo2 className="size-4 text-muted-foreground" />
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* RF-22: linha do tempo da movimentação */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Linha do tempo</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-3">
                {((eventos ?? []) as unknown as Evento[]).map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="tabular text-xs text-muted-foreground">
                      {dataHoraBR(e.created_at)}
                    </span>
                    {e.origem ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {e.origem.nome}
                        </span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{e.destino?.nome}</span>
                      </span>
                    ) : (
                      <span className="font-medium">
                        Pedido criado em {e.destino?.nome}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      por {e.profiles?.nome ?? "sistema"}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="grid h-fit gap-4">
          {/* Mover sem arrastar — é assim que o card anda no celular. */}
          <SeletorEtapa
            pedido={{
              id: p.id,
              numero: p.numero,
              cliente_nome: p.clientes?.nome ?? "—",
              saldo_devedor: Number(fin.saldo_devedor),
            }}
            colunas={(colunas ?? []) as Coluna[]}
            colunaAtualId={p.coluna_id}
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Financeiro</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Valor total</span>
                <span className="tabular">{brl(fin.valor_total)}</span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Total pago</span>
                <span className="tabular">{brl(fin.total_pago)}</span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-medium">Saldo devedor</span>
                <span
                  className={`text-xl font-semibold tabular ${
                    Number(fin.saldo_devedor) > 0 ? "text-red-700" : ""
                  }`}
                >
                  {brl(fin.saldo_devedor)}
                </span>
              </div>
              <BadgeFinanceiro situacao={fin.situacao} />

              <DialogPagamento
                pedidoId={p.id}
                saldoDevedor={Number(fin.saldo_devedor)}
                valorTotal={Number(fin.valor_total)}
                primeiroPagamento={listaPagamentos.length === 0}
                sinalPercentual={Number(config?.valor ?? 50) || 50}
                equipe={(equipe ?? []) as Profile[]}
                usuarioAtual={perfil.id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Produção</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={atualizarPedido} className="grid gap-4">
                <input type="hidden" name="id" value={p.id} />

                <div className="grid gap-2">
                  <Label htmlFor="prazo_entrega">Prazo de entrega</Label>
                  <Input
                    id="prazo_entrega"
                    name="prazo_entrega"
                    type="date"
                    defaultValue={p.prazo_entrega ?? ""}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="responsavel_id">Responsável</Label>
                  <select
                    id="responsavel_id"
                    name="responsavel_id"
                    defaultValue={p.responsavel_id ?? ""}
                    className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Sem responsável</option>
                    {((equipe ?? []) as Profile[]).map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    name="observacoes"
                    rows={3}
                    defaultValue={p.observacoes ?? ""}
                  />
                </div>

                <Button type="submit" variant="outline">
                  Salvar
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-2">
            {p.clientes && (
              <BotaoLink
                variant="ghost"
                className="justify-start"
                href={`/clientes/${p.clientes.id}`}
              >
                Ficha do cliente <ExternalLink />
              </BotaoLink>
            )}
            {p.orcamento_id && (
              <BotaoLink
                variant="ghost"
                className="justify-start"
                href={`/orcamentos/${p.orcamento_id}`}
              >
                Orçamento de origem <ExternalLink />
              </BotaoLink>
            )}
            <form action={repetirPedido}>
              <input type="hidden" name="pedido_id" value={p.id} />
              <Button
                type="submit"
                variant="outline"
                className="w-full justify-start"
              >
                <Copy /> Repetir este trabalho
              </Button>
            </form>
          </div>
        </div>
      </Conteudo>
    </>
  );
}
