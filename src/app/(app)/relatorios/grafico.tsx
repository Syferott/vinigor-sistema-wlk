"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, brlCurto } from "@/lib/format";

/**
 * Paleta validada para daltonismo contra fundo claro
 * (ΔE mínimo 18,6 protan / 12,2 tritan; contraste ≥ 3:1).
 * O ano anterior vem como linha tracejada — a forma da marca já
 * separa a série de referência das duas barras do ano corrente.
 */
export const COR_VENDIDO = "#5b8f1f";
export const COR_RECEBIDO = "#1f5f8f";
export const COR_ANTERIOR = "#a8641f";

export type PontoMes = {
  mes: string;
  vendido: number;
  recebido: number;
  vendidoAnterior: number;
};

export function GraficoFaturamento({
  dados,
  ano,
}: {
  dados: PontoMes[];
  ano: number;
}) {
  const temAnterior = dados.some((d) => d.vendidoAnterior > 0);

  return (
    <figure className="grid gap-3">
      <Legenda ano={ano} temAnterior={temAnterior} />

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={dados}
            margin={{ top: 8, right: 8, bottom: 0, left: 8 }}
            barGap={2}
          >
            <CartesianGrid
              vertical={false}
              stroke="#e1e5da"
              strokeDasharray="0"
            />
            <XAxis
              dataKey="mes"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b7066", fontSize: 12 }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: "#6b7066", fontSize: 12 }}
              tickFormatter={(v: number) => brlCurto(v)}
            />
            <Tooltip
              cursor={{ fill: "#2a2d2708" }}
              content={<Dica ano={ano} />}
            />

            <Bar
              dataKey="vendido"
              name="Vendido"
              fill={COR_VENDIDO}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
            />
            <Bar
              dataKey="recebido"
              name="Recebido"
              fill={COR_RECEBIDO}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
            />
            {temAnterior && (
              <Line
                type="monotone"
                dataKey="vendidoAnterior"
                name={`Vendido em ${ano - 1}`}
                stroke={COR_ANTERIOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={{ r: 3, fill: COR_ANTERIOR, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="text-xs text-muted-foreground">
        <strong>Vendido</strong> é competência: pedidos aprovados no mês.{" "}
        <strong>Recebido</strong> é caixa: pagamentos que entraram no mês. Os
        dois números são diferentes e ambos importam.
      </figcaption>
    </figure>
  );
}

function Legenda({ ano, temAnterior }: { ano: number; temAnterior: boolean }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      <ItemLegenda cor={COR_VENDIDO} rotulo={`Vendido em ${ano}`} />
      <ItemLegenda cor={COR_RECEBIDO} rotulo={`Recebido em ${ano}`} />
      {temAnterior && (
        <ItemLegenda
          cor={COR_ANTERIOR}
          rotulo={`Vendido em ${ano - 1}`}
          linha
        />
      )}
    </ul>
  );
}

function ItemLegenda({
  cor,
  rotulo,
  linha,
}: {
  cor: string;
  rotulo: string;
  linha?: boolean;
}) {
  return (
    <li className="flex items-center gap-2 text-muted-foreground">
      {linha ? (
        <span
          className="inline-block h-0 w-4 border-t-2 border-dashed"
          style={{ borderColor: cor }}
          aria-hidden
        />
      ) : (
        <span
          className="inline-block size-3 rounded-sm"
          style={{ backgroundColor: cor }}
          aria-hidden
        />
      )}
      {rotulo}
    </li>
  );
}

type ItemDica = { name?: string; dataKey?: string | number; value?: number };

function Dica({
  active,
  payload,
  label,
  ano,
}: {
  active?: boolean;
  payload?: ItemDica[];
  label?: string;
  ano?: number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
      <p className="mb-1.5 font-medium">
        {label}/{ano}
      </p>
      <ul className="grid gap-1">
        {payload.map((p) => (
          <li
            key={String(p.dataKey)}
            className="flex items-center justify-between gap-6"
          >
            <span className="text-muted-foreground">{p.name}</span>
            <span className="font-medium tabular">{brl(p.value ?? 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
