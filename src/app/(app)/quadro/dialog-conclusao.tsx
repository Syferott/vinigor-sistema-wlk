"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wallet } from "lucide-react";
import { brl, parseValor } from "@/lib/format";
import { FORMAS_PAGAMENTO } from "@/lib/types";
import type { PedidoEmAberto } from "./dialog-entrega";

/**
 * Concluir exige saldo zero, e o banco recusa quem tentar. Recusar e
 * mandar o usuário procurar a ficha do pedido para lançar o pagamento é
 * jogar trabalho por cima do erro — o que falta é dinheiro, e o dinheiro
 * se registra aqui mesmo, com o valor já preenchido.
 */
export function DialogConclusaoComSaldo({
  pendente,
  aoFechar,
  aoConfirmar,
}: {
  pendente: { card: PedidoEmAberto; saldo: number } | null;
  aoFechar: () => void;
  aoConfirmar: (valor: number, forma: string) => void | Promise<void>;
}) {
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("dinheiro");
  const [enviando, setEnviando] = useState(false);

  // Abriu: já entra com o que falta, que é o caso normal — recebeu tudo.
  // Ajuste durante o render, como no quadro: num efeito, o diálogo
  // chegaria a pintar o valor do pedido anterior antes de corrigir.
  const [ultimoPendente, setUltimoPendente] = useState(pendente);
  if (ultimoPendente !== pendente) {
    setUltimoPendente(pendente);
    setValor(pendente ? pendente.saldo.toFixed(2) : "");
    setEnviando(false);
  }

  const recebido = parseValor(valor);
  const restante = pendente
    ? Math.round((pendente.saldo - recebido) * 100) / 100
    : 0;

  function fechar() {
    setValor("");
    setForma("dinheiro");
    aoFechar();
  }

  return (
    <Dialog
      open={Boolean(pendente)}
      onOpenChange={(aberto) => {
        if (!aberto && !enviando) fechar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Falta receber para concluir</DialogTitle>
          <DialogDescription>
            {pendente && (
              <>
                O pedido <strong>{pendente.card.numero}</strong>, de{" "}
                {pendente.card.cliente_nome}, ainda tem{" "}
                <strong>{brl(pendente.saldo)}</strong> em aberto. Registre o
                recebimento e a venda é concluída na sequência.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="valor-recebido">Valor recebido (R$)</Label>
            <Input
              id="valor-recebido"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="forma-recebimento">Forma</Label>
            <select
              id="forma-recebimento"
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {restante > 0 && recebido > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Sobram <strong>{brl(restante)}</strong>. O pagamento entra, mas a
              venda continua em aberto — o card volta para onde estava.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={enviando} onClick={fechar}>
            Cancelar
          </Button>
          <Button
            disabled={enviando || recebido <= 0}
            onClick={async () => {
              setEnviando(true);
              await aoConfirmar(recebido, forma);
            }}
          >
            {enviando ? <Loader2 className="animate-spin" /> : <Wallet />}
            Receber {brl(recebido)} e concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
