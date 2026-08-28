"use client";

import { useActionState } from "react";
import { criarOrcamento, type EstadoOrcamento } from "../_actions";
import { SeletorCliente, type ClienteOpcao } from "@/components/seletor-cliente";
import { Button } from "@/components/ui/button";
import { BotaoLink } from "@/components/botao-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, Plus } from "lucide-react";

export function FormularioNovoOrcamento({
  clientes,
  clienteInicial,
  validadePadrao,
}: {
  clientes: ClienteOpcao[];
  clienteInicial?: string;
  validadePadrao: number;
}) {
  const [estado, acao, enviando] = useActionState<EstadoOrcamento, FormData>(
    criarOrcamento,
    {},
  );

  return (
    <form action={acao} className="grid max-w-2xl gap-6">
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <SeletorCliente clientes={clientes} inicial={clienteInicial} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="validade_dias">Validade (dias)</Label>
              <Input
                id="validade_dias"
                name="validade_dias"
                type="number"
                min={1}
                defaultValue={validadePadrao}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="prazo_producao_dias">
                Prazo de produção (dias)
              </Label>
              <Input
                id="prazo_producao_dias"
                name="prazo_producao_dias"
                type="number"
                min={0}
                placeholder="ex.: 5"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" name="observacoes" rows={3} />
          </div>

          {estado.erro && (
            <p className="flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="size-4 shrink-0" />
              {estado.erro}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="animate-spin" /> : <Plus />}
          Criar e adicionar itens
        </Button>
        <BotaoLink variant="ghost" href="/orcamentos">
          Cancelar
        </BotaoLink>
      </div>
    </form>
  );
}
