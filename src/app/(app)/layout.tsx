import { requerAuth } from "@/lib/auth";
import { Navegacao } from "@/components/navegacao";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const perfil = await requerAuth();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <Navegacao perfil={perfil} />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
