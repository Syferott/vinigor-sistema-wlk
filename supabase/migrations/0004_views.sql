-- =====================================================================
-- VINIGOR — 0004: views de apoio
-- security_invoker = true  -> a view respeita a RLS de quem consulta.
-- As views agregadas carregam is_dono() no WHERE: para o operador elas
-- retornam zero linhas. Esconder o botão na tela não é controle de acesso.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Situação financeira de cada pedido (RF-26) — visível para todo staff,
-- o operador precisa disso para receber no balcão.
-- ---------------------------------------------------------------------
create view public.vw_pedido_financeiro
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
  where x.pedido_id = p.id and x.deleted_at is null
) g on true
where p.deleted_at is null;

-- ---------------------------------------------------------------------
-- RF-11 — histórico de preços cobrados por cliente/serviço.
-- Respeita a flag operador_ve_historico_preco.
-- ---------------------------------------------------------------------
create view public.vw_historico_preco
with (security_invoker = true) as
select
  p.cliente_id,
  i.servico_id,
  i.descricao,
  p.id                as pedido_id,
  p.numero            as pedido_numero,
  (p.created_at at time zone 'America/Sao_Paulo')::date as data,
  i.quantidade,
  i.preco_unitario,
  i.total
from public.pedido_itens i
join public.pedidos p on p.id = i.pedido_id
where p.deleted_at is null
  and (public.is_dono() or public.config_bool('operador_ve_historico_preco', true));

-- ---------------------------------------------------------------------
-- RF-32/33/34 — faturamento mensal.
-- Vendido (competência) e Recebido (caixa) são números diferentes e
-- ambos importam: são calculados de fontes distintas, lado a lado.
-- ---------------------------------------------------------------------
create view public.vw_faturamento_mensal
with (security_invoker = true) as
with vendas as (
  select
    date_trunc('month', (p.created_at at time zone 'America/Sao_Paulo'))::date as mes_ref,
    sum(p.valor_total) as total_vendido,
    count(*)           as qtd_pedidos
  from public.pedidos p
  where p.deleted_at is null
  group by 1
),
recebimentos as (
  select
    date_trunc('month', g.data_pagamento)::date as mes_ref,
    sum(g.valor) as total_recebido
  from public.pagamentos g
  join public.pedidos p on p.id = g.pedido_id and p.deleted_at is null
  where g.deleted_at is null
  group by 1
),
meses as (
  select mes_ref from vendas
  union
  select mes_ref from recebimentos
)
select
  extract(year  from m.mes_ref)::int as ano,
  extract(month from m.mes_ref)::int as mes,
  m.mes_ref,
  coalesce(v.total_vendido, 0)::numeric(12,2)   as total_vendido,
  coalesce(r.total_recebido, 0)::numeric(12,2)  as total_recebido,
  coalesce(v.qtd_pedidos, 0)                    as qtd_pedidos,
  case when coalesce(v.qtd_pedidos, 0) > 0
       then round(v.total_vendido / v.qtd_pedidos, 2)
       else 0 end::numeric(12,2)                as ticket_medio
from meses m
left join vendas v       on v.mes_ref = m.mes_ref
left join recebimentos r on r.mes_ref = m.mes_ref
where public.is_dono();

-- ---------------------------------------------------------------------
-- RF-31 — contas a receber (exclusivo do dono, conforme 6.2)
-- ---------------------------------------------------------------------
create view public.vw_contas_receber
with (security_invoker = true) as
select
  p.id           as pedido_id,
  p.numero,
  p.cliente_id,
  c.nome         as cliente_nome,
  c.telefone     as cliente_telefone,
  p.prazo_entrega,
  p.valor_total,
  f.total_pago,
  f.saldo_devedor,
  f.situacao,
  col.nome       as coluna_nome,
  col.is_final   as entregue,
  ((now() at time zone 'America/Sao_Paulo')::date - p.prazo_entrega) as dias_de_atraso
from public.pedidos p
join public.vw_pedido_financeiro f on f.pedido_id = p.id
join public.clientes c on c.id = p.cliente_id
join public.colunas col on col.id = p.coluna_id
where p.deleted_at is null
  and f.saldo_devedor > 0
  and not col.is_cancelado
  and public.is_dono();

-- ---------------------------------------------------------------------
-- RF-35 — ranking de clientes
-- ---------------------------------------------------------------------
create view public.vw_ranking_clientes
with (security_invoker = true) as
select
  p.cliente_id,
  c.nome as cliente_nome,
  (p.created_at at time zone 'America/Sao_Paulo')::date as data_pedido,
  p.valor_total,
  p.id as pedido_id
from public.pedidos p
join public.clientes c on c.id = p.cliente_id
where p.deleted_at is null
  and public.is_dono();

-- ---------------------------------------------------------------------
-- RF-36 — serviços mais vendidos (receita e volume)
-- ---------------------------------------------------------------------
create view public.vw_servicos_vendidos
with (security_invoker = true) as
select
  i.servico_id,
  coalesce(s.nome, i.descricao) as servico_nome,
  s.unidade,
  (p.created_at at time zone 'America/Sao_Paulo')::date as data_pedido,
  i.quantidade,
  i.preco_unitario,
  i.total,
  p.id as pedido_id
from public.pedido_itens i
join public.pedidos p on p.id = i.pedido_id
left join public.servicos s on s.id = i.servico_id
where p.deleted_at is null
  and public.is_dono();

-- ---------------------------------------------------------------------
-- RF-37 — evolução do preço médio de um serviço (base para reajuste)
-- ---------------------------------------------------------------------
create view public.vw_evolucao_preco_servico
with (security_invoker = true) as
select
  i.servico_id,
  s.nome as servico_nome,
  date_trunc('month', (p.created_at at time zone 'America/Sao_Paulo'))::date as mes_ref,
  round(avg(i.preco_unitario), 2)::numeric(12,2) as preco_medio,
  min(i.preco_unitario) as preco_min,
  max(i.preco_unitario) as preco_max,
  sum(i.quantidade)     as quantidade_total,
  count(*)              as ocorrencias
from public.pedido_itens i
join public.pedidos p on p.id = i.pedido_id
join public.servicos s on s.id = i.servico_id
where p.deleted_at is null
  and public.is_dono()
group by i.servico_id, s.nome, 3;
