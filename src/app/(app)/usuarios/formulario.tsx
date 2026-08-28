"use client";

import { useActionState, useState } from "react";
import { criarUsuario, type EstadoUsuario } from "./_actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

export function DialogNovoUsuario() {
  const [aberto, setAberto] = useState(false);

  const [estado, acao, enviando] = useActionState<EstadoUsuario, FormData>(
    async (anterior, dados) => {
      const resultado = await criarUsuario(anterior, dados);
      if (resultado.ok) {
        toast.success(resultado.ok);
        setAberto(false);
      }
      return resultado;
    },
    {},
  );

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger render={<Button />}>
        <UserPlus /> Novo usuário
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <form action={acao} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>
              Login individual. Sem isso, o log de auditoria e o “quem recebeu o
              pagamento” perdem o valor.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" name="nome" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="senha">Senha provisória *</Label>
            <Input
              id="senha"
              name="senha"
              type="text"
              minLength={8}
              required
              placeholder="mínimo 8 caracteres"
            />
            <p className="text-xs text-muted-foreground">
              Passe para a pessoa; ela troca depois em “Esqueci minha senha”.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Perfil</Label>
            <select
              id="role"
              name="role"
              defaultValue="operador"
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="operador">Operador — balcão, arte, produção</option>
              <option value="dono">Dono — acesso total, vê relatórios</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Pode haver mais de um dono. Escolha <strong>Dono</strong> para dar
              acesso a faturamento, contas a receber e cadastro de usuários.
            </p>
          </div>

          {estado.erro && (
            <p className="rounded-md bg-red-50 p-2 text-sm text-red-800">
              {estado.erro}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={enviando}>
              {enviando && <Loader2 className="animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
