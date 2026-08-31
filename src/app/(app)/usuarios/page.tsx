import { createClient } from "@/lib/supabase/server";
import { requerDono } from "@/lib/auth";
import { CabecalhoPagina, Conteudo } from "@/components/pagina";
import { DialogNovoUsuario } from "./formulario";
import { alternarAtivo, atualizarUsuario } from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dataBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { AlertCircle, Crown } from "lucide-react";
import type { Profile } from "@/lib/types";

export const metadata = { title: "Usuários" };

export default async function PaginaUsuarios({
  searchParams,
}: PageProps<"/usuarios">) {
  const dono = await requerDono();
  const { erro } = await searchParams;
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo, senha_provisoria, created_at")
    .order("ativo", { ascending: false })
    .order("role")
    .order("nome");

  const usuarios = (data ?? []) as Profile[];
  const donos = usuarios.filter((u) => u.role === "dono" && u.ativo).length;
  const operadores = usuarios.filter((u) => u.role === "operador" && u.ativo).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Usuários"
        descricao={`${donos} ${donos === 1 ? "dono" : "donos"} · ${operadores} ${operadores === 1 ? "operador" : "operadores"} ativos`}
      >
        <DialogNovoUsuario />
      </CabecalhoPagina>

      <Conteudo className="grid gap-4">
        {erro === "ultimo-dono" && (
          <p className="flex items-center gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            <AlertCircle className="size-4 shrink-0" />
            Precisa sobrar pelo menos um dono ativo. Promova outra pessoa a dono
            antes de rebaixar ou desativar esta.
          </p>
        )}

        <div className="rounded-lg border bg-card p-4 text-sm">
          <p className="font-medium">Quem vê o quê</p>
          <ul className="mt-2 grid gap-1 text-muted-foreground sm:grid-cols-2">
            <li>
              <strong className="text-foreground">Dono</strong> — tudo:
              relatórios de faturamento, contas a receber, ranking e cadastro de
              usuários.
            </li>
            <li>
              <strong className="text-foreground">Operador</strong> — clientes,
              orçamentos, quadro e pagamentos. Vê o valor de cada pedido, mas
              nunca os totais da empresa.
            </li>
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Pode existir mais de um dono. Para promover alguém, mude o perfil na
            linha e clique em Salvar.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                <TableHead className="w-44">Perfil</TableHead>
                <TableHead className="hidden md:table-cell">Desde</TableHead>
                <TableHead className="w-40 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => {
                const souEu = u.id === dono.id;
                return (
                  <TableRow key={u.id} className={u.ativo ? "" : "opacity-55"}>
                    <TableCell>
                      <form
                        action={atualizarUsuario}
                        className="flex items-center gap-2"
                        id={`form-${u.id}`}
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <Input
                          name="nome"
                          defaultValue={u.nome}
                          className="h-8 max-w-[200px]"
                          aria-label={`Nome de ${u.nome}`}
                        />
                      </form>
                      {souEu && (
                        <span className="text-xs text-muted-foreground">
                          você
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {u.email ?? "—"}
                    </TableCell>

                    <TableCell>
                      {souEu ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f2d4] px-2.5 py-1 text-xs font-medium text-[#3f5a15]">
                          <Crown className="size-3.5" />
                          Dono
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <select
                            name="role"
                            form={`form-${u.id}`}
                            defaultValue={u.role}
                            className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                            aria-label={`Perfil de ${u.nome}`}
                          >
                            <option value="operador">Operador</option>
                            <option value="dono">Dono</option>
                          </select>
                          {u.role === "dono" && (
                            <Crown
                              className="size-4 shrink-0 text-[#5b8f1f]"
                              aria-hidden
                            />
                          )}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="hidden tabular md:table-cell">
                      {dataBR(u.created_at)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="submit"
                          form={`form-${u.id}`}
                          variant="outline"
                          size="sm"
                        >
                          Salvar
                        </Button>
                        {!souEu && (
                          <form action={alternarAtivo}>
                            <input type="hidden" name="id" value={u.id} />
                            <input
                              type="hidden"
                              name="ativo"
                              value={u.ativo ? "0" : "1"}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className={cn(u.ativo && "text-muted-foreground")}
                            >
                              {u.ativo ? "Desativar" : "Reativar"}
                            </Button>
                          </form>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Conteudo>
    </>
  );
}
