"use client";

import { useActionState } from "react";
import { excluirOrcamento, type ResultadoExclusao } from "../_actions";
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

/**
 * Só aparece para o dono. O operador tem o status Recusado, que é o
 * caminho normal para um orçamento que não vai fechar — excluir é para
 * lançamento errado, duplicado ou dado de teste.
 */
export function DialogExcluirOrcamento({
  orcamentoId,
  numero,
  clienteNome,
  pedidoNumero,
}: {
  orcamentoId: string;
  numero: string;
  clienteNome: string;
  pedidoNumero?: string;
}) {
  const [estado, acao, enviando] = useActionState<ResultadoExclusao, FormData>(
    excluirOrcamento,
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
        <Trash2 /> Excluir orçamento
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Excluir {numero}?</DialogTitle>
            <DialogDescription>
              O orçamento de {clienteNome} sai da lista e da ficha do cliente.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={orcamentoId} />

          {pedidoNumero ? (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Este orçamento virou o pedido <strong>{pedidoNumero}</strong>.
              Exclua o pedido primeiro — senão ele fica no quadro sem origem.
            </p>
          ) : (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Nada é apagado do banco: o registro continua guardado com quem
              excluiu, quando e o motivo. Se o cliente só não fechou, prefira
              marcar como <strong>Recusado</strong> — assim ele continua no
              histórico.
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="motivo">Motivo *</Label>
            <Textarea
              id="motivo"
              name="motivo"
              rows={3}
              required
              placeholder="Ex.: lançado por engano, duplicado do ORC-2026-0007"
            />
          </div>

          {estado.erro && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={enviando || Boolean(pedidoNumero)}
            >
              {enviando && <Loader2 className="animate-spin" />}
              Excluir orçamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
