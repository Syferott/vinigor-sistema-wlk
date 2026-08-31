import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { brl, dataBR, dataHoraBR, documentoBR, qtd, telefoneBR } from "@/lib/format";
import {
  FORMAS_PAGAMENTO,
  type ItemOrcamento,
  type Pagamento,
  type PedidoFinanceiro,
} from "@/lib/types";

export const metadata = { title: "Recibo" };

/**
 * Comprovante da venda, para entregar ao cliente. Coluna estreita: sai
 * bem tanto em bobina térmica quanto no canto de uma folha A4.
 *
 * Fora do grupo (app) de propósito — o menu do sistema não pode ir junto
 * no papel. A autenticação é feita aqui mesmo.
 */
export default async function ReciboPedido({
  params,
}: PageProps<"/pedidos/[id]/recibo">) {
  const { id } = await params;
  await requerAuth();
  const supabase = await createClient();

  const [{ data: pedido }, { data: itens }, { data: pagamentos }, { data: fin }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("numero, created_at, observacoes, valor_total, clientes(nome, documento, telefone)")
        .eq("id", id)
        .maybeSingle(),
      supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("ordem"),
      supabase
        .from("pagamentos")
        .select("*, recebedor:profiles!pagamentos_recebido_por_fkey(nome)")
        .eq("pedido_id", id)
        .is("deleted_at", null)
        .order("data_pagamento"),
      supabase
        .from("vw_pedido_financeiro")
        .select("*")
        .eq("pedido_id", id)
        .maybeSingle(),
    ]);

  if (!pedido) notFound();

  const p = pedido as unknown as {
    numero: string;
    created_at: string;
    observacoes: string | null;
    valor_total: number;
    clientes: { nome: string; documento: string | null; telefone: string | null } | null;
  };

  const lista = (itens ?? []) as ItemOrcamento[];
  const recebidos = (pagamentos ?? []) as unknown as (Pagamento & {
    recebedor: { nome: string } | null;
  })[];
  const f = (fin ?? {
    valor_total: p.valor_total,
    total_pago: 0,
    saldo_devedor: p.valor_total,
  }) as PedidoFinanceiro;

  const saldo = Number(f.saldo_devedor);

  return (
    <div className="mx-auto max-w-[360px] bg-white p-5 text-[13px] leading-snug text-[#2a2d27] print:p-0">
      <style>{`@page { size: auto; margin: 10mm; } @media print { .nao-imprimir { display: none !important; } }`}</style>

      <header className="border-b-2 border-[#8cc63e] pb-3 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-vinigor.jpeg"
          alt="VINIGOR Gráfica"
          width={72}
          height={72}
          className="mx-auto rounded-lg"
        />
        <p className="mt-2 text-xs uppercase tracking-widest text-[#6b7066]">
          Recibo
        </p>
        <p className="text-base font-bold tabular">{p.numero}</p>
        <p className="text-xs text-[#6b7066] tabular">
          {dataHoraBR(p.created_at)}
        </p>
      </header>

      <section className="border-b border-dashed border-[#d5dbcc] py-3">
        <p className="text-xs text-[#6b7066]">Cliente</p>
        <p className="font-semibold">{p.clientes?.nome ?? "—"}</p>
        {p.clientes?.documento && (
          <p className="text-xs tabular">{documentoBR(p.clientes.documento)}</p>
        )}
        {p.clientes?.telefone && (
          <p className="text-xs tabular">{telefoneBR(p.clientes.telefone)}</p>
        )}
      </section>

      <table className="w-full border-collapse py-2">
        <tbody>
          {lista.map((i) => (
            <tr key={i.id} className="align-top">
              <td className="py-1.5">
                <p>{i.descricao}</p>
                <p className="text-xs text-[#6b7066] tabular">
                  {qtd(i.quantidade)} × {brl(i.preco_unitario)}
                </p>
              </td>
              <td className="py-1.5 text-right align-top tabular">
                {brl(i.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="border-t-2 border-[#8cc63e] pt-2">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-bold tabular">{brl(f.valor_total)}</span>
        </div>
      </section>

      {recebidos.length > 0 && (
        <section className="mt-3 border-t border-dashed border-[#d5dbcc] pt-3">
          <p className="mb-1 text-xs text-[#6b7066]">Pagamentos recebidos</p>
          {recebidos.map((g) => (
            <div key={g.id} className="flex justify-between text-xs">
              <span className="tabular">
                {dataBR(g.data_pagamento)} · {FORMAS_PAGAMENTO[g.forma]}
              </span>
              <span className="tabular">{brl(g.valor)}</span>
            </div>
          ))}
          <div className="mt-1.5 flex justify-between border-t border-[#e1e5da] pt-1.5 text-sm">
            <span>Pago</span>
            <span className="font-semibold tabular">{brl(f.total_pago)}</span>
          </div>
          {saldo > 0 && (
            <div className="flex justify-between text-sm font-semibold text-red-700">
              <span>Saldo a pagar</span>
              <span className="tabular">{brl(saldo)}</span>
            </div>
          )}
        </section>
      )}

      {p.observacoes && (
        <section className="mt-3 border-t border-dashed border-[#d5dbcc] pt-3 text-xs">
          <p className="whitespace-pre-wrap">{p.observacoes}</p>
        </section>
      )}

      <footer className="mt-4 border-t border-dashed border-[#d5dbcc] pt-3 text-center text-xs text-[#6b7066]">
        {saldo <= 0 ? (
          <p className="font-medium text-[#3f5a15]">Pedido quitado.</p>
        ) : (
          <p>Este recibo comprova apenas os valores já recebidos.</p>
        )}
        {recebidos[0]?.recebedor?.nome && (
          <p className="mt-1">Atendente: {recebidos[0].recebedor.nome}</p>
        )}
        <p className="mt-2">Obrigado pela preferência!</p>
      </footer>

      <p className="nao-imprimir mt-6 rounded-md bg-[#f0f2ec] px-3 py-2 text-center text-xs text-[#6b7066]">
        Use Ctrl/Cmd + P para imprimir.
      </p>
    </div>
  );
}
