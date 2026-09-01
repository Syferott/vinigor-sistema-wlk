"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw } from "lucide-react";

/**
 * Bloco que sai no orçamento impresso. Nasce com o que está no cadastro
 * do cliente (observações + condições padrão) e daqui em diante é texto
 * livre: o que vale para este orçamento pode não valer para o próximo.
 * O botão só reaparece quando o texto do cadastro mudou desde então.
 */
export function CampoObservacoes({
  valorInicial,
  textoDoCliente,
  desabilitado,
}: {
  valorInicial: string;
  textoDoCliente: string;
  desabilitado?: boolean;
}) {
  const [valor, setValor] = useState(valorInicial);
  const podePuxar =
    !desabilitado && textoDoCliente && textoDoCliente !== valor.trim();

  return (
    <div className="grid gap-2">
      <Label htmlFor="observacoes">Condições / observações</Label>
      <Textarea
        id="observacoes"
        name="observacoes"
        rows={5}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        disabled={desabilitado}
        placeholder="Prazo, forma de pagamento, dados bancários…"
      />
      {podePuxar && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="justify-start text-xs"
          onClick={() => setValor(textoDoCliente)}
        >
          <RefreshCw /> Puxar do cadastro do cliente
        </Button>
      )}
    </div>
  );
}
