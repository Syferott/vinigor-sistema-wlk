"use client";

import { useActionState } from "react";
import { definirSenha, type EstadoSenha } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export function FormularioNovaSenha() {
  const [estado, acao, enviando] = useActionState<EstadoSenha, FormData>(
    definirSenha,
    {},
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={acao} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirmacao">Confirme a senha</Label>
            <Input
              id="confirmacao"
              name="confirmacao"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </div>

          {estado.erro && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {estado.erro}
            </p>
          )}

          <Button type="submit" disabled={enviando}>
            {enviando && <Loader2 className="animate-spin" />}
            Salvar senha
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
