"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { diasAte } from "@/lib/format";
import { X } from "lucide-react";
import type { CardPedido, Profile } from "@/lib/types";

export type Filtros = {
  cliente: string;
  responsavel: string;
  prazo: "" | "atrasados" | "hoje" | "semana";
  pagamento: "" | "pago" | "parcial" | "sem_pagamento";
};

export const filtroVazio: Filtros = {
  cliente: "",
  responsavel: "",
  prazo: "",
  pagamento: "",
};

/** RF-21 — filtros do topo do quadro. */
export function aplicarFiltros(cards: CardPedido[], f: Filtros): CardPedido[] {
  const termo = f.cliente.trim().toLowerCase();

  return cards.filter((c) => {
    if (termo && !c.cliente_nome.toLowerCase().includes(termo)) return false;

    if (f.responsavel) {
      if (f.responsavel === "sem" && c.responsavel_id) return false;
      if (f.responsavel !== "sem" && c.responsavel_id !== f.responsavel)
        return false;
    }

    if (f.pagamento && c.situacao !== f.pagamento) return false;

    if (f.prazo) {
      const dias = diasAte(c.prazo_entrega);
      if (dias === null) return false;
      if (f.prazo === "atrasados" && dias >= 0) return false;
      if (f.prazo === "hoje" && dias !== 0) return false;
      if (f.prazo === "semana" && (dias < 0 || dias > 7)) return false;
    }

    return true;
  });
}

const seletor =
  "h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function FiltrosQuadro({
  cards,
  equipe,
  filtros,
  aoMudar,
}: {
  cards: CardPedido[];
  equipe: Profile[];
  filtros: Filtros;
  aoMudar: (f: Filtros) => void;
}) {
  const ativos = useMemo(
    () => Object.values(filtros).some(Boolean),
    [filtros],
  );

  const contagem = useMemo(() => {
    const atrasados = cards.filter((c) => {
      const d = diasAte(c.prazo_entrega);
      return d !== null && d < 0 && !c.entregue_em;
    }).length;
    return { atrasados };
  }, [cards]);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-card px-4 py-3 sm:px-6">
      <Input
        value={filtros.cliente}
        onChange={(e) => aoMudar({ ...filtros, cliente: e.target.value })}
        placeholder="Filtrar por cliente…"
        className="h-9 w-full sm:w-56"
        aria-label="Filtrar por cliente"
      />

      <select
        className={seletor}
        value={filtros.responsavel}
        onChange={(e) => aoMudar({ ...filtros, responsavel: e.target.value })}
        aria-label="Filtrar por responsável"
      >
        <option value="">Todos os responsáveis</option>
        <option value="sem">Sem responsável</option>
        {equipe.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nome}
          </option>
        ))}
      </select>

      <select
        className={seletor}
        value={filtros.prazo}
        onChange={(e) =>
          aoMudar({ ...filtros, prazo: e.target.value as Filtros["prazo"] })
        }
        aria-label="Filtrar por prazo"
      >
        <option value="">Qualquer prazo</option>
        <option value="atrasados">
          Atrasados{contagem.atrasados ? ` (${contagem.atrasados})` : ""}
        </option>
        <option value="hoje">Entrega hoje</option>
        <option value="semana">Próximos 7 dias</option>
      </select>

      <select
        className={seletor}
        value={filtros.pagamento}
        onChange={(e) =>
          aoMudar({
            ...filtros,
            pagamento: e.target.value as Filtros["pagamento"],
          })
        }
        aria-label="Filtrar por situação de pagamento"
      >
        <option value="">Qualquer pagamento</option>
        <option value="pago">🟢 Pago</option>
        <option value="parcial">🟡 Sinal pago</option>
        <option value="sem_pagamento">🔴 Sem pagamento</option>
      </select>

      {ativos && (
        <Button variant="ghost" size="sm" onClick={() => aoMudar(filtroVazio)}>
          <X /> Limpar
        </Button>
      )}
    </div>
  );
}
