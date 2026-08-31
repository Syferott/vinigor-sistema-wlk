"use client";

import { useActionState, useState } from "react";
import { criarOrcamento, type EstadoOrcamento } from "../_actions";
import {
  SeletorCliente,
  type ClienteOpcao,
} from "@/components/seletor-cliente";
import { DialogClienteRapido } from "@/components/dialog-cliente-rapido";
import { BotaoLink } from "@/components/botao-link";
import { Button } from "@/components/ui/button";
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

  // A lista é local para o cliente recém-cadastrado aparecer sem recarregar.
  const [lista, setLista] = useState(clientes);
  const [selecionado, setSelecionado] = useState(clienteInicial);
  const [observacoes, setObservacoes] = useState(
    clientes.find((c) => c.id === clienteInicial)?.condicoes_padrao ?? "",
  );

  function selecionar(c: ClienteOpcao) {
    setSelecionado(c.id);
    // Condições combinadas com aquele cliente entram sozinhas; ainda dá
    // para ajustar caso a caso antes de enviar.
    if (c.condicoes_padrao) setObservacoes(c.condicoes_padrao);
  }

  return (
    <form action={acao} className="grid max-w-2xl gap-6">
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <SeletorCliente
            clientes={lista}
            selecionado={selecionado}
            aoSelecionar={selecionar}
            acao={
              <DialogClienteRapido
                aoCriar={(c) => {
                  setLista((atual) => [c, ...atual]);
                  selecionar(c);
                }}
              />
            }
          />

          <div className="grid gap-2">
            <Label htmlFor="aos_cuidados">A/C — aos cuidados de</Label>
            <Input
              id="aos_cuidados"
              name="aos_cuidados"
              placeholder="Ex.: Luciana"
            />
            <p className="text-xs text-muted-foreground">
              Sai no cabeçalho do orçamento impresso, abaixo do cliente.
            </p>
          </div>

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
            <Label htmlFor="observacoes">Condições / observações</Label>
            <Textarea
              id="observacoes"
              name="observacoes"
              rows={6}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Prazo, forma de pagamento, dados bancários…"
            />
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
