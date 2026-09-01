"use client";

import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarClock, GripVertical, User } from "lucide-react";
import { BadgeBalcao, BadgeFinanceiro } from "@/components/badges";
import { brl, dataBR, diasAte } from "@/lib/format";
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

export function CardQuadro({
  card,
  sobreposicao,
}: {
  card: CardPedido;
  sobreposicao?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, disabled: sobreposicao });

  const dias = diasAte(card.prazo_entrega);
  const atrasado = !card.entregue_em && dias !== null && dias < 0;

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
          <p className="truncate text-sm font-medium">{card.cliente_nome}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {card.resumo}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
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

        <span className="ml-auto font-semibold tabular">
          {brl(card.valor_total)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <BadgeFinanceiro situacao={card.situacao} className="text-[11px]" />
        {card.responsavel_nome && (
          <span className="ml-auto inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
            <User className="size-3.5 shrink-0" />
            {card.responsavel_nome.split(" ")[0]}
          </span>
        )}
      </div>
    </article>
  );
}
