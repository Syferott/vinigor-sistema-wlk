import { createClient } from "@/lib/supabase/server";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { EstadoVazio } from "@/components/vazio";
import { DialogServico } from "./formulario";
import { alternarAtivo } from "./_actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { brl } from "@/lib/format";
import { UNIDADES, type Servico } from "@/lib/types";

export const metadata = { title: "Serviços" };

export default async function PaginaServicos() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("servicos")
    .select("*")
    .is("deleted_at", null)
    .order("ativo", { ascending: false })
    .order("nome");

  const servicos = (data ?? []) as Servico[];

  return (
    <>
      <CabecalhoPagina
        titulo="Catálogo de serviços"
        descricao="Preço-base é referência para o orçamento — nunca uma trava."
      >
        <DialogServico />
      </CabecalhoPagina>

      <Conteudo>
        {servicos.length === 0 ? (
          <EstadoVazio
            titulo="Catálogo vazio"
            descricao="Cadastre os serviços recorrentes da gráfica: banner, adesivo, cartão de visita, panfleto…"
          >
            <DialogServico />
          </EstadoVazio>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="hidden sm:table-cell">Unidade</TableHead>
                  <TableHead className="text-right">Preço-base</TableHead>
                  <TableHead className="w-28 text-right">Situação</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {servicos.map((s) => (
                  <TableRow key={s.id} className={s.ativo ? "" : "opacity-55"}>
                    <TableCell>
                      <p className="font-medium">{s.nome}</p>
                      {s.descricao_padrao && (
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {s.descricao_padrao}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {UNIDADES[s.unidade] ?? s.unidade}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular">
                      {brl(s.preco_base)}
                    </TableCell>
                    <TableCell className="text-right">
                      <form action={alternarAtivo}>
                        <input type="hidden" name="id" value={s.id} />
                        <input
                          type="hidden"
                          name="ativo"
                          value={s.ativo ? "0" : "1"}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                        >
                          {s.ativo ? "Ativo" : "Inativo"}
                        </Button>
                      </form>
                    </TableCell>
                    <TableCell>
                      <DialogServico servico={s} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Conteudo>
    </>
  );
}
