-- =====================================================================
-- VINIGOR — 0002: clientes, catálogo de serviços, orçamentos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Clientes (RF-01 a RF-04)
-- ---------------------------------------------------------------------
create table public.clientes (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  tipo         text not null default 'PF' check (tipo in ('PF','PJ')),
  documento    text,
  telefone     text,
  email        text,
  endereco     text,
  observacoes  text,
  -- normalizados só para busca e detecção de duplicidade (RF-04)
  documento_norm text generated always as (nullif(regexp_replace(coalesce(documento,''), '\D', '', 'g'), '')) stored,
  telefone_norm  text generated always as (nullif(regexp_replace(coalesce(telefone,''),  '\D', '', 'g'), '')) stored,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index idx_clientes_nome_trgm on public.clientes using gin (nome gin_trgm_ops);
create index idx_clientes_documento on public.clientes (documento_norm) where deleted_at is null;
create index idx_clientes_telefone  on public.clientes (telefone_norm)  where deleted_at is null;
create index idx_clientes_ativos    on public.clientes (nome) where deleted_at is null;

create trigger tg_clientes_touch before update on public.clientes
  for each row execute function public.fn_touch_updated_at();
create trigger tg_clientes_audit after insert or update on public.clientes
  for each row execute function public.fn_audit();

-- Duplicidade é aviso, não trava (RF-04): a checagem é uma função de consulta.
create or replace function public.clientes_duplicados(p_documento text, p_telefone text, p_ignorar uuid default null)
returns setof public.clientes
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.clientes c
  where c.deleted_at is null
    and (p_ignorar is null or c.id <> p_ignorar)
    and (
      (nullif(regexp_replace(coalesce(p_documento,''), '\D', '', 'g'), '') is not null
        and c.documento_norm = nullif(regexp_replace(coalesce(p_documento,''), '\D', '', 'g'), ''))
      or
      (nullif(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), '') is not null
        and c.telefone_norm = nullif(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), ''))
    )
  limit 5
$$;

