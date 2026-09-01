import { Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { DialogBaixa, DialogConta } from "./formulario";
import { estornarConta, excluirConta, repetirNoProximoMes } from "./_actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, dataBR, diasAte, MESES_LONGOS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CopyPlus, Trash2, Undo2 } from "lucide-react";
import {
  CATEGORIAS_CONTA,
  FORMAS_PAGAMENTO,
  type ContaPagar,
} from "@/lib/types";

export const metadata = { title: "Contas a pagar" };

const FILTROS = [
  { valor: "", rotulo: "Em aberto" },
  { valor: "pagas", rotulo: "Pagas" },
  { valor: "todas", rotulo: "Todas" },
];

export default async function PaginaContasPagar({
  searchParams,
}: PageProps<"/contas-pagar">) {
  await requerDono();
  const { filtro } = await searchParams;
  const atual = typeof filtro === "string" ? filtro : "";
  const supabase = await createClient();

  let query = supabase
    .from("contas_pagar")
    .select("*")
    .is("deleted_at", null)
    .limit(300);

  if (atual === "pagas") {
    query = query.not("pago_em", "is", null).order("pago_em", { ascending: false });
  } else if (atual === "todas") {
    query = query.order("vencimento");
  } else {
    query = query.is("pago_em", null).order("vencimento");
  }

  const { data } = await query;
  const contas = (data ?? []) as ContaPagar[];

  // Indicadores sempre sobre o quadro completo, não sobre o filtro.
  const { data: todas } = await supabase
    .from("contas_pagar")
    .select("valor, valor_pago, vencimento, pago_em")
    .is("deleted_at", null);

  const linhas = (todas ?? []) as Pick<
    ContaPagar,
    "valor" | "valor_pago" | "vencimento" | "pago_em"
  >[];

  const abertas = linhas.filter((c) => !c.pago_em);
  const vencidas = abertas.filter((c) => (diasAte(c.vencimento) ?? 0) < 0);
  const proximos7 = abertas.filter((c) => {
    const d = diasAte(c.vencimento);
    return d !== null && d >= 0 && d <= 7;
  });

  const mesAtual = new Date().toISOString().slice(0, 7);
  const pagoNoMes = linhas
    .filter((c) => c.pago_em?.startsWith(mesAtual))
    .reduce((s, c) => s + Number(c.valor_pago ?? 0), 0);

  const soma = (l: typeof linhas) => l.reduce((s, c) => s + Number(c.valor), 0);

  // Agrupa pela mesma data que ordena a lista — vencimento, ou pagamento
  // quando o filtro é "Pagas". Como as contas já vêm ordenadas, basta
  // quebrar o grupo quando o mês muda.
  const mesDe = (c: ContaPagar) =>
    ((atual === "pagas" ? c.pago_em : null) ?? c.vencimento).slice(0, 7);

  const grupos: { mes: string; contas: ContaPagar[] }[] = [];
  for (const c of contas) {
    const mes = mesDe(c);
    const ultimo = grupos.at(-1);
    if (ultimo?.mes === mes) ultimo.contas.push(c);
    else grupos.push({ mes, contas: [c] });
  }

  const rotuloMes = (mes: string) => {
    const [ano, m] = mes.split("-");
    return `${MESES_LONGOS[Number(m) - 1]} de ${ano}`;
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Contas a pagar"
        descricao="O que sai do caixa: fornecedor, energia, água, aluguel."
      >
        <DialogConta />
      </CabecalhoPagina>

      <Conteudo className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo="Vencidas"
            valor={brl(soma(vencidas))}
            nota={`${vencidas.length} ${vencidas.length === 1 ? "conta" : "contas"}`}
            destaque={vencidas.length > 0}
          />
          <Indicador
            rotulo="Vence em 7 dias"
            valor={brl(soma(proximos7))}
            nota={`${proximos7.length} ${proximos7.length === 1 ? "conta" : "contas"}`}
          />
          <Indicador
            rotulo="Total em aberto"
            valor={brl(soma(abertas))}
            nota={`${abertas.length} ${abertas.length === 1 ? "conta" : "contas"}`}
          />
          <Indicador rotulo="Pago neste mês" valor={brl(pagoNoMes)} />
        </div>

        <nav className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={f.valor ? `/contas-pagar?filtro=${f.valor}` : "/contas-pagar"}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                atual === f.valor
                  ? "border-[#8cc63e] bg-[#8cc63e] font-medium text-[#1b2410]"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {f.rotulo}
            </Link>
          ))}
        </nav>

        {contas.length === 0 ? (
          <EstadoVazio
            titulo={atual === "pagas" ? "Nenhuma conta paga ainda" : "Nada a pagar"}
            descricao="Lance aqui boletos de fornecedor, energia, água e aluguel para não perder vencimento."
          >
            <DialogConta />
          </EstadoVazio>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="overflow-x-auto scroll-fino">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="hidden md:table-cell">Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-52 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grupos.map((g) => (
                    <Fragment key={g.mes}>
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={6}
                          className="bg-muted/60 py-2 font-medium"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span>{rotuloMes(g.mes)}</span>
                            <span className="text-sm text-muted-foreground tabular">
                              {g.contas.length}{" "}
                              {g.contas.length === 1 ? "conta" : "contas"} ·{" "}
                              {brl(
                                g.contas.reduce(
                                  (soma, c) => soma + Number(c.valor),
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>

                      {g.contas.map((c) => {
                        const dias = diasAte(c.vencimento);
                        const vencida =
                          !c.pago_em && dias !== null && dias < 0;
                        return (
                          <TableRow key={c.id}>
                            <TableCell
                              className={cn(
                                "tabular",
                                vencida && "font-medium text-red-600",
                              )}
                            >
                              {dataBR(c.vencimento)}
                              {vencida && (
                                <span className="block text-xs">
                                  {Math.abs(dias!)}d de atraso
                                </span>
                              )}
                            </TableCell>

                            <TableCell className="max-w-[240px]">
                              <p className="truncate font-medium">{c.descricao}</p>
                              {c.credor && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {c.credor}
                                </p>
                              )}
                            </TableCell>

                            <TableCell className="hidden text-muted-foreground md:table-cell">
                              {CATEGORIAS_CONTA[c.categoria] ?? c.categoria}
                            </TableCell>

                            <TableCell className="text-right font-medium tabular">
                              {brl(c.valor)}
                              {c.valor_pago != null &&
                                Number(c.valor_pago) !== Number(c.valor) && (
                                  <span className="block text-xs text-muted-foreground">
                                    pago {brl(c.valor_pago)}
                                  </span>
                                )}
                            </TableCell>

                            <TableCell>
                              {c.pago_em ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#e7f2d4] px-2 py-0.5 text-xs font-medium text-[#3f5a15]">
                                  Paga {dataBR(c.pago_em)}
                                  {c.forma ? ` · ${FORMAS_PAGAMENTO[c.forma]}` : ""}
                                </span>
                              ) : vencida ? (
                                <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                                  Vencida
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                                  Em aberto
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                {c.pago_em ? (
                                  <form action={estornarConta}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <Button
                                      type="submit"
                                      variant="ghost"
                                      size="sm"
                                      title="Desfazer baixa"
                                    >
                                      <Undo2 /> Estornar
                                    </Button>
                                  </form>
                                ) : (
                                  <DialogBaixa conta={c} />
                                )}

                                {c.recorrente && (
                                  <form action={repetirNoProximoMes}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <Button
                                      type="submit"
                                      variant="ghost"
                                      size="icon"
                                      title="Criar a mesma conta no mês seguinte"
                                      aria-label="Repetir no próximo mês"
                                    >
                                      <CopyPlus className="size-4" />
                                    </Button>
                                  </form>
                                )}

                                <DialogConta conta={c} />

                                <form action={excluirConta}>
                                  <input type="hidden" name="id" value={c.id} />
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Excluir ${c.descricao}`}
                                  >
                                    <Trash2 className="size-4 text-red-600" />
                                  </Button>
                                </form>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
  destaque,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  destaque?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-semibold tabular",
            destaque && "text-red-700",
          )}
        >
          {valor}
        </p>
        {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}
