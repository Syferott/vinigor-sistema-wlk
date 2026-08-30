import Image from "next/image";
import { cn } from "@/lib/utils";

const ARQUIVO = "/logo-vinigor.jpeg";

/**
 * Logo oficial da VINIGOR (225x225, JPEG com fundo claro próprio).
 *
 * Por ter fundo — não é PNG com transparência — ela não pode ser colada
 * direto sobre a barra escura: viraria um quadrado branco. Onde o fundo
 * é escuro, ela entra como ladrilho arredondado (lê como selo, de
 * propósito) acompanhada do nome em texto, que é o que fica legível em
 * tamanho pequeno.
 */
export function LogoVinigor({
  tamanho = 40,
  className,
}: {
  tamanho?: number;
  className?: string;
}) {
  return (
    <Image
      src={ARQUIVO}
      alt="VINIGOR Gráfica"
      width={tamanho}
      height={tamanho}
      priority
      className={cn("shrink-0 rounded-lg object-contain", className)}
    />
  );
}

/** Nome por extenso. Usado ao lado da marca onde ela aparece reduzida. */
export function NomeVinigor({
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
