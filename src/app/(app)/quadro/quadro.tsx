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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { moverPedido, receberEConcluir } from "./_actions";
import { registrarPagamento } from "@/app/(app)/pedidos/_actions";
import { CardQuadro } from "./card";
import { FiltrosQuadro, type Filtros, filtroVazio, aplicarFiltros } from "./filtros";
import { DialogEntregaComSaldo } from "./dialog-entrega";
import { DialogConclusaoComSaldo } from "./dialog-conclusao";
import { DialogReceber, type RecebimentoCard } from "./dialog-receber";
import { AvisoRecorrentes } from "./aviso-recorrentes";
import { CabecalhoPagina } from "@/components/pagina";
import { BotaoLink } from "@/components/botao-link";
import { brl, hojeSP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Columns3Cog, Plus, ShoppingCart } from "lucide-react";
import type { ClienteParaContatar } from "@/lib/recorrencia";
import type { CardPedido, Coluna, Profile } from "@/lib/types";

/** Arquivo morto do quadro: não estica a página. O resto rola dentro da coluna. */
const COLUNA_RECOLHIDA = new Set(["concluido", "cancelado"]);
const LIMITE_RECOLHIDA = 8;
const PASSO_RECOLHIDA = 15;

export function Quadro({
  colunas,
  cardsIniciais,
  equipe,
  podeVerTotais,
  podeEditarColunas,
  erroInicial,
  pedidoExcluido,
  paraContatar,
}: {
  colunas: Coluna[];
  cardsIniciais: CardPedido[];
  equipe: Profile[];
  podeVerTotais: boolean;
  podeEditarColunas?: boolean;
  erroInicial?: string;
  pedidoExcluido?: boolean;
  paraContatar: ClienteParaContatar[];
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
  const [conclusaoPendente, setConclusaoPendente] = useState<{
    card: CardPedido;
    colunaId: string;
    posicao: number;
    saldo: number;
  } | null>(null);
  const [receber, setReceber] = useState<CardPedido | null>(null);

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

  useEffect(() => {
    if (pedidoExcluido) {
      toast.success("Pedido excluído. O registro continua guardado na auditoria.");
    }
  }, [pedidoExcluido]);

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

    if (resultado.exigePagamento && card) {
      // Concluir devendo não tem exceção: o diálogo recebe o que falta.
      setConclusaoPendente({
        card,
        colunaId,
        posicao,
        saldo: resultado.saldo ?? Number(card.saldo_devedor),
      });
    } else if (resultado.exigeJustificativa && card) {
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

  async function confirmarRecebimento(recebimento: RecebimentoCard) {
    if (!receber) return;
    const dados = new FormData();
    dados.set("pedido_id", receber.id);
    dados.set("valor", String(recebimento.valor));
    dados.set("forma", recebimento.forma);
    dados.set(
      "tipo",
      recebimento.forma === "faturado"
        ? "parcela"
        : recebimento.valor >= Number(receber.saldo_devedor)
          ? "quitacao"
          : "parcela",
    );
    dados.set(
      "data_pagamento",
      recebimento.forma === "faturado" ? recebimento.data : hojeSP(),
    );
    if (recebimento.forma === "faturado") {
      dados.set("agendado_meio", recebimento.meio);
      dados.set("agendado_para", recebimento.data);
    }

    const r = await registrarPagamento({}, dados);
    if (r.ok) {
      toast.success(
        recebimento.forma === "faturado"
          ? `${brl(recebimento.valor)} faturado. O saldo continua em aberto até o dinheiro entrar.`
          : `${brl(recebimento.valor)} registrado em ${receber.numero}.`,
      );
      setReceber(null);
    } else {
      toast.error(r.erro ?? "Não consegui registrar o pagamento.");
    }
    router.refresh();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <CabecalhoPagina
        titulo="Quadro de produção"
        descricao={
          podeVerTotais
            ? `${visiveis.length} pedidos em aberto · ${brl(totalGeral)}`
            : `${visiveis.length} pedidos em aberto`
        }
      >
        {podeEditarColunas && (
          <BotaoLink href="/quadro/colunas" variant="ghost">
            <Columns3Cog /> Colunas
          </BotaoLink>
        )}
        <BotaoLink href="/balcao" variant="outline">
          <ShoppingCart /> Venda balcão
        </BotaoLink>
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

      <AvisoRecorrentes clientes={paraContatar} />

      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={aoIniciar}
        onDragOver={aoPassarPor}
        onDragEnd={aoSoltar}
      >
        <div className="scroll-sempre flex min-h-0 flex-1 gap-4 overflow-x-scroll overflow-y-hidden p-4 sm:p-6">
          {colunas.map((coluna) => (
            <ColunaQuadro
              key={coluna.id}
              coluna={coluna}
              cards={porColuna.get(coluna.id) ?? []}
              podeVerTotais={podeVerTotais}
              aoReceber={setReceber}
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

      <DialogConclusaoComSaldo
        pendente={conclusaoPendente}
        aoFechar={() => setConclusaoPendente(null)}
        aoConfirmar={async (valor, forma) => {
          if (!conclusaoPendente) return;
          const { card, colunaId, posicao } = conclusaoPendente;
          ignorarRealtimeAte.current = Date.now() + 1500;

          const r = await receberEConcluir({
            pedidoId: card.id,
            colunaId,
            posicao,
            valor,
            forma,
          });

          setConclusaoPendente(null);

          if (r.ok) {
            toast.success(`${brl(valor)} recebido. Venda concluída.`);
          } else if (r.exigePagamento) {
            // Pagou parte: o dinheiro entrou, a venda continua em aberto.
            toast.info(
              `${brl(valor)} registrado. Ainda faltam ${brl(
                r.saldo ?? 0,
              )} para concluir.`,
            );
          } else {
            toast.error(r.erro);
          }

          router.refresh();
        }}
      />

      <DialogReceber
        card={receber}
        aoFechar={() => setReceber(null)}
        aoConfirmar={confirmarRecebimento}
      />

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
    </div>
  );
}

function ColunaQuadro({
  coluna,
  cards,
  podeVerTotais,
  aoReceber,
}: {
  coluna: Coluna;
  cards: CardPedido[];
  podeVerTotais: boolean;
  aoReceber: (card: CardPedido) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const total = cards.reduce((s, c) => s + Number(c.valor_total), 0);
  const recolhida = COLUNA_RECOLHIDA.has(coluna.slug);
  const [mostrar, setMostrar] = useState(LIMITE_RECOLHIDA);
  const visiveis = recolhida ? cards.slice(0, mostrar) : cards;
  const ocultos = cards.length - visiveis.length;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex h-full max-h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-card/60 transition-colors",
        isOver && "border-[#8cc63e] bg-[#f4faea]",
      )}
    >
      <header
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5"
        style={{ borderTop: `3px solid ${coluna.cor}` }}
      >
        <h2 className="flex-1 truncate text-sm font-semibold">{coluna.nome}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular">
          {cards.length}
        </span>
      </header>

      {podeVerTotais && cards.length > 0 && (
        <p className="shrink-0 border-b px-3 py-1.5 text-xs text-muted-foreground tabular">
          {brl(total)}
        </p>
      )}

      {recolhida && cards.length > LIMITE_RECOLHIDA && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground tabular">
            {Math.min(mostrar, cards.length)} de {cards.length}
          </p>
          <div className="flex gap-1">
            {ocultos > 0 && (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-[#3f5a15] hover:bg-[#e7f2d4]"
                onClick={() =>
                  setMostrar((n) => Math.min(cards.length, n + PASSO_RECOLHIDA))
                }
              >
                Ver mais
              </button>
            )}
            {mostrar > LIMITE_RECOLHIDA && (
              <button
                type="button"
                className="rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
                onClick={() => setMostrar(LIMITE_RECOLHIDA)}
              >
                Recolher
              </button>
            )}
          </div>
        </div>
      )}

      <SortableContext
        items={visiveis.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="scroll-sempre flex min-h-0 flex-1 flex-col gap-2 overflow-y-scroll overscroll-contain p-2">
          {cards.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              Arraste um card para cá
            </p>
          ) : (
            visiveis.map((card) => (
              <CardQuadro key={card.id} card={card} aoReceber={aoReceber} />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}
