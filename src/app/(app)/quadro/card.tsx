"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, Phone, User, Wallet } from "lucide-react";
import { BadgeBalcao, BadgeFinanceiro } from "@/components/badges";
import { Button } from "@/components/ui/button";
import { brl, dataBR, diasAte, telefoneBR } from "@/lib/format";
import { MEIO_FATURADO } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { CardPedido } from "@/lib/types";

/** RF-20: prazo vencido -> borda vermelha; até 2 dias -> borda amarela. */
function bordaPorPrazo(card: CardPedido) {
  if (card.entregue_em) return "border-border";
  const dias = diasAte(card.prazo_entrega);
  if (dias === null) return "border-border";
  if (dias < 0) return "border-red-500";
  if (dias <= 2) return "border-amber-400";
  return "border-border";
}

export function nomeNoCard(card: CardPedido): string {
  return card.nome_avulso?.trim() || card.cliente_nome;
}

export function telefoneNoCard(card: CardPedido): string | null {
  return card.telefone_avulso?.trim() || card.cliente_telefone;
}

export function CardQuadro({
  card,
  sobreposicao,
  aoReceber,
}: {
  card: CardPedido;
  sobreposicao?: boolean;
  aoReceber?: (card: CardPedido) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: sobreposicao });

  const dias = diasAte(card.prazo_entrega);
  const atrasado = !card.entregue_em && dias !== null && dias < 0;
  const nome = nomeNoCard(card);
  const telefone = telefoneNoCard(card);
  const saldo = Number(card.saldo_devedor);

  return (
    <article
      ref={sobreposicao ? undefined : setNodeRef}
      style={
        sobreposicao
          ? undefined
          : { transform: CSS.Translate.toString(transform), transition }
      }
      className={cn(
        "group rounded-lg border-l-4 border bg-card p-2.5 shadow-xs",
        bordaPorPrazo(card),
        isDragging && "opacity-40",
        sobreposicao && "rotate-1 shadow-lg",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          className="-ml-1 cursor-grab touch-none rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          aria-label={`Mover pedido ${card.numero}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/pedidos/${card.id}`}
              className="text-xs font-semibold tabular text-muted-foreground hover:underline"
            >
              {card.numero}
            </Link>
            {!card.orcamento_id && (
              <BadgeBalcao className="px-1.5 py-0 text-[10px]" />
            )}
          </div>
          <p className="truncate text-sm font-medium">{nome}</p>
          {card.nome_avulso?.trim() && (
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              sem cadastro
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Phone className="size-3 shrink-0" />
            <span className="tabular">
              {telefone ? telefoneBR(telefone) : "sem telefone"}
            </span>
          </p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {card.resumo}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 tabular",
            atrasado ? "font-medium text-red-600" : "text-muted-foreground",
          )}
        >
          <CalendarClock className="size-3.5" />
          {dataBR(card.prazo_entrega)}
          {atrasado && ` (${Math.abs(dias!)}d)`}
        </span>
      </div>

      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-muted-foreground">Cobrado</dt>
        <dd className="text-right font-semibold tabular">{brl(card.valor_total)}</dd>
        <dt className="text-muted-foreground">Resta</dt>
        <dd
          className={cn(
            "text-right font-semibold tabular",
            saldo > 0 ? "text-red-700" : "text-[#3f5a15]",
          )}
        >
          {brl(saldo)}
        </dd>
      </dl>

      {card.faturamento && (
        <p className="mt-1.5 text-[11px] font-medium text-sky-800">
          Faturado · {MEIO_FATURADO[card.faturamento.meio]} ·{" "}
          {dataBR(card.faturamento.data)}
        </p>
      )}

      <div className="mt-2 flex items-center gap-2">
        <BadgeFinanceiro situacao={card.situacao} className="text-[11px]" />
        {card.responsavel_nome && (
          <span className="ml-auto inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            {card.responsavel_nome.split(" ")[0]}
          </span>
        )}
      </div>

      {aoReceber && saldo > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 w-full text-xs"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => aoReceber(card)}
        >
          <Wallet className="size-3.5" /> Receber
        </Button>
      )}
    </article>
  );
}
