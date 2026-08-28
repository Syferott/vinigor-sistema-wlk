"use client";

import { useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { entrar, recuperarSenha, type EstadoLogin } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function FormularioLogin() {
  const params = useSearchParams();
  const [modo, setModo] = useState<"login" | "recuperar">("login");

  const [estadoLogin, acaoLogin, enviandoLogin] = useActionState<
    EstadoLogin,
    FormData
  >(entrar, {});
  const [estadoRec, acaoRec, enviandoRec] = useActionState<
    EstadoLogin,
    FormData
  >(recuperarSenha, {});

  const erroUrl =
    params.get("erro") === "inativo"
      ? "Seu acesso foi desativado. Fale com o dono."
      : null;

  if (modo === "recuperar") {
    return (
      <Card>
        <CardContent className="pt-6">
          <form action={acaoRec} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email-rec">E-mail</Label>
              <Input
                id="email-rec"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <Mensagem erro={estadoRec.erro} ok={estadoRec.ok} />

            <Button type="submit" disabled={enviandoRec}>
              {enviandoRec && <Loader2 className="animate-spin" />}
              Enviar link de recuperação
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setModo("login")}
            >
              Voltar
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={acaoLogin} className="grid gap-4">
          <input
            type="hidden"
            name="redirect"
            value={params.get("redirect") ?? "/quadro"}
          />
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          <Mensagem erro={estadoLogin.erro ?? erroUrl ?? undefined} />

          <Button type="submit" disabled={enviandoLogin}>
            {enviandoLogin && <Loader2 className="animate-spin" />}
            Entrar
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setModo("recuperar")}
          >
            Esqueci minha senha
          </button>
        </form>
      </CardContent>
    </Card>
  );
}

function Mensagem({ erro, ok }: { erro?: string; ok?: string }) {
  if (erro)
    return (
      <p className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        {erro}
      </p>
    );
  if (ok)
    return (
      <p className="flex items-start gap-2 rounded-md bg-[#e7f2d4] p-3 text-sm text-[#3f5a15]">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        {ok}
      </p>
    );
  return null;
}
