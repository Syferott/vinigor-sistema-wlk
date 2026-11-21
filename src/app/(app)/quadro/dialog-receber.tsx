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
import { CamposFaturado } from "@/components/campos-faturado";
import { Loader2, Wallet } from "lucide-react";
import { brl, hojeSP, parseValor } from "@/lib/format";
import { FORMAS_RECEBIMENTO, type MeioFaturado } from "@/lib/types";
import type { CardPedido } from "@/lib/types";

export type RecebimentoCard = {
  valor: number;
  forma: string;
  meio: MeioFaturado;
  data: string;
};

/**
 * O mesmo recebimento da conclusão, sem mover o card. Faturado entra
 * como opção porque aqui não se promete quitar.
 */
export function DialogReceber({
  card,
  aoFechar,
  aoConfirmar,
}: {
  card: CardPedido | null;
  aoFechar: () => void;
  aoConfirmar: (recebimento: RecebimentoCard) => void | Promise<void>;
}) {
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState("pix");
  const [meio, setMeio] = useState<MeioFaturado>("boleto");
  const [data, setData] = useState(hojeSP());
  const [enviando, setEnviando] = useState(false);

  const [ultimo, setUltimo] = useState(card);
  if (ultimo !== card) {
    setUltimo(card);
    setValor(card ? Number(card.saldo_devedor).toFixed(2) : "");
    setForma("pix");
    setMeio("boleto");
    setData(hojeSP());
    setEnviando(false);
  }

  const recebido = parseValor(valor);
  const faturado = forma === "faturado";
  const saldo = card ? Number(card.saldo_devedor) : 0;
  const restante = Math.round((saldo - (faturado ? 0 : recebido)) * 100) / 100;

  function fechar() {
    if (enviando) return;
    aoFechar();
  }

  return (
    <Dialog
      open={Boolean(card)}
      onOpenChange={(aberto) => {
        if (!aberto) fechar();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            {card && (
              <>
                Pedido <strong>{card.numero}</strong>, de{" "}
                {card.nome_avulso?.trim() || card.cliente_nome}. Em aberto:{" "}
                <strong>{brl(saldo)}</strong>. O card não muda de coluna.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="valor-card">
              {faturado ? "Valor faturado (R$)" : "Valor recebido (R$)"}
            </Label>
            <Input
              id="valor-card"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              inputMode="decimal"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="forma-card">Forma</Label>
            <select
              id="forma-card"
              value={forma}
              onChange={(e) => setForma(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {Object.entries(FORMAS_RECEBIMENTO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <CamposFaturado
            forma={forma}
            meio={meio}
            data={data}
            aoMudarMeio={setMeio}
            aoMudarData={setData}
          />

          {!faturado && restante > 0 && recebido > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Depois deste lançamento ainda faltam <strong>{brl(restante)}</strong>.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={enviando} onClick={fechar}>
            Cancelar
          </Button>
          <Button
            disabled={enviando || recebido <= 0 || (faturado && !data)}
            onClick={async () => {
              setEnviando(true);
              await aoConfirmar({ valor: recebido, forma, meio, data });
              setEnviando(false);
            }}
          >
            {enviando ? <Loader2 className="animate-spin" /> : <Wallet />}
            {faturado ? `Faturar ${brl(recebido)}` : `Receber ${brl(recebido)}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
