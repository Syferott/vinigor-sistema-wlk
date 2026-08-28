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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/format";

/** O suficiente para explicar ao usuário o que está em aberto. */
export type PedidoEmAberto = {
  numero: string;
  cliente_nome: string;
  saldo_devedor: number;
};

/**
 * RF-29 — entregar com saldo em aberto é exceção, não é o caminho normal:
 * exige confirmação explícita e justificativa, que ficam registradas.
 */
export function DialogEntregaComSaldo({
  pendente,
  aoFechar,
  aoConfirmar,
}: {
  pendente: { card: PedidoEmAberto } | null;
  aoFechar: () => void;
  aoConfirmar: (justificativa: string) => void | Promise<void>;
}) {
  const [justificativa, setJustificativa] = useState("");

  return (
    <Dialog
      open={Boolean(pendente)}
      onOpenChange={(aberto) => {
        if (!aberto) {
          setJustificativa("");
          aoFechar();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Entregar com saldo em aberto?</DialogTitle>
          <DialogDescription>
            {pendente && (
              <>
                O pedido <strong>{pendente.card.numero}</strong> ainda tem{" "}
                <strong>{brl(pendente.card.saldo_devedor)}</strong> a receber de{" "}
                {pendente.card.cliente_nome}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor="justificativa">Justificativa *</Label>
          <Textarea
            id="justificativa"
            rows={3}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: cliente antigo, combinado pagar no boleto em 5 dias"
          />
          <p className="text-xs text-muted-foreground">
            Fica registrado no pedido e no log de auditoria.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setJustificativa("");
              aoFechar();
            }}
          >
            Cancelar
          </Button>
          <Button
            disabled={justificativa.trim().length < 3}
            onClick={() => {
              const texto = justificativa.trim();
              setJustificativa("");
              void aoConfirmar(texto);
            }}
          >
            Confirmar entrega
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
