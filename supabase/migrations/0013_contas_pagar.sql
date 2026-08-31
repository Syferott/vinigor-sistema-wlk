-- =====================================================================
-- VINIGOR — 0013: contas a pagar
--
-- Boleto de fornecedor, luz, água, aluguel. Fica ao lado de Contas a
-- receber e, como ela, é exclusivo do dono: é a saída de caixa da
-- empresa, não informação de balcão.
--
-- Não alimenta os relatórios de faturamento. Vendido e Recebido
-- continuam medindo entrada; misturar despesa ali viraria margem, que
-- é fase 3 do PRD e precisa também de custo por pedido.
-- =====================================================================

create table public.contas_pagar (
  id          uuid primary key default gen_random_uuid(),
  descricao   text not null,
  credor      text,
  categoria   text not null default 'outro'
              check (categoria in ('fornecedor','energia','agua','aluguel','internet',
                                   'telefone','imposto','salario','manutencao','material','outro')),
  valor       numeric(12,2) not null check (valor > 0),
  vencimento  date not null,

  pago_em     date,
  valor_pago  numeric(12,2) check (valor_pago is null or valor_pago > 0),
  forma       text check (forma in ('dinheiro','pix','debito','credito','boleto','transferencia')),

  observacao  text,
  recorrente  boolean not null default false,

  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  -- dar baixa exige data e valor juntos; nunca um sem o outro
  constraint baixa_completa check (
    (pago_em is null and valor_pago is null) or
    (pago_em is not null and valor_pago is not null)
  )
);

create index idx_contas_pagar_vencimento on public.contas_pagar (vencimento)
  where deleted_at is null and pago_em is null;
create index idx_contas_pagar_pagas on public.contas_pagar (pago_em)
  where deleted_at is null and pago_em is not null;

create trigger tg_contas_pagar_touch before update on public.contas_pagar
  for each row execute function public.fn_touch_updated_at();
create trigger tg_contas_pagar_audit after insert or update on public.contas_pagar
  for each row execute function public.fn_audit();

-- RLS: só o dono, em tudo. Sem policy de DELETE (RF-44).
alter table public.contas_pagar enable row level security;

create policy contas_pagar_select on public.contas_pagar
  for select to authenticated using (public.is_dono());
create policy contas_pagar_insert on public.contas_pagar
  for insert to authenticated with check (public.is_dono());
create policy contas_pagar_update on public.contas_pagar
  for update to authenticated using (public.is_dono()) with check (public.is_dono());
