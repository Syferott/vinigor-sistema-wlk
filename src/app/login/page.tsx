import { Suspense } from "react";
import { FormularioLogin } from "./formulario";
import { LogoVinigor } from "@/components/logo";

export const metadata = { title: "Entrar · VINIGOR" };

export default function PaginaLogin() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f6f8f3] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoVinigor tamanho={96} className="mx-auto rounded-xl shadow-sm" />
          <p className="mt-3 text-sm text-muted-foreground">
            Sistema de gestão da gráfica
          </p>
        </div>
        <Suspense>
          <FormularioLogin />
        </Suspense>
      </div>
    </main>
  );
}
