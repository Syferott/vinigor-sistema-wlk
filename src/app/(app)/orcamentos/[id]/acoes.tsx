"use client";

import { useState } from "react";
import { aprovarOrcamento, mudarStatus, novaVersao } from "../_actions";
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
import { CheckCircle2, Copy, Send, XCircle } from "lucide-react";
import { hojeSP, somaDias } from "@/lib/format";
import type { Profile, StatusOrcamento } from "@/lib/types";

export function AcoesOrcamento({
  orcamentoId,
  status,
  temItens,
  prazoProducaoDias,
  responsaveis,
}: {
  orcamentoId: string;
  status: StatusOrcamento;
  temItens: boolean;
  prazoProducaoDias: number | null;
  responsaveis: Profile[];
}) {
  const [recusando, setRecusando] = useState(false);

  if (status === "aprovado") {
    return (
      <form action={novaVersao}>
        <input type="hidden" name="id" value={orcamentoId} />
        <Button type="submit" variant="outline">
          <Copy /> Gerar nova versão
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "enviado" && (
        <form action={mudarStatus}>
          <input type="hidden" name="id" value={orcamentoId} />
          <input type="hidden" name="status" value="enviado" />
          <Button type="submit" variant="outline" disabled={!temItens}>
            <Send /> Marcar como enviado
          </Button>
        </form>
      )}

      <Dialog open={recusando} onOpenChange={setRecusando}>
        <DialogTrigger render={<Button variant="outline" />}>
          <XCircle /> Recusado
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <form action={mudarStatus} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Marcar como recusado</DialogTitle>
              <DialogDescription>
                O orçamento continua no histórico do cliente.
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="id" value={orcamentoId} />
            <input type="hidden" name="status" value="recusado" />
            <div className="grid gap-2">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Textarea
                id="motivo"
                name="motivo"
                rows={2}
                placeholder="Ex.: fechou com o concorrente por preço"
              />
            </div>
            <DialogFooter>
              <Button type="submit" variant="destructive">
                Confirmar recusa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger render={<Button disabled={!temItens} />}>
          <CheckCircle2 /> Aprovar orçamento
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <form action={aprovarOrcamento} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Aprovar e mandar para o quadro</DialogTitle>
              <DialogDescription>
                Vira um pedido na coluna “Aprovado”, com os itens e preços
                congelados. Depois disso o orçamento não pode mais ser alterado.
              </DialogDescription>
            </DialogHeader>

            <input type="hidden" name="id" value={orcamentoId} />

            <div className="grid gap-2">
              <Label htmlFor="prazo_entrega">Prazo de entrega</Label>
              <Input
                id="prazo_entrega"
                name="prazo_entrega"
                type="date"
                defaultValue={somaDias(hojeSP(), prazoProducaoDias ?? 5)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="responsavel_id">Responsável</Label>
              <select
                id="responsavel_id"
                name="responsavel_id"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Sem responsável definido</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter>
              <Button type="submit">Aprovar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
