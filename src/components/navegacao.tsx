"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Columns3,
  ShoppingCart,
  FileText,
  Users,
  Package,
  Wallet,
  Receipt,
  CheckCheck,
  BarChart3,
  UserCog,
  LogOut,
  Menu,
  X,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoVinigor, NomeVinigor } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { sair } from "@/app/login/actions";
import type { Profile } from "@/lib/types";

type Item = {
  href: string;
  rotulo: string;
  icone: React.ComponentType<{ className?: string }>;
  somenteDono?: boolean;
};

const ITENS: Item[] = [
  { href: "/quadro", rotulo: "Quadro", icone: Columns3 },
  { href: "/balcao", rotulo: "Venda balcão", icone: ShoppingCart },
  { href: "/orcamentos", rotulo: "Orçamentos", icone: FileText },
  { href: "/clientes", rotulo: "Clientes", icone: Users },
  { href: "/servicos", rotulo: "Serviços", icone: Package },
  { href: "/financeiro", rotulo: "Contas a receber", icone: Wallet, somenteDono: true },
  { href: "/contas-pagar", rotulo: "Contas a pagar", icone: Receipt, somenteDono: true },
  {
    href: "/vendas-concluidas",
    rotulo: "Vendas concluídas",
    icone: CheckCheck,
    somenteDono: true,
  },
  { href: "/relatorios", rotulo: "Relatórios", icone: BarChart3, somenteDono: true },
  { href: "/usuarios", rotulo: "Usuários", icone: UserCog, somenteDono: true },
];

export function Navegacao({ perfil }: { perfil: Profile }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const itens = ITENS.filter((i) => !i.somenteDono || perfil.role === "dono");

  return (
    <>
      {/* Topo mobile */}
      <header className="flex items-center justify-between border-b bg-[#4a4a4a] px-4 py-3 md:hidden">
        <Link href="/quadro" className="flex items-center gap-2">
          <LogoVinigor tamanho={32} />
          <NomeVinigor tema="escuro" className="text-lg" />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10 hover:text-white"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? "Fechar menu" : "Abrir menu"}
        >
          {aberto ? <X /> : <Menu />}
        </Button>
      </header>

      <nav
        className={cn(
          "z-30 shrink-0 flex-col bg-[#4a4a4a] text-[#f2f4ef] md:flex md:w-60",
          aberto ? "flex" : "hidden md:flex",
        )}
      >
        <div className="hidden items-center gap-2 px-5 py-5 md:flex">
          <LogoVinigor tamanho={40} />
          <NomeVinigor tema="escuro" className="text-xl" />
        </div>

        <ul className="flex flex-1 flex-col gap-1 p-3">
          {itens.map(({ href, rotulo, icone: Icone, somenteDono }) => {
            const ativo = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setAberto(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    ativo
                      ? "bg-[#8cc63e] text-[#1b2410]"
                      : "text-[#d6dad1] hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icone className="size-4 shrink-0" />
                  <span className="flex-1">{rotulo}</span>
                  {somenteDono && !ativo && (
                    <span
                      className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b9c3ac]"
                      title="Visível apenas para o dono"
                    >
                      dono
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-white/10 p-3">
          <div className="px-2 pb-2">
            <p className="truncate text-sm font-medium text-white">
              {perfil.nome}
            </p>
            <p className="text-xs capitalize text-[#b9c3ac]">{perfil.role}</p>
          </div>
          <Link
            href="/trocar-senha"
            onClick={() => setAberto(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#d6dad1] transition-colors hover:bg-white/10 hover:text-white"
          >
            <KeyRound className="size-4 shrink-0" />
            Alterar minha senha
          </Link>

          <form action={sair}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-3 px-3 text-[#d6dad1] hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-4" />
              Sair
            </Button>
          </form>
        </div>
      </nav>
    </>
  );
}
