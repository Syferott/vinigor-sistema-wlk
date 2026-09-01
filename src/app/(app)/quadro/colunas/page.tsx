import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { BotaoLink } from "@/components/botao-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { atualizarColuna, criarColuna, moverColuna } from "./_actions";
import { AlertCircle, ArrowLeft, ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { Coluna } from "@/lib/types";

export const metadata = { title: "Colunas do quadro" };

/** Colunas que o sistema movimenta sozinho — o banco recusa desativar. */
const DO_SISTEMA = new Set(["aprovado", "entregue", "concluido", "cancelado"]);

export default async function PaginaColunas({
  searchParams,
}: PageProps<"/quadro/colunas">) {
  await requerDono();
  const { erro } = await searchParams;
  const supabase = await createClient();

  const [{ data: colunas }, { data: pedidos }] = await Promise.all([
    supabase.from("colunas").select("*").order("ordem"),
    supabase.from("pedidos").select("coluna_id").is("deleted_at", null),
  ]);

  const lista = (colunas ?? []) as Coluna[];

  const cards = new Map<string, number>();
  for (const p of (pedidos ?? []) as { coluna_id: string }[]) {
    cards.set(p.coluna_id, (cards.get(p.coluna_id) ?? 0) + 1);
  }

  return (
    <>
      <CabecalhoPagina
        titulo="Colunas do quadro"
        descricao="A fila da produção, do jeito da casa: nome, cor e ordem."
      >
        <BotaoLink variant="ghost" href="/quadro">
          <ArrowLeft /> Voltar ao quadro
        </BotaoLink>
      </CabecalhoPagina>

      <Conteudo className="grid max-w-3xl gap-6">
        {typeof erro === "string" && (
          <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {decodeURIComponent(erro)}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border bg-card">
          <ul>
            {lista.map((c, i) => {
              const qtdCards = cards.get(c.id) ?? 0;
              const doSistema = DO_SISTEMA.has(c.slug);

              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-2 border-b p-3 last:border-b-0"
                >
                  <form
                    action={atualizarColuna}
                    className="flex flex-1 flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="id" value={c.id} />

                    <input
                      type="color"
                      name="cor"
                      defaultValue={c.cor}
                      aria-label={`Cor de ${c.nome}`}
                      className="h-9 w-10 cursor-pointer rounded-md border bg-transparent p-1"
                    />

                    <Input
                      name="nome"
                      defaultValue={c.nome}
                      aria-label={`Nome de ${c.nome}`}
                      className="w-full sm:w-56"
                    />

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="ativo"
                        defaultChecked={c.ativo}
                        disabled={doSistema}
                        className="size-4 accent-[#8cc63e]"
                      />
                      No quadro
                    </label>

                    <span className="text-xs text-muted-foreground">
                      {qtdCards === 0
                        ? "vazia"
                        : `${qtdCards} ${qtdCards === 1 ? "pedido" : "pedidos"}`}
                      {doSistema && " · do sistema"}
                    </span>

                    <Button type="submit" variant="outline" size="sm">
                      Salvar
                    </Button>
                  </form>

                  <div className="flex items-center">
                    <form action={moverColuna}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="direcao" value="cima" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        disabled={i === 0}
                        aria-label={`Subir ${c.nome}`}
                      >
                        <ChevronUp />
                      </Button>
                    </form>

                    <form action={moverColuna}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="direcao" value="baixo" />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        disabled={i === lista.length - 1}
                        aria-label={`Descer ${c.nome}`}
                      >
                        <ChevronDown />
                      </Button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nova coluna</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={criarColuna} className="flex flex-wrap items-end gap-2">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  name="nome"
                  placeholder="Ex.: Aguardando material"
                  className="w-full sm:w-64"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cor">Cor</Label>
                <input
                  id="cor"
                  type="color"
                  name="cor"
                  defaultValue="#8CC63E"
                  className="h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
                />
              </div>

              <Button type="submit">
                <Plus /> Criar coluna
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">O que o banco não deixa</p>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            <li>
              Tirar do quadro uma coluna com pedido dentro — o card sumiria
              junto. Mova os cards primeiro.
            </li>
            <li>
              Tirar do quadro Aprovado, Entregue, Concluído ou Cancelado: são
              as quatro que o sistema movimenta sozinho, na venda de balcão,
              na aprovação do orçamento e na conclusão da venda.
            </li>
            <li>
              Excluir coluna. Pedido antigo aponta para ela, e o histórico
              precisa continuar fazendo sentido — desative em vez de excluir.
            </li>
          </ul>
        </div>
      </Conteudo>
    </>
  );
}
