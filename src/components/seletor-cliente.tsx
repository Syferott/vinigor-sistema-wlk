"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { soDigitos, telefoneBR } from "@/lib/format";
import { Check, Search } from "lucide-react";

export type ClienteOpcao = {
  id: string;
  nome: string;
  telefone: string | null;
  documento: string | null;
  condicoes_padrao?: string | null;
};

export function SeletorCliente({
  clientes,
  nome = "cliente_id",
  selecionado,
  aoSelecionar,
  acao,
}: {
  clientes: ClienteOpcao[];
  nome?: string;
  selecionado?: string;
  aoSelecionar: (cliente: ClienteOpcao) => void;
  /** Botão de cadastro rápido, renderizado ao lado do rótulo. */
  acao?: React.ReactNode;
}) {
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes.slice(0, 30);
    const digitos = soDigitos(termo);
    return clientes
      .filter(
        (c) =>
          c.nome.toLowerCase().includes(termo) ||
          (digitos.length >= 3 &&
            (soDigitos(c.telefone).includes(digitos) ||
              soDigitos(c.documento).includes(digitos))),
      )
      .slice(0, 30);
  }, [busca, clientes]);

  const atual = clientes.find((c) => c.id === selecionado);

  return (
    <div className="grid gap-2">
      <input type="hidden" name={nome} value={selecionado ?? ""} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor="busca-cliente">Cliente *</Label>
        {acao}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="busca-cliente"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={
            atual ? atual.nome : "Buscar por nome, telefone ou documento…"
          }
          className="bg-card pl-9"
          autoComplete="off"
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border bg-card">
        {filtrados.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            Nenhum cliente encontrado. Use “Cadastrar cliente” acima.
          </p>
        ) : (
          <ul className="divide-y">
            {filtrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => aoSelecionar(c)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent",
                    selecionado === c.id && "bg-accent",
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0 text-[#5b8f1f]",
                      selecionado === c.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.nome}</span>
                    {c.telefone && (
                      <span className="block text-xs text-muted-foreground tabular">
                        {telefoneBR(c.telefone)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
