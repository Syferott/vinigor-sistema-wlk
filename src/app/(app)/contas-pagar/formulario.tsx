"use client";

import { useActionState, useState } from "react";
import { toast } from "sonner";
import { pagarConta, salvarConta, type EstadoConta } from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, Loader2, Pencil, Plus } from "lucide-react";
import { brl, hojeSP } from "@/lib/format";
import {
  CATEGORIAS_CONTA,
  FORMAS_PAGAMENTO,
  type ContaPagar,
} from "@/lib/types";

const seletor =
  "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function DialogConta({ conta }: { conta?: ContaPagar }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState<EstadoConta, FormData>(
    async (anterior, dados) => {
      const r = await salvarConta(anterior, dados);
      if (r.ok) {
        toast.success(r.ok);
        setAberto(false);
      }
      return r;
    },
    {},
  );

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger
        render={
          conta ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Editar ${conta.descricao}`}
            />
          ) : (
            <Button />
          )
        }
      >
        {conta ? <Pencil className="size-4" /> : <><Plus /> Nova conta</>}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{conta ? "Editar conta" : "Nova conta a pagar"}</DialogTitle>
            <DialogDescription>
              Boleto de fornecedor, luz, água, aluguel — o que sai do caixa.
            </DialogDescription>
          </DialogHeader>

          {conta && <input type="hidden" name="id" value={conta.id} />}

          <div className="grid gap-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              name="descricao"
              required
              defaultValue={conta?.descricao}
              placeholder="Ex.: Energia elétrica — agosto"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="credor">Para quem</Label>
              <Input
                id="credor"
                name="credor"
                defaultValue={conta?.credor ?? ""}
                placeholder="CEMIG, papelaria…"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <select
                id="categoria"
                name="categoria"
                defaultValue={conta?.categoria ?? "fornecedor"}
                className={seletor}
              >
                {Object.entries(CATEGORIAS_CONTA).map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor (R$) *</Label>
              <Input
                id="valor"
                name="valor"
                inputMode="decimal"
                required
                defaultValue={conta?.valor ?? ""}
                placeholder="0,00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vencimento">Vencimento *</Label>
              <Input
                id="vencimento"
                name="vencimento"
                type="date"
                required
                defaultValue={conta?.vencimento ?? hojeSP()}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              name="observacao"
              rows={2}
              defaultValue={conta?.observacao ?? ""}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              name="recorrente"
              defaultChecked={conta?.recorrente}
              className="mt-0.5"
            />
            <span>
              Conta que se repete todo mês
              <span className="block text-xs text-muted-foreground">
                Só marca; a cópia do mês seguinte você cria com um clique
                quando a conta chegar.
              </span>
            </span>
          </label>

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

export function DialogBaixa({ conta }: { conta: ContaPagar }) {
  const [aberto, setAberto] = useState(false);
  const [estado, acao, enviando] = useActionState<EstadoConta, FormData>(
    async (anterior, dados) => {
      const r = await pagarConta(anterior, dados);
      if (r.ok) {
        toast.success(r.ok);
        setAberto(false);
      }
      return r;
    },
    {},
  );

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <CheckCircle2 /> Pagar
      </DialogTrigger>

      <DialogContent className="sm:max-w-sm">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Dar baixa</DialogTitle>
            <DialogDescription>
              {conta.descricao} — previsto {brl(conta.valor)}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="id" value={conta.id} />

          <div className="grid gap-2">
            <Label htmlFor={`vp-${conta.id}`}>Valor pago (R$)</Label>
            <Input
              id={`vp-${conta.id}`}
              name="valor_pago"
              inputMode="decimal"
              defaultValue={conta.valor}
              required
            />
            <p className="text-xs text-muted-foreground">
              Pode diferir do previsto — juros, multa ou desconto.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`pe-${conta.id}`}>Data do pagamento</Label>
            <Input
              id={`pe-${conta.id}`}
              name="pago_em"
              type="date"
              defaultValue={hojeSP()}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`fp-${conta.id}`}>Forma</Label>
            <select
              id={`fp-${conta.id}`}
              name="forma"
              defaultValue="boleto"
              className={seletor}
            >
              {Object.entries(FORMAS_PAGAMENTO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {estado.erro && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-800">
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
