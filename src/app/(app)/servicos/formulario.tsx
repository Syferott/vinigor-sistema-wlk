"use client";

import { useActionState, useState } from "react";
import { salvarServico, type EstadoServico } from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil, Plus } from "lucide-react";
import { UNIDADES, type Servico } from "@/lib/types";

export function DialogServico({ servico }: { servico?: Servico }) {
  const [aberto, setAberto] = useState(false);

  // Fecha ao salvar: dentro da própria ação, não num efeito reagindo a ela.
  const [estado, acao, enviando] = useActionState<EstadoServico, FormData>(
    async (anterior, dados) => {
      const resultado = await salvarServico(anterior, dados);
      if (resultado.ok) setAberto(false);
      return resultado;
    },
    {},
  );

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          servico ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${servico.nome}`}
            />
          ) : (
            <Button />
          )
        }
      >
        {servico ? (
          <Pencil className="size-4" />
        ) : (
          <>
            <Plus /> Novo serviço
          </>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {servico ? "Editar serviço" : "Novo serviço"}
            </DialogTitle>
            <DialogDescription>
              O preço-base é sugestão. No orçamento ele pode ser sobrescrito.
            </DialogDescription>
          </DialogHeader>

          {servico && <input type="hidden" name="id" value={servico.id} />}

          <div className="grid gap-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" name="nome" defaultValue={servico?.nome} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="unidade">Unidade</Label>
              <select
                id="unidade"
                name="unidade"
                defaultValue={servico?.unidade ?? "un"}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {Object.entries(UNIDADES).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="preco_base">Preço-base (R$)</Label>
              <Input
                id="preco_base"
                name="preco_base"
                inputMode="decimal"
                defaultValue={servico?.preco_base ?? ""}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="descricao_padrao">Descrição padrão</Label>
            <Textarea
              id="descricao_padrao"
              name="descricao_padrao"
              rows={2}
              defaultValue={servico?.descricao_padrao ?? ""}
              placeholder="Material, acabamento, observações que vêm preenchidas no orçamento"
            />
          </div>

          {estado.erro && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-800">
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
