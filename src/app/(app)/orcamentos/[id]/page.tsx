import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { BadgeStatus } from "@/components/badges";
import { EditorItens } from "./editor-itens";
import { AcoesOrcamento } from "./acoes";
import { atualizarCabecalho } from "../_actions";
import { Button } from "@/components/ui/button";
import { BotaoLink } from "@/components/botao-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowLeft, ExternalLink, Lock, Printer } from "lucide-react";
import { brl, dataBR, diasAte } from "@/lib/format";
import type {
  Cliente,
  ItemOrcamento,
  Orcamento,
  Profile,
  Servico,
} from "@/lib/types";

export const metadata = { title: "Orçamento" };

export default async function PaginaOrcamento({
  params,
  searchParams,
}: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const { erro } = await searchParams;
  await requerAuth();
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .from("orcamentos")
    .select("*, clientes(id, nome, telefone, documento)")
    .eq("id", id)
    .maybeSingle();

  if (!orcamento) notFound();

  const o = orcamento as unknown as Orcamento & { clientes: Cliente };

  const [{ data: itens }, { data: servicos }, { data: responsaveis }, { data: pedido }] =
    await Promise.all([
      supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", id)
        .order("ordem"),
      supabase
        .from("servicos")
        .select("*")
        .is("deleted_at", null)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("profiles")
        .select("id, nome, email, role, ativo, senha_provisoria, created_at")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("pedidos")
        .select("id, numero")
        .eq("orcamento_id", id)
        .maybeSingle(),
    ]);

  const listaItens = (itens ?? []) as ItemOrcamento[];
  const aprovado = o.status === "aprovado";
  const podeEditar = !aprovado;
  const diasValidade = diasAte(o.validade);

  return (
    <>
      <CabecalhoPagina
        titulo={o.numero}
        descricao={`${o.clientes.nome} · emitido em ${dataBR(o.data_orcamento)}`}
      >
        <BadgeStatus status={o.status} />
        <BotaoLink variant="ghost" size="icon"  aria-label="Voltar" href="/orcamentos">
          <ArrowLeft />
        </BotaoLink>
      </CabecalhoPagina>

      <Conteudo className="grid gap-6">
        {typeof erro === "string" && (
          <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="size-4 shrink-0" />
            {decodeURIComponent(erro)}
          </p>
        )}

        {aprovado && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#cfe3aa] bg-[#f4faea] p-3 text-sm text-[#3f5a15]">
            <Lock className="size-4" />
            <span>
              Orçamento aprovado — imutável para preservar o histórico. Para
              mudar algo, gere uma nova versão.
            </span>
            {pedido && (
              <BotaoLink
                variant="outline"
                size="sm"
                className="ml-auto"
                href={`/pedidos/${pedido.id}`}
              >
                Ver pedido {pedido.numero} <ExternalLink />
              </BotaoLink>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <EditorItens
              orcamentoId={o.id}
              clienteId={o.cliente_id}
              servicos={(servicos ?? []) as Servico[]}
              itens={listaItens}
              podeEditar={podeEditar}
            />
          </div>

          <div className="grid h-fit gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Totais</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2 text-sm">
                <Linha rotulo="Subtotal" valor={brl(o.subtotal)} />
                <Linha
                  rotulo={
                    o.desconto_tipo === "percentual"
                      ? `Desconto (${o.desconto_valor}%)`
                      : "Desconto"
                  }
                  valor={`− ${brl(
                    o.desconto_tipo === "percentual"
                      ? (Number(o.subtotal) * Number(o.desconto_valor)) / 100
                      : o.desconto_valor,
                  )}`}
                />
                <div className="mt-2 flex items-baseline justify-between border-t pt-3">
                  <span className="font-medium">Total</span>
                  <span className="text-2xl font-semibold tabular">
                    {brl(o.total)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Condições</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={atualizarCabecalho} className="grid gap-4">
                  <input type="hidden" name="id" value={o.id} />

                  <div className="grid gap-2">
                    <Label htmlFor="validade">
                      Validade
                      {diasValidade !== null && !aprovado && (
                        <span
                          className={`ml-2 text-xs font-normal ${
                            diasValidade < 0
                              ? "text-red-600"
                              : "text-muted-foreground"
                          }`}
                        >
                          {diasValidade < 0
                            ? `vencido há ${Math.abs(diasValidade)} d`
                            : `faltam ${diasValidade} d`}
                        </span>
                      )}
                    </Label>
                    <Input
                      id="validade"
                      name="validade"
                      type="date"
                      defaultValue={o.validade}
                      disabled={aprovado}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="prazo_producao_dias">
                      Prazo de produção (dias)
                    </Label>
                    <Input
                      id="prazo_producao_dias"
                      name="prazo_producao_dias"
                      type="number"
                      min={0}
                      defaultValue={o.prazo_producao_dias ?? ""}
                      disabled={aprovado}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="desconto_tipo">Desconto</Label>
                      <select
                        id="desconto_tipo"
                        name="desconto_tipo"
                        defaultValue={o.desconto_tipo}
                        disabled={aprovado}
                        className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      >
                        <option value="valor">R$</option>
                        <option value="percentual">%</option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="desconto_valor">Valor</Label>
                      <Input
                        id="desconto_valor"
                        name="desconto_valor"
                        inputMode="decimal"
                        defaultValue={o.desconto_valor}
                        disabled={aprovado}
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      name="observacoes"
                      rows={3}
                      defaultValue={o.observacoes ?? ""}
                      disabled={aprovado}
                    />
                  </div>

                  {!aprovado && (
                    <Button type="submit" variant="outline">
                      Salvar condições
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>

            <AcoesOrcamento
              orcamentoId={o.id}
              status={o.status}
              temItens={listaItens.length > 0}
              prazoProducaoDias={o.prazo_producao_dias}
              responsaveis={(responsaveis ?? []) as Profile[]}
            />

            <BotaoLink
              variant="ghost"
              href={`/orcamentos/${o.id}/imprimir`}
              novaAba
            >
              <Printer /> Versão para impressão
            </BotaoLink>
          </div>
        </div>
      </Conteudo>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="tabular">{valor}</span>
    </div>
  );
}
