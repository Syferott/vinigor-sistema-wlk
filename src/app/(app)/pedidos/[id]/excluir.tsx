"use client";

import { useActionState } from "react";
import { excluirPedido, type ResultadoExclusao } from "../_actions";
import { Button } from "@/components/ui/button";
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
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { brl } from "@/lib/format";

/**
 * Só aparece para o dono. O operador tem a coluna Cancelado, que é o
 * caminho normal para um pedido que não vai acontecer — excluir é para
 * lançamento errado ou dado de teste.
 */
export function DialogExcluirPedido({
  pedidoId,
  numero,
  clienteNome,
  totalPago,
}: {
  pedidoId: string;
  numero: string;
  clienteNome: string;
  totalPago: number;
}) {
  const [estado, acao, enviando] = useActionState<ResultadoExclusao, FormData>(
    excluirPedido,
    {},
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="w-full justify-start text-red-700 hover:bg-red-50 hover:text-red-800"
          />
        }
      >
        <Trash2 /> Excluir pedido
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Excluir {numero}?</DialogTitle>
            <DialogDescription>
              O pedido de {clienteNome} sai do quadro, da ficha do cliente e
              dos relatórios.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={pedidoId} />

          {totalPago > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Atenção: este pedido tem <strong>{brl(totalPago)}</strong> já
              recebido. Excluindo, esse valor sai do faturamento do período.
            </p>
          )}

          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Nada é apagado do banco: o registro continua guardado com quem
            excluiu, quando e o motivo. Se for só um pedido que não vai
            acontecer, prefira mover o card para <strong>Cancelado</strong> —
            ele fica visível no histórico do cliente.
          </p>

          <div className="grid gap-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              name="motivo"
              rows={3}
              required
              placeholder="Ex.: lançado por engano, duplicado do PED-2026-0007"
            />
          </div>

          {estado.erro && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Excluir pedido
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
