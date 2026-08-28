"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { moverPedido } from "./_actions";
import { CardQuadro } from "./card";
import { FiltrosQuadro, type Filtros, filtroVazio, aplicarFiltros } from "./filtros";
import { DialogEntregaComSaldo } from "./dialog-entrega";
import { CabecalhoPagina } from "@/components/pagina";
import { BotaoLink } from "@/components/botao-link";
import { brl } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import type { CardPedido, Coluna, Profile } from "@/lib/types";

export function Quadro({
  colunas,
  cardsIniciais,
  equipe,
  podeVerTotais,
  erroInicial,
}: {
  colunas: Coluna[];
  cardsIniciais: CardPedido[];
  equipe: Profile[];
  podeVerTotais: boolean;
  erroInicial?: string;
}) {
  const router = useRouter();
  const [cards, definirCards] = useState<CardPedido[]>(cardsIniciais);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<Filtros>(filtroVazio);
  const [entregaPendente, setEntregaPendente] = useState<{
    card: CardPedido;
    colunaId: string;
    posicao: number;
  } | null>(null);

  const ignorarRealtimeAte = useRef(0);

  // Estado do servidor manda: toda revalidação sobrescreve o otimista.
  // Ajuste durante o render (padrão do React para sincronizar com props) —
  // num efeito, o quadro chegaria a pintar o estado velho antes de corrigir.
  const [ultimoDoServidor, setUltimoDoServidor] = useState(cardsIniciais);
  if (ultimoDoServidor !== cardsIniciais) {
    setUltimoDoServidor(cardsIniciais);
    definirCards(cardsIniciais);
  }

  useEffect(() => {
    if (erroInicial) toast.error(decodeURIComponent(erroInicial));
  }, [erroInicial]);

  // RNF-02: dois usuários movendo cards veem a mudança na hora.
  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel("quadro-pedidos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pedidos" },
        () => {
          if (Date.now() < ignorarRealtimeAte.current) return;
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  }, [router]);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const visiveis = useMemo(
    () => aplicarFiltros(cards, filtros),
    [cards, filtros],
  );

  const porColuna = useMemo(() => {
    const mapa = new Map<string, CardPedido[]>();
    for (const coluna of colunas) mapa.set(coluna.id, []);
    for (const card of visiveis) {
      mapa.get(card.coluna_id)?.push(card);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.posicao - b.posicao);
    }
    return mapa;
  }, [visiveis, colunas]);

  /** Coluna de um id, seja ele de coluna (área vazia) ou de card. */
  function colunaDe(id: string): string | undefined {
    if (colunas.some((c) => c.id === id)) return id;
    return cards.find((c) => c.id === id)?.coluna_id;
  }

  function aoIniciar(evento: DragStartEvent) {
    setArrastando(String(evento.active.id));
  }

  function aoPassarPor(evento: DragOverEvent) {
    const { active, over } = evento;
    if (!over) return;

    const origem = colunaDe(String(active.id));
    const destino = colunaDe(String(over.id));
    if (!origem || !destino || origem === destino) return;

    definirCards((atual) =>
      atual.map((c) =>
        c.id === String(active.id) ? { ...c, coluna_id: destino } : c,
      ),
    );
  }

  async function aoSoltar(evento: DragEndEvent) {
    const { active, over } = evento;
    setArrastando(null);
    if (!over) return;

    const idCard = String(active.id);
    const destino = colunaDe(String(over.id));
    if (!destino) return;

    const naColuna = cards
      .filter((c) => c.coluna_id === destino)
      .sort((a, b) => a.posicao - b.posicao);

    const de = naColuna.findIndex((c) => c.id === idCard);
    if (de === -1) return;
    const para = naColuna.findIndex((c) => c.id === String(over.id));

    const ordenada =
      para === -1 || de === para ? naColuna : arrayMove(naColuna, de, para);

    const comPosicao = ordenada.map((c, i) => ({ ...c, posicao: i + 1 }));
    const posicaoFinal =
      comPosicao.find((c) => c.id === idCard)?.posicao ?? comPosicao.length;

    definirCards((atual) =>
      atual.map((c) => comPosicao.find((x) => x.id === c.id) ?? c),
    );

    await persistir(idCard, destino, posicaoFinal);
  }

  async function persistir(
    pedidoId: string,
    colunaId: string,
    posicao: number,
    justificativa?: string,
  ) {
    ignorarRealtimeAte.current = Date.now() + 1500;

    const resultado = await moverPedido({
      pedidoId,
      colunaId,
      posicao,
      justificativa,
    });

    if (resultado.ok) {
      if (justificativa) toast.success("Entregue com saldo em aberto registrado.");
      return;
    }

    const card = cards.find((c) => c.id === pedidoId);

    if (resultado.exigeJustificativa && card) {
      // RF-29: a exceção existe, mas fica registrada com justificativa.
      setEntregaPendente({ card, colunaId, posicao });
    } else {
      toast.error(resultado.erro);
    }

    router.refresh();
  }

  const totalGeral = useMemo(
    () => visiveis.reduce((s, c) => s + Number(c.valor_total), 0),
    [visiveis],
  );

  return (
    <>
      <CabecalhoPagina
        titulo="Quadro de produção"
        descricao={
          podeVerTotais
            ? `${visiveis.length} pedidos em aberto · ${brl(totalGeral)}`
            : `${visiveis.length} pedidos em aberto`
        }
      >
        <BotaoLink href="/orcamentos/novo">
          <Plus /> Novo orçamento
        </BotaoLink>
      </CabecalhoPagina>

      <FiltrosQuadro
        cards={cards}
        equipe={equipe}
        filtros={filtros}
        aoMudar={setFiltros}
      />

      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={aoIniciar}
        onDragOver={aoPassarPor}
        onDragEnd={aoSoltar}
      >
        <div className="scroll-fino flex gap-4 overflow-x-auto p-4 sm:p-6">
          {colunas.map((coluna) => (
            <ColunaQuadro
              key={coluna.id}
              coluna={coluna}
              cards={porColuna.get(coluna.id) ?? []}
              podeVerTotais={podeVerTotais}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {arrastando ? (
            <CardQuadro
              card={cards.find((c) => c.id === arrastando)!}
              sobreposicao
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <DialogEntregaComSaldo
        pendente={entregaPendente}
        aoFechar={() => setEntregaPendente(null)}
        aoConfirmar={async (justificativa) => {
          if (!entregaPendente) return;
          const { card, colunaId, posicao } = entregaPendente;
          setEntregaPendente(null);
          await persistir(card.id, colunaId, posicao, justificativa);
          router.refresh();
        }}
      />
    </>
  );
}

function ColunaQuadro({
  coluna,
  cards,
  podeVerTotais,
}: {
  coluna: Coluna;
  cards: CardPedido[];
  podeVerTotais: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const total = cards.reduce((s, c) => s + Number(c.valor_total), 0);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-card/60 transition-colors",
        isOver && "border-[#8cc63e] bg-[#f4faea]",
      )}
    >
      <header
        className="flex items-center gap-2 rounded-t-xl border-b px-3 py-2.5"
        style={{ borderTop: `3px solid ${coluna.cor}` }}
      >
        <h2 className="flex-1 truncate text-sm font-semibold">{coluna.nome}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular">
          {cards.length}
        </span>
      </header>

      {podeVerTotais && cards.length > 0 && (
        <p className="border-b px-3 py-1.5 text-xs text-muted-foreground tabular">
          {brl(total)}
        </p>
      )}

      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="scroll-fino flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {cards.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Arraste um card para cá
            </p>
          ) : (
            cards.map((card) => <CardQuadro key={card.id} card={card} />)
          )}
        </div>
      </SortableContext>
    </section>
  );
}
