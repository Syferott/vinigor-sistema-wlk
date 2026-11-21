"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEIO_FATURADO, type MeioFaturado } from "@/lib/types";

const seletor =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Boleto ou PIX, e o dia combinado. Só aparece quando a forma é Faturado. */
export function CamposFaturado({
  forma,
  meio,
  data,
  aoMudarMeio,
  aoMudarData,
}: {
  forma: string;
  meio: MeioFaturado;
  data: string;
  aoMudarMeio: (meio: MeioFaturado) => void;
  aoMudarData: (data: string) => void;
}) {
  if (forma !== "faturado") return null;

  return (
    <div className="grid gap-3 rounded-lg border border-sky-200 bg-sky-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="agendado_meio">Boleto ou PIX</Label>
          <select
            id="agendado_meio"
            name="agendado_meio"
            value={meio}
            onChange={(e) => aoMudarMeio(e.target.value as MeioFaturado)}
            className={seletor}
          >
            {Object.entries(MEIO_FATURADO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="agendado_para">Data combinada</Label>
          <Input
            id="agendado_para"
            name="agendado_para"
            type="date"
            value={data}
            onChange={(e) => aoMudarData(e.target.value)}
            required
          />
        </div>
      </div>
      <p className="text-xs text-sky-950">
        Faturado não quita. O valor continua em aberto até o boleto ou o PIX
        entrar no caixa — aí se registra o recebimento de verdade.
      </p>
    </div>
  );
}
