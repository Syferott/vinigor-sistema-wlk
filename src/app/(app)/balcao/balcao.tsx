"use client";

import { useActionState, useState, useTransition } from "react";
import { consumidorFinal, finalizarVenda, type EstadoVenda } from "./_actions";
import {
  SeletorCliente,
  type ClienteOpcao,
} from "@/components/seletor-cliente";
import { DialogClienteRapido } from "@/components/dialog-cliente-rapido";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Loader2, Plus, Trash2, UserRound } from "lucide-react";
import { brl, parseValor } from "@/lib/format";
import { FORMAS_PAGAMENTO, UNIDADES, type Servico } from "@/lib/types";

type ItemCarrinho = {
  chave: string;
  servico_id: string | null;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
};

const seletor =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function Balcao({
  clientes,
  servicos,
}: {
  clientes: ClienteOpcao[];
  servicos: Servico[];
}) {
  const [estado, acao, enviando] = useActionState<EstadoVenda, FormData>(
    finalizarVenda,
    {},
  );

  const [lista, setLista] = useState(clientes);
  const [cliente, setCliente] = useState<ClienteOpcao | undefined>();
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [buscandoGenerico, iniciarGenerico] = useTransition();

  // linha de entrada
  const [servicoId, setServicoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");

  const [entregaImediata, setEntregaImediata] = useState(true);
  const [fiado, setFiado] = useState(false);
  const [combinado, setCombinado] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [valorPago, setValorPago] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const total = itens.reduce(
    (s, i) => s + Math.round(i.quantidade * i.preco_unitario * 100) / 100,
    0,
  );

  function escolherServico(id: string) {
    setServicoId(id);
    const s = servicos.find((x) => x.id === id);
    if (s) {
      setDescricao(s.nome);
      setPreco(String(s.preco_base ?? ""));
    } else {
      setDescricao("");
      setPreco("");
    }
  }

  function adicionar() {
    const q = parseValor(quantidade);
    const p = parseValor(preco);
    if (!descricao.trim() || q <= 0) return;

    setItens((atual) => [
      ...atual,
      {
        chave: crypto.randomUUID(),
        servico_id: servicoId || null,
        descricao: descricao.trim(),
        quantidade: q,
        preco_unitario: p,
      },
    ]);

    setServicoId("");
    setDescricao("");
    setQuantidade("1");
    setPreco("");
  }

  // Entrega na hora exige o total recebido — é a regra RF-29, que o
  // banco cobra de qualquer jeito. Aqui só adiantamos o preenchimento.
  // No fiado a conta é outra: o valor fica em aberto de propósito, então
  // nada de completar sozinho.
  const pagamentoSugerido =
    valorPago || (entregaImediata && !fiado ? total.toFixed(2) : "");
  // Marcar fiado e receber o valor cheio deixa de ser fiado: sem saldo,
  // nada a registrar como exceção.
  const restante = Math.round((total - parseValor(valorPago)) * 100) / 100;
  const entregaFiado = entregaImediata && fiado && restante > 0;
  const faltaCombinado = entregaFiado && combinado.trim().length < 3;

  return (
    <form action={acao} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="cliente_id" value={cliente?.id ?? ""} />
      <input type="hidden" name="itens" value={JSON.stringify(itens)} />
      <input
        type="hidden"
        name="entrega_imediata"
        value={entregaImediata ? "1" : "0"}
      />
      <input type="hidden" name="pagamento_valor" value={pagamentoSugerido} />
      <input type="hidden" name="pagamento_forma" value={formaPagamento} />
      <input
        type="hidden"
        name="entrega_fiado"
        value={entregaFiado ? "1" : "0"}
      />
      <input
        type="hidden"
        name="fiado_justificativa"
        value={entregaFiado ? combinado : ""}
      />

      <div className="grid min-w-0 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <SeletorCliente
              clientes={lista}
              selecionado={cliente?.id}
              aoSelecionar={setCliente}
              acao={
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={buscandoGenerico}
                    onClick={() =>
                      iniciarGenerico(async () => {
                        const c = await consumidorFinal();
                        if (!c) return;
                        setLista((a) =>
                          a.some((x) => x.id === c.id) ? a : [c, ...a],
                        );
                        setCliente(c);
                      })
                    }
                  >
                    {buscandoGenerico ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <UserRound />
                    )}
                    Consumidor final
                  </Button>
                  <DialogClienteRapido
                    aoCriar={(c) => {
                      setLista((a) => [c, ...a]);
                      setCliente(c);
                    }}
                  />
                </div>
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Itens da venda</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
              <div className="grid gap-2">
                <Label htmlFor="servico">Produto / serviço</Label>
                <select
                  id="servico"
                  value={servicoId}
                  onChange={(e) => escolherServico(e.target.value)}
                  className={seletor}
                >
                  <option value="">Item avulso (digite a descrição)</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} · {brl(s.preco_base)}/
                      {UNIDADES[s.unidade] ?? s.unidade}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="qtd">Qtd.</Label>
                <Input
                  id="qtd"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  inputMode="decimal"
                  className="sm:w-20"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="preco">Unitário</Label>
                <Input
                  id="preco"
                  value={preco}
                  onChange={(e) => setPreco(e.target.value)}
                  inputMode="decimal"
                  placeholder="0,00"
                  className="sm:w-28"
                />
              </div>

              <Button type="button" onClick={adicionar}>
                <Plus /> Adicionar
              </Button>
            </div>

            {!servicoId && (
              <div className="grid gap-2">
                <Label htmlFor="descricao-avulsa">Descrição do item avulso</Label>
                <Input
                  id="descricao-avulsa"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: Impressão A4 colorida"
                />
              </div>
            )}

            {itens.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum item ainda.
              </p>
            ) : (
              <div className="overflow-x-auto scroll-fino">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Unitário</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((i) => (
                      <TableRow key={i.chave}>
                        <TableCell className="font-medium">
                          {i.descricao}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {i.quantidade}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {brl(i.preco_unitario)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular">
                          {brl(i.quantidade * i.preco_unitario)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Remover ${i.descricao}`}
                            onClick={() =>
                              setItens((a) =>
                                a.filter((x) => x.chave !== i.chave),
                              )
                            }
                          >
                            <Trash2 className="size-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid h-fit gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Total da venda
            </p>
            <p className="mt-1 text-3xl font-semibold tabular">{brl(total)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {itens.length} {itens.length === 1 ? "item" : "itens"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={entregaImediata}
                onCheckedChange={(v) => setEntregaImediata(v === true)}
                className="mt-0.5"
              />
              <span>
                Entrega agora
                <span className="block text-xs text-muted-foreground">
                  Vai direto para Entregue. Desmarque se for para produção.
                </span>
              </span>
            </label>

            {entregaImediata && (
              <div className="grid gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={fiado}
                    onCheckedChange={(v) => setFiado(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Leva agora e paga depois
                    <span className="block text-xs text-muted-foreground">
                      O que faltar fica em Contas a receber, no nome do
                      cliente, com o combinado registrado no pedido.
                    </span>
                  </span>
                </label>

                {fiado && (
                  <div className="grid gap-2">
                    <Label htmlFor="combinado">Combinado com o cliente *</Label>
                    <Input
                      id="combinado"
                      value={combinado}
                      onChange={(e) => setCombinado(e.target.value)}
                      placeholder="Ex.: paga sexta no PIX"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="forma">Forma</Label>
              <select
                id="forma"
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className={seletor}
              >
                {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pago">Valor recebido (R$)</Label>
              <Input
                id="pago"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                inputMode="decimal"
                placeholder={total > 0 ? total.toFixed(2) : "0,00"}
              />
              <p className="text-xs text-muted-foreground">
                {entregaFiado
                  ? "Em branco, não entra pagamento nenhum. Preencha se o cliente adiantou uma parte."
                  : "Em branco, entra o total. Deixe menor para registrar sinal — aí não dá para entregar na hora."}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            {estado.erro && (
              <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {estado.erro}
              </p>
            )}

            <Button
              type="submit"
              disabled={
                enviando || itens.length === 0 || !cliente || faltaCombinado
              }
              className="w-full"
            >
              {enviando && <Loader2 className="animate-spin" />}
              {entregaFiado
                ? `Entregar fiado · ${brl(restante)}`
                : `Finalizar venda · ${brl(total)}`}
            </Button>

            {faltaCombinado && (
              <p className="text-center text-xs text-muted-foreground">
                Escreva o combinado para registrar a venda fiado.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
