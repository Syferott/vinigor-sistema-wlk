import { redirect } from "next/navigation";
import { perfilAtual } from "@/lib/auth";
import { LogoVinigor } from "@/components/logo";
import { FormularioTrocaSenha } from "./formulario";

export const metadata = { title: "Definir senha" };

/**
 * Usa perfilAtual() em vez de requerAuth() de propósito: é requerAuth que
 * manda para cá quando a senha é provisória, e chamá-lo aqui viraria laço.
 */
export default async function PaginaTrocarSenha() {
  const perfil = await perfilAtual();
  if (!perfil) redirect("/login");
  if (!perfil.ativo) redirect("/login?erro=inativo");

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f6f8f3] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoVinigor largura={180} className="mx-auto" />
          <h1 className="mt-4 text-lg font-semibold">
            {perfil.senha_provisoria ? "Crie sua senha" : "Alterar senha"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {perfil.senha_provisoria
              ? `Olá, ${perfil.nome.split(" ")[0]}. A senha que você recebeu é provisória e quem a criou também a conhece. Escolha uma que só você saiba.`
              : "Escolha uma nova senha para a sua conta."}
          </p>
        </div>

        <FormularioTrocaSenha obrigatoria={perfil.senha_provisoria} />
      </div>
    </main>
  );
}
