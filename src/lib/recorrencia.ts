import { diaSP, diasAte, hojeSP, somaDias } from "@/lib/format";

export type ClienteRecorrenteBruto = {
  id: string;
  nome: string;
  telefone: string | null;
  recorrencia_dias: number | null;
};

export type ClienteParaContatar = {
  id: string;
  nome: string;
  telefone: string | null;
  intervaloDias: number;
  /** Dia do último pedido, ou nulo se nunca pediu. */
  ultimoPedido: string | null;
  diasSemPedido: number | null;
};

/**
 * Está na hora quando o último pedido + o intervalo já chegou (ou o
 * cliente foi marcado e ainda não tem pedido). Não dispara mensagem.
 */
export function clientesNaHora(
  clientes: ClienteRecorrenteBruto[],
  ultimoPorCliente: Map<string, string>,
  hoje = hojeSP(),
): ClienteParaContatar[] {
  const lista: ClienteParaContatar[] = [];

  for (const c of clientes) {
    const intervalo = Number(c.recorrencia_dias ?? 0);
    if (!Number.isInteger(intervalo) || intervalo < 1) continue;

    const bruto = ultimoPorCliente.get(c.id);
    const ultimo = bruto ? diaSP(bruto) : null;
    const devido = !ultimo || somaDias(ultimo, intervalo) <= hoje;
    if (!devido) continue;

    const faltam = ultimo ? diasAte(ultimo) : null;
    lista.push({
      id: c.id,
      nome: c.nome,
      telefone: c.telefone,
      intervaloDias: intervalo,
      ultimoPedido: ultimo,
      diasSemPedido: faltam === null ? null : Math.max(0, -faltam),
    });
  }

  lista.sort(
    (a, b) => (b.diasSemPedido ?? 99_999) - (a.diasSemPedido ?? 99_999),
  );
  return lista;
}
