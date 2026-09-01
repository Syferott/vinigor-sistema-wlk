import Link from "next/link";
import { Fragment } from "react";
import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { BadgeBalcao } from "@/components/badges";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dataBR, MESES_LONGOS } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Vendas concluídas" };

type Linha = {
  id: string;
  numero: string;
  orcamento_id: string | null;
  cliente_id: string;
  valor_total: number;
  concluido_em: string;
  entregue_em: string | null;
  clientes: { nome: string } | null;
};

export default async function PaginaVendasConcluidas() {
  await requerDono();
  const supabase = await createClient();

  // A coluna Concluído é o arquivo da venda: entregue, recebida e fora
  // do caminho. Achamos pelo slug porque o nome é editável pelo dono.
  const { data: coluna } = await supabase
    .from("colunas")
    .select("id, nome")
    .eq("slug", "concluido")
    .maybeSingle();

  const { data } = coluna
    ? await supabase
        .from("pedidos")
        .select(
          "id, numero, orcamento_id, cliente_id, valor_total, concluido_em, entregue_em, clientes(nome)",
        )
        .eq("coluna_id", coluna.id)
        .is("deleted_at", null)
        .order("concluido_em", { ascending: false })
        .limit(500)
    : { data: [] };

  const vendas = (data ?? []) as unknown as Linha[];
  const total = vendas.reduce((s, v) => s + Number(v.valor_total), 0);

  const mesCorrente = new Date().toISOString().slice(0, 7);
  const doMes = vendas.filter((v) => v.concluido_em?.startsWith(mesCorrente));

  // Mesma leitura do contas a pagar: um bloco por mês, com subtotal.
  const grupos: { mes: string; vendas: Linha[] }[] = [];
  for (const v of vendas) {
    const mes = (v.concluido_em ?? "").slice(0, 7);
    const ultimo = grupos.at(-1);
    if (ultimo?.mes === mes) ultimo.vendas.push(v);
    else grupos.push({ mes, vendas: [v] });
  }

  const rotuloMes = (mes: string) => {
    const [ano, m] = mes.split("-");
    return `${MESES_LONGOS[Number(m) - 1]} de ${ano}`;
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Vendas concluídas"
        descricao="Entregues, recebidas e fora do quadro. Nada aqui foi excluído: continua no faturamento e na ficha do cliente."
      />

      <Conteudo className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Indicador
            rotulo="Concluídas neste mês"
            valor={String(doMes.length)}
            nota={brl(doMes.reduce((s, v) => s + Number(v.valor_total), 0))}
          />
          <Indicador rotulo="Total concluído" valor={brl(total)} />
          <Indicador
            rotulo="Vendas na lista"
            valor={String(vendas.length)}
            nota={vendas.length === 500 ? "mostrando as 500 mais recentes" : undefined}
          />
        </div>

        {vendas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma venda concluída ainda"
            descricao="Arraste para a coluna Concluído, no quadro, o pedido que já foi entregue e pago. Ele sai da produção e aparece aqui."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto scroll-fino">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Entregue
                    </TableHead>
                    <TableHead>Concluída</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((g) => (
                    <Fragment key={g.mes}>
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={5}
                          className="bg-muted/60 py-2 font-medium"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span>{rotuloMes(g.mes)}</span>
                            <span className="text-sm text-muted-foreground tabular">
                              {g.vendas.length}{" "}
                              {g.vendas.length === 1 ? "venda" : "vendas"} ·{" "}
                              {brl(
                                g.vendas.reduce(
                                  (soma, v) => soma + Number(v.valor_total),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {g.vendas.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium tabular">
                            <Link
                              href={`/pedidos/${v.id}`}
                              className="hover:underline"
                            >
                              {v.numero}
                            </Link>
                            {!v.orcamento_id && (
                              <BadgeBalcao className="mt-1 flex w-fit" />
                            )}
                          </TableCell>

                          <TableCell className="max-w-[240px]">
                            <Link
                              href={`/clientes/${v.cliente_id}`}
                              className="block truncate hover:underline"
                            >
                              {v.clientes?.nome ?? "—"}
                            </Link>
                          </TableCell>

                          <TableCell className="hidden text-muted-foreground tabular md:table-cell">
                            {dataBR(v.entregue_em)}
                          </TableCell>

                          <TableCell className="tabular">
                            {dataBR(v.concluido_em)}
                          </TableCell>

                          <TableCell className="text-right font-semibold tabular">
                            {brl(v.valor_total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </Conteudo>
    </>
  );
}

function Indicador({
  rotulo,
  valor,
  nota,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className={cn("mt-1 text-2xl font-semibold tabular")}>{valor}</p>
        {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}
