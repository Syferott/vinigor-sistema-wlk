-- =====================================================================
-- VINIGOR — 0017: operação pedida pela gráfica
--
-- Idempotente: pode rodar mais de uma vez. Não apaga e não reescreve
-- dado já lançado — só acrescenta coluna, alarga regra e troca função.
--
-- Como aplicar (não há CLI neste ambiente):
--   Supabase → SQL Editor → colar este arquivo inteiro → Run.
-- O sistema abre sem esta migration. Recorrência, Faturado, nome avulso
-- e a edição larga de item é que passam a valer depois dela.
--
-- O que entra:
--   · cliente recorrente (a cada X dias) — só aviso na tela, sem mensagem
--   · nome e telefone avulsos no pedido de balcão (não cria cliente)
--   · forma de pagamento "faturado" (boleto ou PIX, com data)
--     Faturado NÃO entra no recebido: o saldo continua em aberto até
--     o dinheiro cair (dinheiro, PIX, cartão, boleto recebido etc.)
--   · operador pode corrigir item de pedido, não só o dono
--   · orçamento aprovado aceita mudança de item e o recálculo do total
--   · espelhar_itens_orcamento copia os itens do pedido de volta
--     para o orçamento, numa transação só
-- =====================================================================

-- ---------------------------------------------------------------------
-- Cliente que pede sempre
-- ---------------------------------------------------------------------
alter table public.clientes
  add column if not exists recorrente boolean not null default false;

alter table public.clientes
  add column if not exists recorrencia_dias integer;

comment on column public.clientes.recorrente is
  'Marca quem pede com frequência. O quadro só avisa; ninguém recebe mensagem.';

comment on column public.clientes.recorrencia_dias is
  'Intervalo em dias desde o último pedido. Nulo quando recorrente é falso.';

alter table public.clientes drop constraint if exists clientes_recorrencia_dias_check;
alter table public.clientes
  add constraint clientes_recorrencia_dias_check
  check (
    (recorrente = false and recorrencia_dias is null)
    or (recorrente = true and recorrencia_dias between 1 and 3650)
  );

-- ---------------------------------------------------------------------
-- Nome na venda de balcão, sem ficha de cliente
-- O pedido continua apontando para um cliente (a coluna é obrigatória).
-- Na prática o genérico "Consumidor final" segura a chave, e estes
-- campos é que aparecem no card.
-- ---------------------------------------------------------------------
alter table public.pedidos
  add column if not exists nome_avulso text;

alter table public.pedidos
  add column if not exists telefone_avulso text;

comment on column public.pedidos.nome_avulso is
  'Nome de quem comprou no balcão sem cadastro. Não cria linha em clientes.';

comment on column public.pedidos.telefone_avulso is
  'Telefone só desta venda, quando não há ficha de cliente.';

-- ---------------------------------------------------------------------
-- Faturado: compromisso de boleto ou PIX numa data, não é caixa
-- ---------------------------------------------------------------------
alter table public.pagamentos
  add column if not exists agendado_meio text;

alter table public.pagamentos
  add column if not exists agendado_para date;

comment on column public.pagamentos.agendado_meio is
  'Quando forma = faturado: boleto ou pix. Nulo nas outras formas.';

comment on column public.pagamentos.agendado_para is
  'Data combinada para o boleto ou o PIX do faturado.';

-- O check antigo lista as formas numa constraint gerada. Solta só as
-- que falam de "forma" e recria, para o script poder rodar de novo.
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'pagamentos'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%forma%'
  loop
    execute format('alter table public.pagamentos drop constraint %I', r.conname);
  end loop;
end
$$;

alter table public.pagamentos drop constraint if exists pagamentos_forma_check;
alter table public.pagamentos
  add constraint pagamentos_forma_check
  check (forma in (
    'dinheiro', 'pix', 'debito', 'credito', 'boleto', 'transferencia', 'faturado'
  ));

alter table public.pagamentos drop constraint if exists pagamentos_agendado_check;
alter table public.pagamentos
  add constraint pagamentos_agendado_check
  check (
    (
      forma <> 'faturado'
      and agendado_meio is null
      and agendado_para is null
    )
    or (
      forma = 'faturado'
      and agendado_meio in ('boleto', 'pix')
      and agendado_para is not null
    )
  );

