"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { moverPedidoParaColuna } from "@/app/(app)/quadro/_actions";
import {
  DialogEntregaComSaldo,
  type PedidoEmAberto,
} from "@/app/(app)/quadro/dialog-entrega";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import type { Coluna } from "@/lib/types";

/**
 * Mudar a etapa sem arrastar. No balcão o sistema é usado no celular, onde
 * drag and drop entre colunas é ruim — aqui a mesma operação vira um toque.
 * A regra de entrega com saldo (RF-29) é a mesma do quadro: quem barra é o
 * trigger no banco, e a exceção continua exigindo justificativa.
 */
export function SeletorEtapa({
  pedido,
  colunas,
  colunaAtualId,
}: {
  pedido: PedidoEmAberto & { id: string };
  colunas: Coluna[];
  colunaAtualId: string;
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [destino, setDestino] = useState(colunaAtualId);
  const [pendente, setPendente] = useState<{ card: PedidoEmAberto } | null>(null);
  const [colunaPendente, setColunaPendente] = useState<string | null>(null);

  const ordenadas = [...colunas].sort((a, b) => a.ordem - b.ordem);
  const atual = ordenadas.find((c) => c.id === colunaAtualId);

  const emFluxo = ordenadas.filter((c) => !c.is_cancelado);
  const indiceAtual = emFluxo.findIndex((c) => c.id === colunaAtualId);
  const proxima =
    indiceAtual >= 0 && indiceAtual < emFluxo.length - 1
      ? emFluxo[indiceAtual + 1]
      : null;

  function mover(colunaId: string, justificativa?: string) {
    if (colunaId === colunaAtualId) return;

    iniciar(async () => {
      const r = await moverPedidoParaColuna({
        pedidoId: pedido.id,
        colunaId,
        justificativa,
      });

      if (r.ok) {
        const nome = ordenadas.find((c) => c.id === colunaId)?.nome ?? "";
        toast.success(`Pedido movido para “${nome}”.`);
        setPendente(null);
        setColunaPendente(null);
        router.refresh();
        return;
      }

      if (r.exigeJustificativa) {
        setColunaPendente(colunaId);
        setPendente({ card: pedido });
      } else {
        toast.error(r.erro);
        setDestino(colunaAtualId);
      }
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Etapa</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Agora está em</p>
            <span
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
              style={{
                backgroundColor: `${atual?.cor ?? "#8cc63e"}22`,
                color: "#3f5a15",
              }}
            >
              {atual?.nome ?? "—"}
            </span>
          </div>

          {proxima ? (
            <Button
              className="w-full"
              disabled={enviando}
              onClick={() => mover(proxima.id)}
            >
              {enviando ? (
                <Loader2 className="animate-spin" />
              ) : (
                <ArrowRight />
              )}
              Avançar para {proxima.nome}
            </Button>
          ) : (
            <p className="rounded-md bg-muted p-2 text-center text-sm text-muted-foreground">
              {atual?.is_final
                ? "Pedido entregue — fim do fluxo."
                : "Sem próxima etapa."}
            </p>
          )}

          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="etapa">Ou mover direto para</Label>
            <div className="flex gap-2">
              <select
                id="etapa"
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                disabled={enviando}
                className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {ordenadas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                    {c.id === colunaAtualId ? " (atual)" : ""}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                disabled={enviando || destino === colunaAtualId}
                onClick={() => mover(destino)}
              >
                <Check /> Mover
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              A movimentação fica registrada na linha do tempo, com quem moveu e
              quando.
            </p>
          </div>
        </CardContent>
      </Card>

      <DialogEntregaComSaldo
        pendente={pendente}
        aoFechar={() => {
          setPendente(null);
          setColunaPendente(null);
          setDestino(colunaAtualId);
        }}
        aoConfirmar={(justificativa) => {
          if (colunaPendente) mover(colunaPendente, justificativa);
        }}
      />
    </>
  );
}
