import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { GraficoFaturamento, type PontoMes } from "./grafico";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl, MESES, MESES_LONGOS, variacao } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export const metadata = { title: "Relatórios" };

type LinhaMes = {
  ano: number;
  mes: number;
  total_vendido: number;
  total_recebido: number;
  qtd_pedidos: number;
  ticket_medio: number;
};

export default async function PaginaRelatorios({
  searchParams,
}: PageProps<"/relatorios">) {
  await requerDono();
  const { ano: anoParam } = await searchParams;
  const supabase = await createClient();

  const [{ data: faturamento }, { data: aReceber }] = await Promise.all([
    supabase
      .from("vw_faturamento_mensal")
      .select("ano, mes, total_vendido, total_recebido, qtd_pedidos, ticket_medio")
      .order("ano")
      .order("mes"),
    supabase.from("vw_contas_receber").select("saldo_devedor"),
  ]);

  const linhas = (faturamento ?? []) as LinhaMes[];

  const anosDisponiveis = [...new Set(linhas.map((l) => l.ano))].sort(
    (a, b) => b - a,
  );
  const anoAtual = new Date().getFullYear();
  const anoSelecionado =
    Number(anoParam) || anosDisponiveis[0] || anoAtual;
  const anoAnterior = anoSelecionado - 1;

  const doAno = (ano: number) => linhas.filter((l) => l.ano === ano);
  const buscarMes = (ano: number, mes: number) =>
    linhas.find((l) => l.ano === ano && l.mes === mes);

  const dados: PontoMes[] = MESES.map((rotulo, i) => {
    const mes = i + 1;
    return {
      mes: rotulo,
      vendido: Number(buscarMes(anoSelecionado, mes)?.total_vendido ?? 0),
      recebido: Number(buscarMes(anoSelecionado, mes)?.total_recebido ?? 0),
      vendidoAnterior: Number(buscarMes(anoAnterior, mes)?.total_vendido ?? 0),
    };
  });

  const soma = (ano: number, campo: keyof LinhaMes) =>
    doAno(ano).reduce((s, l) => s + Number(l[campo]), 0);

  const vendidoAno = soma(anoSelecionado, "total_vendido");
  const recebidoAno = soma(anoSelecionado, "total_recebido");
  const pedidosAno = soma(anoSelecionado, "qtd_pedidos");
  const vendidoAnterior = soma(anoAnterior, "total_vendido");
  const ticketMedio = pedidosAno > 0 ? vendidoAno / pedidosAno : 0;
  const totalAReceber = (
    (aReceber ?? []) as { saldo_devedor: number }[]
  ).reduce((s, l) => s + Number(l.saldo_devedor), 0);

  const comMovimento = dados
    .map((d, i) => ({ ...d, indice: i }))
    .filter((d) => d.vendido > 0);
  const maisForte = comMovimento.length
    ? comMovimento.reduce((a, b) => (b.vendido > a.vendido ? b : a))
    : null;
  const maisFraco = comMovimento.length
    ? comMovimento.reduce((a, b) => (b.vendido < a.vendido ? b : a))
    : null;

  const delta = variacao(vendidoAno, vendidoAnterior);

  if (linhas.length === 0) {
    return (
      <>
        <CabecalhoPagina titulo="Relatórios" />
        <Conteudo>
          <EstadoVazio
            titulo="Ainda não há faturamento para relatar"
            descricao="Aprove o primeiro orçamento e registre o primeiro pagamento — os números aparecem aqui automaticamente."
          />
        </Conteudo>
      </>
    );
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Relatórios"
        descricao="Visão exclusiva do dono. O operador não enxerga estes números."
      >
        <nav className="flex flex-wrap gap-2">
          {anosDisponiveis.map((a) => (
            <Link
              key={a}
              href={`/relatorios?ano=${a}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm tabular transition-colors",
                a === anoSelecionado
                  ? "border-[#8cc63e] bg-[#8cc63e] font-medium text-[#1b2410]"
                  : "border-border bg-card hover:bg-accent",
              )}
            >
              {a}
            </Link>
          ))}
        </nav>
      </CabecalhoPagina>

      <Conteudo className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador
            rotulo={`Vendido em ${anoSelecionado}`}
            valor={brl(vendidoAno)}
            nota={
              delta === null
                ? `sem base de ${anoAnterior}`
                : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% vs ${anoAnterior}`
            }
            tendencia={delta === null ? undefined : delta >= 0 ? "alta" : "baixa"}
          />
          <Indicador
            rotulo={`Recebido em ${anoSelecionado}`}
            valor={brl(recebidoAno)}
            nota="dinheiro que entrou no caixa"
          />
          <Indicador
            rotulo="Total a receber"
            valor={brl(totalAReceber)}
            nota="saldo em aberto hoje"
          />
          <Indicador
            rotulo="Ticket médio"
            valor={brl(ticketMedio)}
            nota={`${pedidosAno} ${pedidosAno === 1 ? "pedido" : "pedidos"} no ano`}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Faturamento mês a mês — {anoSelecionado}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GraficoFaturamento dados={dados} ano={anoSelecionado} />
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Mês mais forte
              </p>
              <p className="mt-1 text-lg font-semibold">
                {maisForte ? MESES_LONGOS[maisForte.indice] : "—"}
              </p>
              <p className="text-sm text-muted-foreground tabular">
                {maisForte ? brl(maisForte.vendido) : "sem movimento"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Mês mais fraco
              </p>
              <p className="mt-1 text-lg font-semibold">
                {maisFraco ? MESES_LONGOS[maisFraco.indice] : "—"}
              </p>
              <p className="text-sm text-muted-foreground tabular">
                {maisFraco ? brl(maisFraco.vendido) : "sem movimento"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* A mesma informação do gráfico, em tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento mensal</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto scroll-fino">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês</TableHead>
                    <TableHead className="text-right">Vendido</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Ticket médio</TableHead>
                    <TableHead className="text-right">
                      Vendido {anoAnterior}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados.map((d, i) => {
                    const linha = buscarMes(anoSelecionado, i + 1);
                    return (
                      <TableRow key={d.mes}>
                        <TableCell className="font-medium">
                          {MESES_LONGOS[i]}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {brl(d.vendido)}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {brl(d.recebido)}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {linha?.qtd_pedidos ?? 0}
                        </TableCell>
                        <TableCell className="text-right tabular">
                          {brl(linha?.ticket_medio ?? 0)}
                        </TableCell>
                        <TableCell className="text-right tabular text-muted-foreground">
                          {brl(d.vendidoAnterior)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Conteudo>
    </>
  );
}

function Indicador({
  rotulo,
  valor,
  nota,
  tendencia,
}: {
  rotulo: string;
  valor: string;
  nota?: string;
  tendencia?: "alta" | "baixa";
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular">{valor}</p>
        {nota && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs",
              tendencia === "alta" && "text-[#3f5a15]",
              tendencia === "baixa" && "text-red-700",
              !tendencia && "text-muted-foreground",
            )}
          >
            {tendencia === "alta" && <TrendingUp className="size-3.5" />}
            {tendencia === "baixa" && <TrendingDown className="size-3.5" />}
            {nota}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
