export const FUSO = "America/Sao_Paulo";

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 3,
});

export function brl(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? Number(valor) : (valor ?? 0);
  return moeda.format(Number.isFinite(n) ? n : 0);
}

export function qtd(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? Number(valor) : (valor ?? 0);
  return numero.format(Number.isFinite(n) ? n : 0);
}

/** Data vinda como `YYYY-MM-DD` do Postgres, sem escorregar de fuso. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function dataHoraBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: FUSO,
  }).format(new Date(iso));
}

/** Hoje em America/Sao_Paulo como `YYYY-MM-DD`. */
export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(new Date());
}

export function somaDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(d);
}

/** Diferença em dias entre uma data `YYYY-MM-DD` e hoje (negativo = atrasado). */
export function diasAte(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const alvo = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const hoje = new Date(`${hojeSP()}T12:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

/** Timestamp em DD/MM/AAAA no fuso de São Paulo. */
export function dataSP(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/**
 * "2026-09" no fuso de São Paulo. Fatiar o ISO direto agruparia errado
 * o que foi feito depois das 21h — lá já é o mês seguinte em UTC.
 */
export function mesSP(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
  }).format(new Date(iso));
}

export const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

export const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Aceita "1.234,56" ou "1234.56" e devolve number. */
export function parseValor(entrada: FormDataEntryValue | null): number {
  if (entrada == null) return 0;
  const bruto = String(entrada).trim();
  if (!bruto) return 0;
  const limpo = bruto
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function texto(entrada: FormDataEntryValue | null): string | null {
  const v = entrada == null ? "" : String(entrada).trim();
  return v === "" ? null : v;
}

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function documentoBR(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return v ?? "—";
}

export function telefoneBR(v: string | null | undefined): string {
  const d = soDigitos(v);
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return v ?? "—";
}

export function linkWhatsapp(telefone: string | null | undefined): string | null {
  const d = soDigitos(telefone);
  if (d.length < 10) return null;
  return `https://wa.me/55${d}`;
}

const moedaCurta = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Para eixos de gráfico: R$ 12,4 mil. */
export function brlCurto(valor: number | string | null | undefined): string {
  const n = typeof valor === "string" ? Number(valor) : (valor ?? 0);
  if (!Number.isFinite(n)) return "R$ 0";
  if (Math.abs(n) < 1000) return moeda.format(n);
  return moedaCurta.format(n);
}

export function variacao(atual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((atual - anterior) / anterior) * 100;
}
