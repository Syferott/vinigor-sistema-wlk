import { createClient } from "@/lib/supabase/server";
import { LogoVinigor } from "@/components/logo";
import { FormularioNovaSenha } from "./formulario";

export const metadata = { title: "Definir nova senha" };

export default async function PaginaNovaSenha({
  searchParams,
}: PageProps<"/nova-senha">) {
  const { code } = await searchParams;

  // O link do e-mail chega com ?code= — trocamos por sessão antes do form.
  if (typeof code === "string") {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f6f8f3] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoVinigor tamanho={96} className="mx-auto rounded-xl shadow-sm" />
          <p className="mt-2 text-sm text-muted-foreground">
            {user ? "Defina sua nova senha" : "Link inválido ou expirado"}
          </p>
        </div>
        {user ? (
          <FormularioNovaSenha />
        ) : (
          <p className="rounded-lg border bg-card p-4 text-center text-sm text-muted-foreground">
            Peça um novo link em “Esqueci minha senha” na tela de login.
          </p>
        )}
      </div>
    </main>
  );
}
