-- =====================================================================
-- VINIGOR — 0001 base: extensões, perfis, helpers de papel e numeração
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- profiles (espelho de auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nome        text not null,
  email       text,
  role        text not null default 'operador' check (role in ('dono','operador')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de acesso. role=dono tem visão financeira agregada; operador não.';

-- ---------------------------------------------------------------------
-- Helpers de papel. SECURITY DEFINER de propósito: ignoram RLS e por isso
-- podem ser usados dentro das próprias policies de profiles sem recursão.
-- ---------------------------------------------------------------------
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.ativo
$$;

create or replace function public.is_dono()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.auth_role() = 'dono', false) $$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.auth_role() in ('dono','operador'), false) $$;

-- ---------------------------------------------------------------------
-- Bootstrap: primeiro usuário criado vira dono; os demais, operador
-- (ou o papel enviado em raw_user_meta_data.role, quando o dono convida).
-- ---------------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_primeiro boolean;
begin
  select not exists (select 1 from public.profiles) into v_primeiro;

  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'operador');
  if v_role not in ('dono','operador') then
    v_role := 'operador';
  end if;
  if v_primeiro then
    v_role := 'dono';
  end if;

  insert into public.profiles (id, nome, email, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_role
  )
  on conflict (id) do nothing;

  return new;
end
$$;

create trigger tg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Numeração sequencial por ano: ORC-2026-0142 / PED-2026-0087
-- ---------------------------------------------------------------------
create table public.numeracao (
  tipo   text not null,
  ano    integer not null,
  ultimo integer not null default 0,
  primary key (tipo, ano)
);

create or replace function public.proximo_numero(p_prefixo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ano integer;
  v_seq integer;
begin
  v_ano := extract(year from (now() at time zone 'America/Sao_Paulo'))::int;

  insert into public.numeracao as n (tipo, ano, ultimo)
  values (p_prefixo, v_ano, 1)
  on conflict (tipo, ano) do update set ultimo = n.ultimo + 1
  returning n.ultimo into v_seq;

  return p_prefixo || '-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
end
$$;

-- ---------------------------------------------------------------------
-- Configurações do sistema (flags do PRD)
-- ---------------------------------------------------------------------
create table public.configuracoes (
  chave      text primary key,
  valor      text not null,
  descricao  text,
  updated_at timestamptz not null default now()
);

insert into public.configuracoes (chave, valor, descricao) values
  ('sinal_percentual_padrao',       '50',   'Percentual sugerido de sinal no primeiro pagamento (RF-30)'),
  ('validade_orcamento_dias',       '15',   'Validade padrão do orçamento em dias (RF-10)'),
  ('operador_ve_historico_preco',   'true', 'Operador enxerga o histórico de preços do cliente (RF-11)'),
  ('prazo_alerta_dias',             '2',    'Dias de antecedência para o card ficar amarelo (RF-20)');

create or replace function public.config_texto(p_chave text, p_default text)
returns text
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select c.valor from public.configuracoes c where c.chave = p_chave), p_default) $$;

create or replace function public.config_bool(p_chave text, p_default boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(nullif(public.config_texto(p_chave, null), '')::boolean, p_default) $$;

create or replace function public.config_num(p_chave text, p_default numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(nullif(public.config_texto(p_chave, null), '')::numeric, p_default) $$;

-- ---------------------------------------------------------------------
-- Auditoria (RF-43)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id           bigserial primary key,
  tabela       text not null,
  registro_id  uuid,
  acao         text not null check (acao in ('INSERT','UPDATE','DELETE')),
  dados_antes  jsonb,
  dados_depois jsonb,
  user_id      uuid references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index idx_audit_registro on public.audit_log (tabela, registro_id, created_at desc);
create index idx_audit_user on public.audit_log (user_id, created_at desc);

create or replace function public.fn_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if tg_op = 'DELETE' then
    v_id := old.id;
  else
    v_id := new.id;
  end if;

  insert into public.audit_log (tabela, registro_id, acao, dados_antes, dados_depois, user_id)
  values (
    tg_table_name,
    v_id,
    tg_op,
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end,
    auth.uid()
  );

  return coalesce(new, old);
end
$$;
