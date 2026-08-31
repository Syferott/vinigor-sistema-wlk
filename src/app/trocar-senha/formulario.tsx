"use client";

import { useActionState } from "react";
import { trocarSenha, type EstadoTroca } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BotaoLink } from "@/components/botao-link";
import { AlertCircle, Loader2 } from "lucide-react";

export function FormularioTrocaSenha({
  obrigatoria,
}: {
  obrigatoria: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoTroca, FormData>(
    trocarSenha,
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
              autoFocus
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Ao menos 8 caracteres.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="confirmacao">Repita a senha</Label>
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
            <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {estado.erro}
            </p>
          )}

          <Button type="submit" disabled={enviando}>
            {enviando && <Loader2 className="animate-spin" />}
            Salvar senha
          </Button>

          {!obrigatoria && (
            <BotaoLink variant="ghost" href="/quadro">
              Cancelar
            </BotaoLink>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
