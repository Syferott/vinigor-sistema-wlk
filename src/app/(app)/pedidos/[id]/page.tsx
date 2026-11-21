import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { BadgeFinanceiro } from "@/components/badges";
import { DialogPagamento } from "./pagamentos";
import { EditorItensPedido } from "@/components/editor-itens-pedido";
import { SeletorEtapa } from "./etapa";
import { DialogExcluirPedido } from "./excluir";
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
  Printer,
} from "lucide-react";
import { brl, dataBR, dataHoraBR, telefoneBR } from "@/lib/format";
import {
  FORMAS_RECEBIMENTO,
  MEIO_FATURADO,
  TIPOS_PAGAMENTO,
  type ItemOrcamento,
  type Coluna,
  type Pagamento,
  type PedidoFinanceiro,
  type Profile,
  type Servico,
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
    { data: servicos },
    { data: orcamento },
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
    supabase
      .from("servicos")
      .select("*")
      .is("deleted_at", null)
      .eq("ativo", true)
      .order("nome"),
    pedido.orcamento_id
      ? supabase
          .from("orcamentos")
          .select("desconto_tipo, desconto_valor")
          .eq("id", pedido.orcamento_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
    nome_avulso: string | null;
    telefone_avulso: string | null;
    clientes: { id: string; nome: string; telefone: string | null } | null;
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
  const listaItens = (itens ?? []) as ItemOrcamento[];
  const desconto = orcamento
    ? {
        tipo: (orcamento as { desconto_tipo: string }).desconto_tipo,
        valor: Number((orcamento as { desconto_valor: number }).desconto_valor),
      }
    : null;
  const nomeExibido = p.nome_avulso?.trim() || p.clientes?.nome;
  const telefoneExibido = p.telefone_avulso?.trim() || p.clientes?.telefone;
  const faturados = listaPagamentos.filter((g) => g.forma === "faturado");

  return (
    <>
      <CabecalhoPagina
        titulo={p.numero}
        descricao={
          nomeExibido
            ? `${nomeExibido}${telefoneExibido ? ` · ${telefoneBR(telefoneExibido)}` : ""}${
                p.nome_avulso?.trim() ? " · sem cadastro" : ""
              }`
            : undefined
        }
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

          <EditorItensPedido
            key={listaItens.map((i) => `${i.id}:${i.total}`).join("|")}
            pedidoId={p.id}
            itens={listaItens}
            servicos={(servicos ?? []) as Servico[]}
            desconto={desconto}
            totalPago={Number(fin.total_pago)}
            titulo={
              p.orcamento_id
                ? "Itens do pedido (o cliente pode aumentar na produção)"
                : "Itens da venda de balcão"
            }
          />

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
                          {FORMAS_RECEBIMENTO[g.forma] ?? g.forma}
                          {g.forma === "faturado" && g.agendado_para && (
                            <span className="block text-xs text-sky-800">
                              {g.agendado_meio
                                ? MEIO_FATURADO[g.agendado_meio]
                                : "Faturado"}{" "}
                              · {dataBR(g.agendado_para)}
                              {" · não entrou no caixa"}
                            </span>
                          )}
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

              {faturados.length > 0 && (
                <ul className="grid gap-1 text-xs text-sky-900">
                  {faturados.map((g) => (
                    <li key={g.id}>
                      Faturado{" "}
                      {g.agendado_meio ? MEIO_FATURADO[g.agendado_meio] : ""} ·{" "}
                      {dataBR(g.agendado_para)} · {brl(g.valor)}
                    </li>
                  ))}
                </ul>
              )}

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
            <BotaoLink
              variant="ghost"
              className="justify-start"
              href={`/pedidos/${p.id}/recibo`}
              novaAba
            >
              <Printer /> Recibo para o cliente
            </BotaoLink>

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

            {perfil.role === "dono" && (
              <DialogExcluirPedido
                pedidoId={p.id}
                numero={p.numero}
                clienteNome={p.clientes?.nome ?? "—"}
                totalPago={Number(fin.total_pago)}
              />
            )}
          </div>
        </div>
      </Conteudo>
    </>
  );
}
