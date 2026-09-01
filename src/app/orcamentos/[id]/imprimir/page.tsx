import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requerAuth } from "@/lib/auth";
import { brl, dataBR, documentoBR, qtd, telefoneBR } from "@/lib/format";
import type { Cliente, ItemOrcamento, Orcamento } from "@/lib/types";

export const metadata = { title: "Orçamento para impressão" };

/**
 * Versão limpa para imprimir ou salvar em PDF pelo navegador.
 * Na fase 2 esta mesma marcação vira o HTML enviado ao PDFShift (RF-14).
 */
export default async function ImprimirOrcamento({
  params,
}: PageProps<"/orcamentos/[id]/imprimir">) {
  const { id } = await params;
  await requerAuth();
  const supabase = await createClient();

  const [{ data: orcamento }, { data: itens }] = await Promise.all([
    supabase
      .from("orcamentos")
      .select("*, clientes(nome, documento, telefone, email, endereco)")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("orcamento_itens").select("*").eq("orcamento_id", id).order("ordem"),
  ]);

  if (!orcamento) notFound();
  const o = orcamento as unknown as Orcamento & { clientes: Cliente };
  const lista = (itens ?? []) as ItemOrcamento[];

  const descontoValor =
    o.desconto_tipo === "percentual"
      ? (Number(o.subtotal) * Number(o.desconto_valor)) / 100
      : Number(o.desconto_valor);

  return (
    <div className="mx-auto max-w-[820px] bg-white p-10 text-[#2a2d27] print:p-0">
      <style>{`@page { size: A4; margin: 16mm; } @media print { .nao-imprimir { display: none !important; } }`}</style>

      <header className="flex items-start justify-between border-b-4 border-[#8cc63e] pb-4">
        <div>
          {/* <img> puro de propósito: este HTML é o que vai para o
              gerador de PDF na fase 2, sem depender do otimizador do Next. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-vinigor.jpeg"
            alt="VINIGOR Gráfica"
            width={104}
            height={104}
            className="rounded-lg"
          />
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[#6b7066]">
            Orçamento
          </p>
          <p className="text-xl font-bold tabular">{o.numero}</p>
          <p className="text-sm text-[#6b7066] tabular">
            {dataBR(o.data_orcamento)}
          </p>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6b7066]">
            Cliente
          </p>
          <p className="font-semibold">{o.clientes.nome}</p>
          {o.aos_cuidados && (
            <p className="font-medium">A/C {o.aos_cuidados}</p>
          )}
          {o.clientes.documento && <p>{documentoBR(o.clientes.documento)}</p>}
          {o.clientes.telefone && <p>{telefoneBR(o.clientes.telefone)}</p>}
          {o.clientes.email && <p>{o.clientes.email}</p>}
          {o.clientes.endereco && <p>{o.clientes.endereco}</p>}
        </div>
        <div className="text-right">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6b7066]">
            Condições
          </p>
          <p>
            Validade: <strong className="tabular">{dataBR(o.validade)}</strong>
          </p>
          {o.prazo_producao_dias != null && (
            <p>
              Prazo de produção:{" "}
              <strong>{o.prazo_producao_dias} dias úteis</strong>
            </p>
          )}
        </div>
      </section>

      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#f0f2ec] text-left">
            <th className="border-b border-[#d5dbcc] px-3 py-2">Descrição</th>
            <th className="border-b border-[#d5dbcc] px-3 py-2 text-right">
              Qtd.
            </th>
            <th className="border-b border-[#d5dbcc] px-3 py-2 text-right">
              Unitário
            </th>
            <th className="border-b border-[#d5dbcc] px-3 py-2 text-right">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {lista.map((i) => {
            const specs = Object.entries(i.especificacoes ?? {})
              .filter(([, v]) => v)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ");
            return (
              <tr key={i.id} className="align-top">
                <td className="border-b border-[#e1e5da] px-3 py-2">
                  <p>{i.descricao}</p>
                  {specs && <p className="text-xs text-[#6b7066]">{specs}</p>}
                </td>
                <td className="border-b border-[#e1e5da] px-3 py-2 text-right tabular">
                  {qtd(i.quantidade)}
                </td>
                <td className="border-b border-[#e1e5da] px-3 py-2 text-right tabular">
                  {brl(i.preco_unitario)}
                </td>
                <td className="border-b border-[#e1e5da] px-3 py-2 text-right tabular">
                  {brl(i.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="mt-6 flex justify-end">
        <dl className="w-64 text-sm">
          <div className="flex justify-between py-1">
            <dt className="text-[#6b7066]">Subtotal</dt>
            <dd className="tabular">{brl(o.subtotal)}</dd>
          </div>
          {descontoValor > 0 && (
            <div className="flex justify-between py-1">
              <dt className="text-[#6b7066]">Desconto</dt>
              <dd className="tabular">− {brl(descontoValor)}</dd>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t-2 border-[#8cc63e] pt-2">
            <dt className="font-semibold">Total</dt>
            <dd className="text-xl font-bold tabular">{brl(o.total)}</dd>
          </div>
        </dl>
      </section>

      {o.observacoes && (
        <section className="mt-8 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6b7066]">
            Condições e observações
          </p>
          <p className="whitespace-pre-wrap">{o.observacoes}</p>
        </section>
      )}

      <footer className="mt-12 border-t pt-4 text-center text-xs text-[#6b7066]">
        Orçamento válido até {dataBR(o.validade)}. Valores sujeitos a alteração
        após essa data.
      </footer>

      <p className="nao-imprimir mt-8 rounded-md bg-[#f0f2ec] px-4 py-3 text-center text-sm text-[#6b7066]">
        Use Ctrl/Cmd + P para imprimir ou salvar em PDF.
      </p>
    </div>
  );
}
