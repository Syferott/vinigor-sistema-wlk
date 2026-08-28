import { cn } from "@/lib/utils";

/**
 * Marca VINIGOR. Placeholder tipográfico — trocar pelo arquivo oficial
 * em /public/logo.svg quando a gráfica enviar o vetor.
 */
export function Logo({
  className,
  tema = "claro",
}: {
  className?: string;
  tema?: "claro" | "escuro";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline gap-[2px] font-extrabold tracking-tight select-none",
        tema === "claro" ? "text-[#4a4a4a]" : "text-white",
        className,
      )}
    >
      <span>VINI</span>
      <span className="text-[#8cc63e]">GOR</span>
    </span>
  );
}

export function LogoMarca({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#8cc63e] text-[15px] font-extrabold text-[#1b2410]",
        className,
      )}
      aria-hidden
    >
      VG
    </span>
  );
}
