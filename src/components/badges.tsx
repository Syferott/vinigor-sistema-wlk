import { cn } from "@/lib/utils";
import {
  SITUACAO_FINANCEIRA,
  STATUS_ORCAMENTO,
  type SituacaoFinanceira,
  type StatusOrcamento,
} from "@/lib/types";

const base =
  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function BadgeStatus({ status }: { status: StatusOrcamento }) {
  const s = STATUS_ORCAMENTO[status] ?? STATUS_ORCAMENTO.rascunho;
  return <span className={cn(base, s.classe)}>{s.rotulo}</span>;
}

export function BadgeFinanceiro({
  situacao,
  className,
}: {
  situacao: SituacaoFinanceira;
  className?: string;
}) {
  const s = SITUACAO_FINANCEIRA[situacao] ?? SITUACAO_FINANCEIRA.sem_pagamento;
  return (
    <span className={cn(base, s.classe, className)}>
      <span aria-hidden>{s.emoji}</span>
      {s.rotulo}
    </span>
  );
}