-- ---------------------------------------------------------------------
-- Catálogo de serviços (RF-05 a RF-07)
-- ---------------------------------------------------------------------
create table public.servicos (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  unidade          text not null default 'un' check (unidade in ('un','m2','milheiro','cento','ml','kg','hora')),
  preco_base       numeric(12,2) not null default 0 check (preco_base >= 0),
  descricao_padrao text,
  ativo            boolean not null default true,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index idx_servicos_nome_trgm on public.servicos using gin (nome gin_trgm_ops);
create index idx_servicos_ativos on public.servicos (nome) where deleted_at is null and ativo;

create trigger tg_servicos_touch before update on public.servicos
  for each row execute function public.fn_touch_updated_at();
create trigger tg_servicos_audit after insert or update on public.servicos
  for each row execute function public.fn_audit();

-- ---------------------------------------------------------------------
-- Orçamentos (RF-08 a RF-16)
-- ---------------------------------------------------------------------
create table public.orcamentos (
  id               uuid primary key default gen_random_uuid(),
  numero           text not null unique,
  cliente_id       uuid not null references public.clientes (id),
  status           text not null default 'rascunho'
                   check (status in ('rascunho','enviado','aprovado','recusado','expirado')),
  data_orcamento   date not null default (now() at time zone 'America/Sao_Paulo')::date,
  validade         date not null,
  prazo_producao_dias integer,
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  desconto_tipo    text not null default 'valor' check (desconto_tipo in ('valor','percentual')),
  desconto_valor   numeric(12,2) not null default 0 check (desconto_valor >= 0),
  total            numeric(12,2) not null default 0 check (total >= 0),
  observacoes      text,
  versao           integer not null default 1,
  orcamento_pai_id uuid references public.orcamentos (id),
  recusado_motivo  text,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create index idx_orcamentos_cliente on public.orcamentos (cliente_id, created_at desc) where deleted_at is null;
create index idx_orcamentos_status  on public.orcamentos (status) where deleted_at is null;
create index idx_orcamentos_numero  on public.orcamentos (numero);

create trigger tg_orcamentos_touch before update on public.orcamentos
  for each row execute function public.fn_touch_updated_at();
create trigger tg_orcamentos_audit after insert or update on public.orcamentos
  for each row execute function public.fn_audit();

create table public.orcamento_itens (
  id             uuid primary key default gen_random_uuid(),
  orcamento_id   uuid not null references public.orcamentos (id) on delete cascade,
  servico_id     uuid references public.servicos (id),
  descricao      text not null,
  especificacoes jsonb not null default '{}'::jsonb,
  quantidade     numeric(12,3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0),
  total          numeric(12,2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now()
);

create index idx_orc_itens_orcamento on public.orcamento_itens (orcamento_id, ordem);
create index idx_orc_itens_servico on public.orcamento_itens (servico_id);

-- ---------------------------------------------------------------------
-- RF-16: orçamento aprovado é imutável. Alteração posterior gera nova
-- versão (-v2) preservando o original.
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

  -- permite apenas marcar exclusão lógica; qualquer outra mudança é barrada
  if old.status = 'aprovado'
     and to_jsonb(new) - 'deleted_at' - 'updated_at' is distinct from to_jsonb(old) - 'deleted_at' - 'updated_at' then
    raise exception 'Orçamento % está aprovado e é imutável (RF-16). Gere uma nova versão.', old.numero;
  end if;

  return new;
end
$$;

create trigger tg_orcamentos_imutavel
  before update or delete on public.orcamentos
  for each row execute function public.fn_bloqueia_orcamento_aprovado();

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

  if v_status = 'aprovado' then
    raise exception 'Itens de orçamento aprovado são imutáveis (RF-16).';
  end if;

  return coalesce(new, old);
end
$$;

create trigger tg_orc_itens_imutavel
  before insert or update or delete on public.orcamento_itens
  for each row execute function public.fn_bloqueia_item_de_orcamento_aprovado();

-- ---------------------------------------------------------------------
-- Recalcula subtotal / total a cada mudança de item (fonte única de verdade)
-- ---------------------------------------------------------------------
create or replace function public.fn_recalcula_orcamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_subtotal numeric(12,2);
begin
  v_id := coalesce(new.orcamento_id, old.orcamento_id);

  select coalesce(sum(i.total), 0) into v_subtotal
  from public.orcamento_itens i
  where i.orcamento_id = v_id;

  update public.orcamentos o
  set subtotal = v_subtotal,
      total = greatest(
        0,
        round(
          case when o.desconto_tipo = 'percentual'
               then v_subtotal * (1 - least(o.desconto_valor, 100) / 100)
               else v_subtotal - o.desconto_valor
          end, 2)
      )
  where o.id = v_id;

  return coalesce(new, old);
end
$$;

create trigger tg_orc_itens_recalcula
  after insert or update or delete on public.orcamento_itens
  for each row execute function public.fn_recalcula_orcamento();

-- Recalcula também quando o desconto muda no cabeçalho
create or replace function public.fn_recalcula_orcamento_desconto()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.total := greatest(
    0,
    round(
      case when new.desconto_tipo = 'percentual'
           then new.subtotal * (1 - least(new.desconto_valor, 100) / 100)
           else new.subtotal - new.desconto_valor
      end, 2)
  );
  return new;
end
$$;

create trigger tg_orcamentos_desconto
  before insert or update of subtotal, desconto_tipo, desconto_valor on public.orcamentos
  for each row execute function public.fn_recalcula_orcamento_desconto();

-- ---------------------------------------------------------------------
-- RF-13: expiração automática após a validade
-- ---------------------------------------------------------------------
create or replace function public.expirar_orcamentos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_qtd integer;
begin
  update public.orcamentos
  set status = 'expirado'
  where status in ('rascunho','enviado')
    and deleted_at is null
    and validade < (now() at time zone 'America/Sao_Paulo')::date;

  get diagnostics v_qtd = row_count;
  return v_qtd;
end
$$;

-- ---------------------------------------------------------------------
-- Criação do orçamento com numeração atômica.
-- proximo_numero() é revogada do cliente: só entra por aqui, sem corrida.
-- ---------------------------------------------------------------------
create or replace function public.criar_orcamento(
  p_cliente_id     uuid,
  p_validade       date default null,
  p_prazo_producao integer default null,
  p_observacoes    text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  insert into public.orcamentos (
    numero, cliente_id, validade, prazo_producao_dias, observacoes, created_by
  ) values (
    public.proximo_numero('ORC'),
    p_cliente_id,
    coalesce(
      p_validade,
      (now() at time zone 'America/Sao_Paulo')::date
        + public.config_num('validade_orcamento_dias', 15)::int
    ),
    p_prazo_producao,
    p_observacoes,
    auth.uid()
  )
  returning id into v_id;

  return v_id;
end
$$;
