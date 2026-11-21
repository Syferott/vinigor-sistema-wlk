"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { dataBR, linkWhatsapp, telefoneBR } from "@/lib/format";
import { MessageCircle, Phone } from "lucide-react";
import type { ClienteParaContatar } from "@/lib/recorrencia";

/** Lista no quadro. O contato é manual — não sai mensagem nenhuma. */
export function AvisoRecorrentes({
  clientes,
}: {
  clientes: ClienteParaContatar[];
}) {
  const [aberto, setAberto] = useState(false);
  if (clientes.length === 0) return null;

  const visiveis = aberto ? clientes : clientes.slice(0, 4);
  const resto = clientes.length - visiveis.length;

  return (
    <section className="shrink-0 border-b bg-amber-50 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-amber-950">
          {clientes.length}{" "}
          {clientes.length === 1
            ? "cliente para contatar"
            : "clientes para contatar"}
        </h2>
        <p className="text-xs text-amber-900">
          Pedem sempre e o intervalo já venceu. Ninguém recebe mensagem
          automática.
        </p>
      </div>

      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {visiveis.map((c) => {
          const wa = linkWhatsapp(c.telefone);
          return (
            <li
              key={c.id}
              className="flex items-center gap-2 rounded-md bg-white/70 px-2.5 py-1.5 text-sm"
            >
              <div className="min-w-0 flex-1">
                <Link
                  href={`/clientes/${c.id}`}
                  className="block truncate font-medium hover:underline"
                >
                  {c.nome}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {c.telefone ? (
                    <span className="tabular">{telefoneBR(c.telefone)}</span>
                  ) : (
                    "sem telefone"
                  )}
                  {" · "}
                  {c.ultimoPedido
                    ? `${c.diasSemPedido}d sem pedido (a cada ${c.intervaloDias}) · último ${dataBR(c.ultimoPedido)}`
                    : `marcado, ainda sem pedido · a cada ${c.intervaloDias}d`}
                </p>
              </div>
              {wa && (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#3f5a15] hover:bg-[#e7f2d4]"
                >
                  <MessageCircle className="size-3.5" />
                  WhatsApp
                </a>
              )}
              {!wa && c.telefone && (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="size-3.5" />
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {clientes.length > 4 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-7 px-2 text-amber-950"
          onClick={() => setAberto((v) => !v)}
        >
          {aberto ? "Mostrar menos" : `Ver mais ${resto}`}
        </Button>
      )}
    </section>
  );
}
