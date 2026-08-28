import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";

type PropsBotao = Omit<
  ComponentProps<typeof Button>,
  "render" | "nativeButton" | "href"
>;

/**
 * Botão que navega. Existe para concentrar num lugar só o detalhe do Base UI:
 * o Button dele assume `nativeButton`, e renderizar uma âncora sem avisar
 * derruba a semântica de botão (e dispara warning no dev).
 *
 * Href externo (http…) vira <a> em nova aba; interno vira <Link> do Next.
 */
export function BotaoLink({
  href,
  novaAba,
  ...props
}: PropsBotao & { href: string; novaAba?: boolean }) {
  const externo = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:");

  return (
    <Button
      nativeButton={false}
      render={
        externo ? (
          <a href={href} target="_blank" rel="noreferrer" />
        ) : novaAba ? (
          <Link href={href} target="_blank" rel="noreferrer" />
        ) : (
          <Link href={href} />
        )
      }
      {...props}
    />
  );
}
