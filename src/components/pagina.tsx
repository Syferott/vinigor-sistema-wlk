import { cn } from "@/lib/utils";

export function CabecalhoPagina({
  titulo,
  descricao,
  children,
  className,
}: {
  titulo: string;
  descricao?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-0.5 text-sm text-muted-foreground">{descricao}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function Conteudo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-4 sm:p-6", className)}>{children}</div>;
}
