import Image from "next/image";
import { cn } from "@/lib/utils";

/** Altura ÷ largura do arquivo (474 × 377). */
const PROPORCAO = 377 / 474;

/**
 * Marca da VINIGOR, em duas versões do mesmo desenho: a tinta clara é
 * branca, a escura é o cinza #4a4a4a. Só muda o "V", o "VINI" e o
 * "GRÁFICA" — o verde é o mesmo nos dois.
 *
 * `tema` é o fundo em que a marca vai pousar, não a cor dela: em fundo
 * escuro entra a versão branca. Trocar isso apaga metade do logotipo,
 * porque cada versão some no fundo da outra.
 *
 * O arquivo já traz o nome por extenso, então não precisa de texto ao
 * lado — mas também não sobrevive a tamanhos pequenos: abaixo de ~120px
 * de largura o "GRÁFICA" vira borrão.
 */
export function LogoVinigor({
  largura = 160,
  tema = "claro",
  className,
}: {
  largura?: number;
  tema?: "claro" | "escuro";
  className?: string;
}) {
  return (
    <Image
      src={tema === "escuro" ? "/logo-vinigor-branca.png" : "/logo-vinigor.png"}
      alt="VINIGOR Gráfica"
      width={largura}
      height={Math.round(largura * PROPORCAO)}
      priority
      className={cn("shrink-0 object-contain", className)}
    />
  );
}

/**
 * Nome por extenso, em texto. Fica para onde a marca não cabe — favicon
 * grande, assinatura de e-mail, cabeçalho apertado.
 */
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
