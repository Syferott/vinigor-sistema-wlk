export type Papel = "dono" | "operador";

export type StatusOrcamento =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "recusado"
  | "expirado";

export type SituacaoFinanceira = "pago" | "parcial" | "sem_pagamento";

export type TipoPagamento = "sinal" | "parcela" | "quitacao";

export type FormaPagamento =
  | "dinheiro"
  | "pix"
  | "debito"
  | "credito"
  | "boleto"
  | "transferencia";

export type Unidade = "un" | "m2" | "milheiro" | "cento" | "ml" | "kg" | "hora";

export const UNIDADES: Record<Unidade, string> = {
  un: "unidade",
  m2: "m²",
  milheiro: "milheiro",
  cento: "cento",
  ml: "metro linear",
  kg: "kg",
  hora: "hora",
};

export const FORMAS_PAGAMENTO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Cartão de débito",
  credito: "Cartão de crédito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

export const TIPOS_PAGAMENTO: Record<TipoPagamento, string> = {
  sinal: "Sinal",
  parcela: "Parcela",
  quitacao: "Quitação",
};

export const STATUS_ORCAMENTO: Record<
  StatusOrcamento,
  { rotulo: string; classe: string }
> = {
  rascunho: { rotulo: "Rascunho", classe: "bg-muted text-muted-foreground" },
  enviado: { rotulo: "Enviado", classe: "bg-sky-100 text-sky-800" },
  aprovado: { rotulo: "Aprovado", classe: "bg-[#e7f2d4] text-[#3f5a15]" },
  recusado: { rotulo: "Recusado", classe: "bg-red-100 text-red-800" },
  expirado: { rotulo: "Expirado", classe: "bg-amber-100 text-amber-900" },
};

export const SITUACAO_FINANCEIRA: Record<
  SituacaoFinanceira,
  { rotulo: string; emoji: string; classe: string }
> = {
  pago: { rotulo: "Pago", emoji: "🟢", classe: "bg-[#e7f2d4] text-[#3f5a15]" },
  parcial: { rotulo: "Sinal pago", emoji: "🟡", classe: "bg-amber-100 text-amber-900" },
  sem_pagamento: { rotulo: "Sem pagamento", emoji: "🔴", classe: "bg-red-100 text-red-800" },
};

export interface Profile {
  id: string;
  nome: string;
  email: string | null;
  role: Papel;
  ativo: boolean;
  senha_provisoria: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nome: string;
  tipo: "PF" | "PJ";
  documento: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Servico {
  id: string;
  nome: string;
  unidade: Unidade;
  preco_base: number;
  descricao_padrao: string | null;
  ativo: boolean;
  deleted_at: string | null;
}

export interface Coluna {
  id: string;
  slug: string;
  nome: string;
  ordem: number;
  cor: string;
  is_final: boolean;
  is_cancelado: boolean;
  ativo: boolean;
}

export interface ItemOrcamento {
  id: string;
  servico_id: string | null;
  descricao: string;
  especificacoes: Record<string, string> | null;
  quantidade: number;
  preco_unitario: number;
  total: number;
  ordem: number;
}

export interface Orcamento {
  id: string;
  numero: string;
  cliente_id: string;
  status: StatusOrcamento;
  data_orcamento: string;
  validade: string;
  prazo_producao_dias: number | null;
  subtotal: number;
  desconto_tipo: "valor" | "percentual";
  desconto_valor: number;
  total: number;
  observacoes: string | null;
  versao: number;
  orcamento_pai_id: string | null;
  recusado_motivo: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface Pedido {
  id: string;
  numero: string;
  orcamento_id: string | null;
  cliente_id: string;
  coluna_id: string;
  posicao: number;
  prazo_entrega: string | null;
  valor_total: number;
  responsavel_id: string | null;
  observacoes: string | null;
  entregue_em: string | null;
  entregue_com_saldo: boolean;
  justificativa_saldo: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface PedidoFinanceiro {
  pedido_id: string;
  numero: string;
  cliente_id: string;
  valor_total: number;
  total_pago: number;
  saldo_devedor: number;
  situacao: SituacaoFinanceira;
}

export interface Pagamento {
  id: string;
  pedido_id: string;
  tipo: TipoPagamento;
  valor: number;
  forma: FormaPagamento;
  data_pagamento: string;
  recebido_por: string | null;
  observacao: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface HistoricoPreco {
  cliente_id: string;
  servico_id: string | null;
  descricao: string;
  pedido_id: string;
  pedido_numero: string;
  data: string;
  quantidade: number;
  preco_unitario: number;
  total: number;
}

/** Card do quadro, já com o financeiro e o cliente resolvidos. */
export interface CardPedido extends Pedido {
  cliente_nome: string;
  responsavel_nome: string | null;
  resumo: string;
  total_pago: number;
  saldo_devedor: number;
  situacao: SituacaoFinanceira;
}
