"use client";

import { useActionState, useState } from "react";
import { registrarPagamento, type EstadoPagamento } from "../_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Wallet } from "lucide-react";
import { brl, hojeSP } from "@/lib/format";
import { FORMAS_PAGAMENTO, TIPOS_PAGAMENTO, type Profile } from "@/lib/types";

const seletor =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function DialogPagamento({
  pedidoId,
  saldoDevedor,
  valorTotal,
  primeiroPagamento,
  sinalPercentual,
  equipe,
  usuarioAtual,
}: {
  pedidoId: string;
  saldoDevedor: number;
  valorTotal: number;
  primeiroPagamento: boolean;
  sinalPercentual: number;
  equipe: Profile[];
  usuarioAtual: string;
}) {
  const [aberto, setAberto] = useState(false);

  const [estado, acao, enviando] = useActionState<EstadoPagamento, FormData>(
    async (anterior, dados) => {
      const resultado = await registrarPagamento(anterior, dados);
      if (resultado.ok) setAberto(false);
      return resultado;
    },
    {},
  );

  // RF-30: no primeiro pagamento sugere o sinal (padrão 50%), editável.
  const sugerido = primeiroPagamento
    ? Math.min(
        Math.round(((valorTotal * sinalPercentual) / 100) * 100) / 100,
        saldoDevedor,
      )
    : saldoDevedor;

  const [valor, setValor] = useState(String(sugerido.toFixed(2)));

  return (
    <Dialog
      open={aberto}
      onOpenChange={(proximo) => {
        // Ao abrir, o valor volta para o sugerido (sinal ou saldo restante).
        if (proximo) setValor(String(sugerido.toFixed(2)));
        setAberto(proximo);
      }}
    >
      <DialogTrigger render={<Button disabled={saldoDevedor <= 0} />}>
        <Wallet />
        {saldoDevedor <= 0 ? "Pedido quitado" : "Registrar pagamento"}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Saldo devedor atual: <strong>{brl(saldoDevedor)}</strong>
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="pedido_id" value={pedidoId} />

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                name="valor"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                required
              />
              {primeiroPagamento && (
                <p className="text-xs text-muted-foreground">
                  Sinal sugerido: {sinalPercentual}%
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="data_pagamento">Data</Label>
              <Input
                id="data_pagamento"
                name="data_pagamento"
                type="date"
                defaultValue={hojeSP()}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tipo">Tipo</Label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={primeiroPagamento ? "sinal" : "quitacao"}
                className={seletor}
              >
                {Object.entries(TIPOS_PAGAMENTO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="forma">Forma</Label>
              <select
                id="forma"
                name="forma"
                defaultValue="pix"
                className={seletor}
              >
                {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="recebido_por">Recebido por</Label>
            <select
              id="recebido_por"
              name="recebido_por"
              defaultValue={usuarioAtual}
              className={seletor}
            >
              {equipe.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea id="observacao" name="observacao" rows={2} />
          </div>

          {estado.erro && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-800">
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
