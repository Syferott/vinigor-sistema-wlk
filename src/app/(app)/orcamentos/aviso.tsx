"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Confirma a exclusão depois do redirect (?excluido=1). */
export function AvisoExclusao({ excluido }: { excluido: boolean }) {
  useEffect(() => {
    if (excluido) {
      toast.success(
        "Orçamento excluído. O registro continua guardado na auditoria.",
      );
    }
  }, [excluido]);

  return null;
}