-- Saldo e a view de financeiro ignoram faturado. A trava de concluir
-- (VG008) e a de entregar (VG001) leem saldo_devedor(), então faturar
-- não quita e não libera conclusão.
create or replace function public.saldo_devedor(p_pedido_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then round(
    coalesce((select p.valor_total from public.pedidos p where p.id = p_pedido_id), 0)
    - coalesce((
        select sum(g.valor)
        from public.pagamentos g
        where g.pedido_id = p_pedido_id
          and g.deleted_at is null
          and g.forma is distinct from 'faturado'
      ), 0)
  , 2) end
$$;

create or replace view public.vw_pedido_financeiro
with (security_invoker = true) as
select
  p.id                                             as pedido_id,
  p.numero,
  p.cliente_id,
  p.valor_total,
  coalesce(g.total_pago, 0)::numeric(12,2)         as total_pago,
  round(p.valor_total - coalesce(g.total_pago, 0), 2)::numeric(12,2) as saldo_devedor,
  case
    when coalesce(g.total_pago, 0) <= 0 then 'sem_pagamento'
    when coalesce(g.total_pago, 0) >= p.valor_total then 'pago'
    else 'parcial'
  end                                              as situacao
from public.pedidos p
left join lateral (
  select sum(x.valor) as total_pago
  from public.pagamentos x
  where x.pedido_id = p.id
    and x.deleted_at is null
    and x.forma is distinct from 'faturado'
) g on true
where p.deleted_at is null;

-- ---------------------------------------------------------------------
-- Item de pedido deixa de ser congelado para o operador.
-- Continua exigindo ser da casa. O total do pedido é recalculado
-- pela aplicação ao salvar, com o desconto do orçamento quando há.
-- ---------------------------------------------------------------------
create or replace function public.fn_pedido_itens_congelado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Sem permissão para alterar itens do pedido.';
  end if;
  return coalesce(new, old);
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pedido_itens'
      and policyname = 'pedido_itens_delete'
  ) then
    create policy pedido_itens_delete on public.pedido_itens
      for delete to authenticated
      using (public.is_staff());
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Orçamento aprovado: o cabeçalho segue imutável (RF-16), menos o
-- total, que acompanha os itens. Exclusão lógica continua valendo.
-- ---------------------------------------------------------------------
create or replace function public.fn_bloqueia_orcamento_aprovado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Orçamento aprovado não pode ser excluído (RF-16). Use exclusão lógica no registro original.';
  end if;

  if old.status = 'aprovado'
     and to_jsonb(new)
           - 'deleted_at' - 'exclusao_motivo' - 'updated_at' - 'subtotal' - 'total'
         is distinct from
         to_jsonb(old)
           - 'deleted_at' - 'exclusao_motivo' - 'updated_at' - 'subtotal' - 'total'
  then
    raise exception 'Orçamento % está aprovado e é imutável (RF-16). Gere uma nova versão.', old.numero;
  end if;

  return new;
end
$$;

create or replace function public.fn_bloqueia_item_de_orcamento_aprovado()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_id uuid;
begin
  v_id := coalesce(new.orcamento_id, old.orcamento_id);
  select o.status into v_status from public.orcamentos o where o.id = v_id;

  -- Aprovado aceita acréscimo durante a produção. O trigger de
  -- recálculo atualiza subtotal/total, que a trava acima deixa passar.
  if v_status = 'aprovado' and not public.is_staff() then
    raise exception 'Itens de orçamento aprovado são imutáveis (RF-16).';
  end if;

  return coalesce(new, old);
end
$$;

-- Copia os itens do pedido para o orçamento aprovado, numa transação.
-- Se um insert falhar, nada do orçamento muda.
create or replace function public.espelhar_itens_orcamento(
  p_orcamento_id uuid,
  p_itens        jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_item   jsonb;
  v_ordem  integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'O orçamento precisa de ao menos um item.';
  end if;

  select o.status into v_status
  from public.orcamentos o
  where o.id = p_orcamento_id and o.deleted_at is null;

  if v_status is null then
    raise exception 'Orçamento não encontrado.';
  end if;

  if v_status <> 'aprovado' then
    raise exception 'Rascunho se edita na própria tela do orçamento.';
  end if;

  delete from public.orcamento_itens where orcamento_id = p_orcamento_id;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_ordem := v_ordem + 1;
    insert into public.orcamento_itens (
      orcamento_id, servico_id, descricao, especificacoes, quantidade, preco_unitario, ordem
    ) values (
      p_orcamento_id,
      nullif(v_item ->> 'servico_id', '')::uuid,
      v_item ->> 'descricao',
      coalesce(v_item -> 'especificacoes', '{}'::jsonb),
      (v_item ->> 'quantidade')::numeric,
      (v_item ->> 'preco_unitario')::numeric,
      v_ordem
    );
  end loop;
end
$$;

revoke all on function public.espelhar_itens_orcamento(uuid, jsonb) from public, anon;
grant execute on function public.espelhar_itens_orcamento(uuid, jsonb) to authenticated;
