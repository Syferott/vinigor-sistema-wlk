"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarCliente, type EstadoCliente } from "./_actions";
import { Button } from "@/components/ui/button";
import { BotaoLink } from "@/components/botao-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { documentoBR, telefoneBR } from "@/lib/format";
import type { Cliente } from "@/lib/types";

export function FormularioCliente({ cliente }: { cliente?: Cliente }) {
  const [estado, acao, enviando] = useActionState<EstadoCliente, FormData>(
    salvarCliente,
    {},
  );

  const v = (campo: keyof Cliente) =>
    estado.valores?.[campo] ?? (cliente?.[campo] as string | null) ?? "";

  const temDuplicados = (estado.duplicados?.length ?? 0) > 0;

  return (
    <form action={acao} className="grid max-w-3xl gap-6">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}
      {/* Reenvio após o aviso de duplicidade */}
      <input type="hidden" name="forcar" value={temDuplicados ? "1" : "0"} />

      {temDuplicados && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="flex items-center gap-2 font-medium text-amber-900">
            <AlertTriangle className="size-4" />
            Já existe cliente com esse telefone ou documento
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {estado.duplicados!.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/clientes/${d.id}`}
                  className="font-medium underline underline-offset-2"
                >
                  {d.nome}
                </Link>{" "}
                — {telefoneBR(d.telefone)} · {documentoBR(d.documento)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-amber-900">
            Confira antes de duplicar. Se for outro cliente mesmo, clique em
            salvar de novo para confirmar.
          </p>
        </div>
      )}

      {estado.erro && (
        <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="size-4 shrink-0" />
          {estado.erro}
        </p>
      )}

      <Card>
        <CardContent className="grid gap-5 pt-6 sm:grid-cols-2">
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="nome">Nome / Razão social *</Label>
            <Input id="nome" name="nome" defaultValue={v("nome")} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              name="tipo"
              defaultValue={v("tipo") || "PF"}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="PF">Pessoa física</option>
              <option value="PJ">Pessoa jurídica</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="documento">CPF / CNPJ</Label>
            <Input
              id="documento"
              name="documento"
              inputMode="numeric"
              defaultValue={v("documento")}
              placeholder="000.000.000-00"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="telefone">Telefone (WhatsApp)</Label>
            <Input
              id="telefone"
              name="telefone"
              inputMode="tel"
              defaultValue={v("telefone")}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={v("email")}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              name="endereco"
              defaultValue={v("endereco")}
            />
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={3}
              defaultValue={v("observacoes")}
            />
            <p className="text-xs text-muted-foreground">
              Entra nas observações de todo orçamento deste cliente, e sai no
              impresso — ali ainda dá para ajustar caso a caso.
            </p>
          </div>

          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="condicoes_padrao">
              Condições de pagamento padrão
            </Label>
            <Textarea
              id="condicoes_padrao"
              name="condicoes_padrao"
              rows={5}
              defaultValue={v("condicoes_padrao")}
              placeholder={`Prazo de produção: a combinar\nCond. Pagamento: 15 dias corridos, depósito/transferência\nBANCO INTER - 077 / Agência: 0001 / Conta: 00000000-0\nCHAVE PIX CNPJ: 00.000.000/0001-00`}
            />
            <p className="text-xs text-muted-foreground">
              Entra sozinho nas observações de todo orçamento deste cliente, e
              ainda pode ser ajustado caso a caso.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando && <Loader2 className="animate-spin" />}
          {temDuplicados ? "Salvar mesmo assim" : "Salvar cliente"}
        </Button>
        <BotaoLink
          variant="ghost"
          href={cliente ? `/clientes/${cliente.id}` : "/clientes"}
        >
          Cancelar
        </BotaoLink>
      </div>
    </form>
  );
}
