import { Suspense } from "react";
import { FormularioLogin } from "./formulario";
import { Logo } from "@/components/logo";

export const metadata = { title: "Entrar · VINIGOR" };

export default function PaginaLogin() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#f6f8f3] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="text-3xl" />
          <p className="mt-2 text-sm text-muted-foreground">
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
