import { cn } from "@/lib/utils";

export function EstadoVazio({
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
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center",
        className,
      )}
    >
      <p className="font-medium">{titulo}</p>
      {descricao && (
        <p className="max-w-sm text-sm text-muted-foreground">{descricao}</p>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}
