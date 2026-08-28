"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { adicionarItem, historicoPreco, removerItem, type EstadoOrcamento } from "../_actions";
import { Button } from "@/components/ui/button";
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
import { AlertCircle, History, Loader2, Plus, Trash2 } from "lucide-react";
import { brl, dataBR, parseValor, qtd } from "@/lib/format";
import { UNIDADES, type HistoricoPreco, type ItemOrcamento, type Servico } from "@/lib/types";

export function EditorItens({
  orcamentoId,
  clienteId,
  servicos,
  itens,
  podeEditar,
}: {
  orcamentoId: string;
  clienteId: string;
  servicos: Servico[];
  itens: ItemOrcamento[];
  podeEditar: boolean;
}) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Itens do orçamento ({itens.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {itens.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum item ainda. Adicione o primeiro abaixo.
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
                    {podeEditar && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="max-w-md">
                        <p className="font-medium">{i.descricao}</p>
                        <Especificacoes specs={i.especificacoes} />
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
                      {podeEditar && (
                        <TableCell>
                          <form action={removerItem}>
                            <input type="hidden" name="id" value={i.id} />
                            <input
                              type="hidden"
                              name="orcamento_id"
                              value={orcamentoId}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              aria-label="Remover item"
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </form>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {podeEditar && (
        <FormularioItem
          orcamentoId={orcamentoId}
          clienteId={clienteId}
          servicos={servicos}
        />
      )}
    </div>
  );
}

function Especificacoes({
  specs,
}: {
  specs: Record<string, string> | null;
}) {
  const partes = Object.entries(specs ?? {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  if (partes.length === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">{partes.join(" · ")}</p>
  );
}

function FormularioItem({
  orcamentoId,
  clienteId,
  servicos,
}: {
  orcamentoId: string;
  clienteId: string;
  servicos: Servico[];
}) {
  const [servicoId, setServicoId] = useState("");
  const [descricao, setDescricao] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [preco, setPreco] = useState("");
  const [historico, setHistorico] = useState<HistoricoPreco[]>([]);
  const [buscando, iniciarBusca] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Limpa o formulário depois de gravar, dentro da própria ação.
  const [estado, acao, enviando] = useActionState<EstadoOrcamento, FormData>(
    async (anterior, dados) => {
      const resultado = await adicionarItem(anterior, dados);
      if (resultado.ok) {
        formRef.current?.reset();
        setServicoId("");
        setDescricao("");
        setQuantidade("1");
        setPreco("");
        setHistorico([]);
      }
      return resultado;
    },
    {},
  );

  const servico = servicos.find((s) => s.id === servicoId);
  const subtotal = parseValor(quantidade) * parseValor(preco);

  function escolherServico(id: string) {
    setServicoId(id);
    setHistorico([]);

    const s = servicos.find((x) => x.id === id);
    if (s) {
      setDescricao(
        s.descricao_padrao ? `${s.nome} — ${s.descricao_padrao}` : s.nome,
      );
      setPreco(String(s.preco_base ?? ""));
    } else {
      setDescricao("");
      setPreco("");
    }

    // RF-11: os últimos 5 preços cobrados deste serviço para este cliente
    if (id) {
      iniciarBusca(async () => {
        setHistorico(await historicoPreco(clienteId, id));
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adicionar item</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={acao} className="grid gap-5">
          <input type="hidden" name="orcamento_id" value={orcamentoId} />
          <input type="hidden" name="servico_id" value={servicoId} />

          <div className="grid gap-2">
            <Label htmlFor="servico">Serviço</Label>
            <select
              id="servico"
              value={servicoId}
              onChange={(e) => escolherServico(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">Outro serviço (descrição livre)</option>
              {servicos.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome} · {brl(s.preco_base)}/{UNIDADES[s.unidade] ?? s.unidade}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição / especificação *</Label>
            <Textarea
              id="descricao"
              name="descricao"
              rows={2}
              required
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Banner 2x1m em lona 440g, 4x0, bastão e cordão"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <CampoSpec nome="material" rotulo="Material" />
            <CampoSpec nome="tamanho" rotulo="Tamanho" />
            <CampoSpec nome="cores" rotulo="Cores" />
            <CampoSpec nome="acabamento" rotulo="Acabamento" />
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <div className="grid gap-2">
              <Label htmlFor="quantidade">
                Quantidade{servico ? ` (${UNIDADES[servico.unidade]})` : ""}
              </Label>
              <Input
                id="quantidade"
                name="quantidade"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="preco_unitario">Preço unitário (R$)</Label>
              <Input
                id="preco_unitario"
                name="preco_unitario"
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="grid gap-2">
              <Label>Subtotal</Label>
              <div className="flex h-9 items-center justify-end rounded-md border bg-muted px-3 text-sm font-semibold tabular">
                {brl(subtotal)}
              </div>
            </div>
          </div>

          <HistoricoDePreco
            historico={historico}
            buscando={buscando}
            mostrar={Boolean(servicoId)}
            aoUsar={setPreco}
          />

          {estado.erro && (
            <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="size-4 shrink-0" />
              {estado.erro}
            </p>
          )}

          <div>
            <Button type="submit" disabled={enviando}>
              {enviando ? <Loader2 className="animate-spin" /> : <Plus />}
              Adicionar item
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function CampoSpec({ nome, rotulo }: { nome: string; rotulo: string }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={nome} className="text-xs text-muted-foreground">
        {rotulo}
      </Label>
      <Input id={nome} name={nome} className="h-8 text-sm" />
    </div>
  );
}

/** RF-11 e RF-12 — o histórico ao lado do preço, com "usar este preço". */
function HistoricoDePreco({
  historico,
  buscando,
  mostrar,
  aoUsar,
}: {
  historico: HistoricoPreco[];
  buscando: boolean;
  mostrar: boolean;
  aoUsar: (valor: string) => void;
}) {
  if (!mostrar) return null;

  return (
    <div className="rounded-lg border border-[#cfe3aa] bg-[#f4faea] p-3">
      <p className="flex items-center gap-2 text-sm font-medium text-[#3f5a15]">
        <History className="size-4" />
        Histórico deste cliente
        {buscando && <Loader2 className="size-3.5 animate-spin" />}
      </p>

      {!buscando && historico.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Primeira vez que este serviço é cobrado deste cliente.
        </p>
      )}

      {historico.length > 0 && (
        <ul className="mt-2 divide-y divide-[#dcebc4]">
          {historico.map((h) => (
            <li
              key={h.pedido_id + h.data + h.preco_unitario}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-sm"
            >
              <span className="tabular text-muted-foreground">
                {dataBR(h.data)}
              </span>
              <span className="tabular text-muted-foreground">
                {qtd(h.quantidade)} un
              </span>
              <span className="font-semibold tabular">
                {brl(h.preco_unitario)}
              </span>
              <button
                type="button"
                onClick={() => aoUsar(String(h.preco_unitario))}
                className="ml-auto rounded-md border border-[#8cc63e] px-2 py-0.5 text-xs font-medium text-[#3f5a15] transition-colors hover:bg-[#8cc63e] hover:text-[#1b2410]"
              >
                Usar este preço
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
