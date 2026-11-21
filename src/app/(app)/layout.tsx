import { requerAuth } from "@/lib/auth";
import { Navegacao } from "@/components/navegacao";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const perfil = await requerAuth();

  return (
    <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
      <Navegacao perfil={perfil} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
