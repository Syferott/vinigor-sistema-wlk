"use client";

import { useActionState, useState } from "react";
import {
  criarClienteRapido,
  type EstadoClienteRapido,
} from "@/app/(app)/clientes/_actions";
import type { ClienteOpcao } from "@/components/seletor-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, UserPlus } from "lucide-react";

/**
 * Cadastro de cliente sem sair do orçamento. No balcão o cliente novo
 * aparece junto com o pedido — obrigar a ir em Clientes e voltar custa a
 * venda. Aqui entra só o essencial; o resto da ficha se completa depois.
 */
export function DialogClienteRapido({
  aoCriar,
}: {
  aoCriar: (cliente: ClienteOpcao) => void;
}) {
  const [aberto, setAberto] = useState(false);

  const [estado, acao, enviando] = useActionState<
    EstadoClienteRapido,
    FormData
  >(async (anterior, dados) => {
    const r = await criarClienteRapido(anterior, dados);
    if (r.cliente) {
      aoCriar(r.cliente as ClienteOpcao);
      setAberto(false);
    }
    return r;
  }, {});

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <UserPlus /> Cadastrar cliente
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Cliente novo</DialogTitle>
            <DialogDescription>
              Só o essencial para orçar agora. Endereço, e-mail e condições de
              pagamento você completa depois na ficha.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="rapido-nome">Nome / Razão social *</Label>
            <Input id="rapido-nome" name="nome" required autoFocus />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="rapido-tipo">Tipo</Label>
              <select
                id="rapido-tipo"
                name="tipo"
                defaultValue="PF"
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="PF">Pessoa física</option>
                <option value="PJ">Pessoa jurídica</option>
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="rapido-telefone">Telefone</Label>
              <Input
                id="rapido-telefone"
                name="telefone"
                inputMode="tel"
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="rapido-documento">CPF / CNPJ</Label>
            <Input
              id="rapido-documento"
              name="documento"
              inputMode="numeric"
              placeholder="000.000.000-00"
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
              Cadastrar e usar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
