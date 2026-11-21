"use client";

import { useActionState, useState } from "react";
import { salvarItensPedido, type EstadoItens } from "@/app/(app)/pedidos/_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { brl, parseValor, round2, totalComDesconto } from "@/lib/format";
import { UNIDADES, type ItemOrcamento, type Servico } from "@/lib/types";

type Linha = {
  chave: string;
  id: string | null;
  servico_id: string | null;
  descricao: string;
  quantidade: string;
  preco: string;
  especificacoes: Record<string, string> | null;
};

const seletor =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function linhasIniciais(itens: ItemOrcamento[]): Linha[] {
  return itens.map((i) => ({
    chave: i.id,
    id: i.id,
    servico_id: i.servico_id,
    descricao: i.descricao,
    quantidade: String(i.quantidade),
    preco: String(i.preco_unitario),
    especificacoes: i.especificacoes,
  }));
}

/**
 * Itens do pedido em produção — balcão ou orçamento já aprovado.
 * O total da tela acompanha a conta; o saldo só muda ao salvar.
 */
export function EditorItensPedido({
  pedidoId,
  itens,
  servicos,
  desconto,
  totalPago,
  titulo = "Itens do pedido",
}: {
  pedidoId: string;
  itens: ItemOrcamento[];
  servicos: Servico[];
  desconto: { tipo: string; valor: number } | null;
  totalPago: number;
  titulo?: string;
}) {
  const [estado, acao, enviando] = useActionState<EstadoItens, FormData>(
    salvarItensPedido,
    {},
  );
  const [linhas, setLinhas] = useState<Linha[]>(() => linhasIniciais(itens));
  const [servicoId, setServicoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");

  const subtotal = linhas.reduce(
    (s, l) => s + round2(parseValor(l.quantidade) * parseValor(l.preco)),
    0,
  );
  const total = totalComDesconto(subtotal, desconto);
  const restante = round2(total - totalPago);

  const payload = linhas.map((l) => ({
    id: l.id,
    servico_id: l.servico_id,
    descricao: l.descricao,
    quantidade: parseValor(l.quantidade),
    preco_unitario: parseValor(l.preco),
    especificacoes: l.especificacoes ?? {},
  }));

  function escolherServico(id: string) {
    setServicoId(id);
    const s = servicos.find((x) => x.id === id);
    if (s) {
      setDescricao(s.nome);
      setPreco(String(s.preco_base ?? ""));
    }
  }

  function adicionar() {
    const q = parseValor(quantidade);
    if (!descricao.trim() || q <= 0) return;
    setLinhas((atual) => [
      ...atual,
      {
        chave: crypto.randomUUID(),
        id: null,
        servico_id: servicoId || null,
        descricao: descricao.trim(),
        quantidade: String(q),
        preco: String(parseValor(preco)),
        especificacoes: {},
      },
    ]);
    setServicoId("");
    setDescricao("");
    setQuantidade("1");
    setPreco("");
  }

  function alterar(chave: string, campo: "descricao" | "quantidade" | "preco", valor: string) {
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {titulo} ({linhas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form action={acao} className="grid gap-4">
          <input type="hidden" name="pedido_id" value={pedidoId} />
          <input type="hidden" name="itens" value={JSON.stringify(payload)} />

          {linhas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Nenhum item. Inclua pelo menos um antes de salvar.
            </p>
          ) : (
            <div className="grid gap-3">
              {linhas.map((l) => (
                <div
                  key={l.chave}
                  className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_5rem_7rem_auto] sm:items-end"
                >
                  <div className="grid gap-1">
                    <Label htmlFor={`desc-${l.chave}`}>Descrição</Label>
                    <Input
                      id={`desc-${l.chave}`}
                      value={l.descricao}
                      onChange={(e) => alterar(l.chave, "descricao", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`qtd-${l.chave}`}>Qtd.</Label>
                    <Input
                      id={`qtd-${l.chave}`}
                      value={l.quantidade}
                      inputMode="decimal"
                      onChange={(e) => alterar(l.chave, "quantidade", e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor={`preco-${l.chave}`}>Unitário</Label>
                    <Input
                      id={`preco-${l.chave}`}
                      value={l.preco}
                      inputMode="decimal"
                      onChange={(e) => alterar(l.chave, "preco", e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${l.descricao}`}
                    onClick={() =>
                      setLinhas((atual) => atual.filter((x) => x.chave !== l.chave))
                    }
                  >
                    <Trash2 className="size-4 text-red-600" />
                  </Button>
                  <p className="text-xs text-muted-foreground sm:col-span-4 tabular">
                    Linha: {brl(parseValor(l.quantidade) * parseValor(l.preco))}
                  </p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 rounded-lg bg-muted/40 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div className="grid gap-1">
              <Label htmlFor="novo-servico">Incluir item</Label>
              <select
                id="novo-servico"
                value={servicoId}
                onChange={(e) => escolherServico(e.target.value)}
                className={seletor}
              >
                <option value="">Item avulso</option>
                {servicos.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nome} · {brl(s.preco_base)}/{UNIDADES[s.unidade] ?? s.unidade}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <Label htmlFor="novo-qtd">Qtd.</Label>
              <Input
                id="novo-qtd"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                inputMode="decimal"
                className="sm:w-20"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="novo-preco">Unitário</Label>
              <Input
                id="novo-preco"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="sm:w-28"
              />
            </div>
            <Button type="button" variant="outline" onClick={adicionar}>
              <Plus /> Adicionar
            </Button>
            {!servicoId && (
              <div className="grid gap-1 sm:col-span-4">
                <Label htmlFor="novo-desc">Descrição do item avulso</Label>
                <Input
                  id="novo-desc"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex.: mais 500 cartões"
                />
              </div>
            )}
          </div>

          <div className="grid gap-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular">{brl(subtotal)}</span>
            </div>
            {desconto && Number(desconto.valor) > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Desconto do orçamento{" "}
                  {desconto.tipo === "percentual" ? `(${desconto.valor}%)` : ""}
                </span>
                <span className="tabular">− {brl(subtotal - total)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total do pedido</span>
              <span className="tabular">{brl(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Já recebido</span>
              <span className="tabular">{brl(totalPago)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-medium">Resta</span>
              <span
                className={`font-semibold tabular ${
                  restante > 0 ? "text-red-700" : "text-[#3f5a15]"
                }`}
              >
                {restante < 0
                  ? `${brl(Math.abs(restante))} de crédito`
                  : brl(restante)}
              </span>
            </div>
          </div>

          {estado.erro && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}
          {estado.aviso && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">
              {estado.aviso}
            </p>
          )}
          {estado.ok && !estado.aviso && (
            <p className="rounded-md bg-[#f4faea] p-3 text-sm text-[#3f5a15]">
              Itens salvos. Total e saldo foram recalculados.
            </p>
          )}

          <Button type="submit" disabled={enviando || linhas.length === 0}>
            {enviando && <Loader2 className="animate-spin" />}
            Salvar itens e recalcular
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
