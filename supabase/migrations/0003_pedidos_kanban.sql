-- =====================================================================
-- VINIGOR — 0003: quadro de produção, pedidos e pagamentos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Colunas do quadro (RF-17)
-- ---------------------------------------------------------------------
create table public.colunas (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  nome         text not null,
  ordem        integer not null,
  cor          text not null default '#8CC63E',
  is_final     boolean not null default false,   -- "Entregue": trava saldo devedor (RF-29)
  is_cancelado boolean not null default false,   -- arquivo morto, não some do banco
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into public.colunas (slug, nome, ordem, cor, is_final, is_cancelado) values
  ('orcamento',            'Orçamento',            1, '#9CA3AF', false, false),
  ('aprovado',             'Aprovado',             2, '#8CC63E', false, false),
  ('arte',                 'Arte/Design',          3, '#38BDF8', false, false),
  ('aprovacao_cliente',    'Aprovação do cliente', 4, '#A78BFA', false, false),
  ('producao',             'Produção',             5, '#F59E0B', false, false),
  ('acabamento',           'Acabamento',           6, '#FB923C', false, false),
  ('pronto',               'Pronto p/ retirada',   7, '#22C55E', false, false),
  ('entregue',             'Entregue',             8, '#4A4A4A', true,  false),
  ('cancelado',            'Cancelado',            9, '#EF4444', false, true);

-- ---------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------
create table public.pedidos (
  id                  uuid primary key default gen_random_uuid(),
  numero              text not null unique,
  orcamento_id        uuid unique references public.orcamentos (id),
  cliente_id          uuid not null references public.clientes (id),
  coluna_id           uuid not null references public.colunas (id),
  posicao             integer not null default 0,
  prazo_entrega       date,
  valor_total         numeric(12,2) not null default 0 check (valor_total >= 0),
  responsavel_id      uuid references public.profiles (id),
  observacoes         text,
  entregue_em         timestamptz,
  entregue_com_saldo  boolean not null default false,
  justificativa_saldo text,
  created_by          uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create index idx_pedidos_coluna on public.pedidos (coluna_id, posicao) where deleted_at is null;
create index idx_pedidos_cliente on public.pedidos (cliente_id, created_at desc) where deleted_at is null;
create index idx_pedidos_prazo on public.pedidos (prazo_entrega) where deleted_at is null;
create index idx_pedidos_responsavel on public.pedidos (responsavel_id) where deleted_at is null;

create trigger tg_pedidos_touch before update on public.pedidos
  for each row execute function public.fn_touch_updated_at();
create trigger tg_pedidos_audit after insert or update on public.pedidos
  for each row execute function public.fn_audit();

-- Cópia congelada dos itens do orçamento aprovado
create table public.pedido_itens (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos (id) on delete cascade,
  servico_id     uuid references public.servicos (id),
  descricao      text not null,
  especificacoes jsonb not null default '{}'::jsonb,
  quantidade     numeric(12,3) not null default 1 check (quantidade > 0),
  preco_unitario numeric(12,2) not null default 0 check (preco_unitario >= 0),
  total          numeric(12,2) generated always as (round(quantidade * preco_unitario, 2)) stored,
  ordem          integer not null default 0,
  created_at     timestamptz not null default now()
);

create index idx_pedido_itens_pedido on public.pedido_itens (pedido_id, ordem);
create index idx_pedido_itens_servico on public.pedido_itens (servico_id);

-- Congelamento: só o dono corrige um item já materializado.
create or replace function public.fn_pedido_itens_congelado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' and not public.is_dono() then
    raise exception 'Itens do pedido são uma cópia congelada do orçamento. Apenas o dono pode corrigir.';
  end if;
  return coalesce(new, old);
end
$$;

create trigger tg_pedido_itens_congelado
  before update or delete on public.pedido_itens
  for each row execute function public.fn_pedido_itens_congelado();

-- ---------------------------------------------------------------------
-- Linha do tempo do card (RF-22)
-- ---------------------------------------------------------------------
create table public.pedido_eventos (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid not null references public.pedidos (id) on delete cascade,
  coluna_origem_id  uuid references public.colunas (id),
  coluna_destino_id uuid not null references public.colunas (id),
  user_id           uuid references public.profiles (id),
  observacao        text,
  created_at        timestamptz not null default now()
);

create index idx_pedido_eventos on public.pedido_eventos (pedido_id, created_at desc);

create or replace function public.fn_registra_movimentacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.pedido_eventos (pedido_id, coluna_origem_id, coluna_destino_id, user_id)
    values (new.id, null, new.coluna_id, auth.uid());
  elsif new.coluna_id is distinct from old.coluna_id then
    insert into public.pedido_eventos (pedido_id, coluna_origem_id, coluna_destino_id, user_id)
    values (new.id, old.coluna_id, new.coluna_id, auth.uid());
  end if;
  return new;
end
$$;

create trigger tg_pedidos_movimentacao
  after insert or update of coluna_id on public.pedidos
  for each row execute function public.fn_registra_movimentacao();

-- ---------------------------------------------------------------------
-- Anexos de arte (RF-24) e comentários internos (RF-25)
-- ---------------------------------------------------------------------
create table public.pedido_anexos (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null references public.pedidos (id) on delete cascade,
  storage_path text not null,
  nome_arquivo text not null,
  tipo         text,
  tamanho      bigint,
  user_id      uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index idx_anexos_pedido on public.pedido_anexos (pedido_id, created_at desc);

create table public.pedido_comentarios (
  id         uuid primary key default gen_random_uuid(),
  pedido_id  uuid not null references public.pedidos (id) on delete cascade,
  texto      text not null,
  user_id    uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_comentarios_pedido on public.pedido_comentarios (pedido_id, created_at desc);

-- ---------------------------------------------------------------------
-- Pagamentos (RF-26 a RF-30)
-- ---------------------------------------------------------------------
create table public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references public.pedidos (id),
  tipo           text not null check (tipo in ('sinal','parcela','quitacao')),
  valor          numeric(12,2) not null check (valor > 0),
  forma          text not null check (forma in ('dinheiro','pix','debito','credito','boleto','transferencia')),
  data_pagamento date not null default (now() at time zone 'America/Sao_Paulo')::date,
  recebido_por   uuid references public.profiles (id),
  observacao     text,
  created_by     uuid references public.profiles (id),
  created_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index idx_pagamentos_pedido on public.pagamentos (pedido_id) where deleted_at is null;
create index idx_pagamentos_data on public.pagamentos (data_pagamento) where deleted_at is null;

create trigger tg_pagamentos_audit after insert or update on public.pagamentos
  for each row execute function public.fn_audit();

-- Saldo devedor é sempre calculado, nunca digitado (RF-26)
create or replace function public.saldo_devedor(p_pedido_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce((select p.valor_total from public.pedidos p where p.id = p_pedido_id), 0)
    - coalesce((select sum(g.valor) from public.pagamentos g
                where g.pedido_id = p_pedido_id and g.deleted_at is null), 0)
  , 2)
$$;

-- ---------------------------------------------------------------------
-- RF-29: não entrega com saldo em aberto sem exceção justificada
-- ---------------------------------------------------------------------
create or replace function public.fn_valida_entrega()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_final boolean;
  v_saldo numeric;
begin
  select c.is_final into v_final from public.colunas c where c.id = new.coluna_id;

  if coalesce(v_final, false) and new.coluna_id is distinct from old.coluna_id then
    v_saldo := public.saldo_devedor(new.id);

    -- SQLSTATE próprio: o front distingue "precisa confirmar exceção"
    -- de um erro genérico e abre o diálogo de justificativa.
    if v_saldo > 0 and not new.entregue_com_saldo then
      raise exception
        'Pedido % tem saldo devedor de R$ %. Registre o pagamento ou confirme a entrega com saldo em aberto, com justificativa (RF-29).',
        new.numero, to_char(v_saldo, 'FM999G999G990D00')
        using errcode = 'VG001';
    end if;

    if v_saldo > 0 and coalesce(trim(new.justificativa_saldo), '') = '' then
      raise exception 'Entrega com saldo em aberto exige justificativa (RF-29).'
        using errcode = 'VG002';
    end if;

    new.entregue_em := coalesce(new.entregue_em, now());
  end if;

  return new;
end
$$;

create trigger tg_pedidos_valida_entrega
  before update on public.pedidos
  for each row execute function public.fn_valida_entrega();

-- ---------------------------------------------------------------------
-- RF-15: aprovar orçamento -> vira pedido no quadro
-- ---------------------------------------------------------------------
create or replace function public.aprovar_orcamento(
  p_orcamento_id  uuid,
  p_prazo_entrega date default null,
  p_responsavel   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orc      public.orcamentos%rowtype;
  v_coluna   uuid;
  v_pedido   uuid;
  v_posicao  integer;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_orc from public.orcamentos where id = p_orcamento_id and deleted_at is null;
  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;
  if v_orc.status = 'aprovado' then
    raise exception 'Orçamento % já foi aprovado.', v_orc.numero;
  end if;
  if not exists (select 1 from public.orcamento_itens where orcamento_id = p_orcamento_id) then
    raise exception 'Orçamento sem itens não pode ser aprovado.';
  end if;

  select id into v_coluna from public.colunas where slug = 'aprovado';
  select coalesce(max(posicao), 0) + 1 into v_posicao
  from public.pedidos where coluna_id = v_coluna and deleted_at is null;

  insert into public.pedidos (
    numero, orcamento_id, cliente_id, coluna_id, posicao,
    prazo_entrega, valor_total, responsavel_id, created_by
  ) values (
    public.proximo_numero('PED'),
    v_orc.id,
    v_orc.cliente_id,
    v_coluna,
    v_posicao,
    coalesce(
      p_prazo_entrega,
      ((now() at time zone 'America/Sao_Paulo')::date + coalesce(v_orc.prazo_producao_dias, 5))
    ),
    v_orc.total,
    coalesce(p_responsavel, auth.uid()),
    auth.uid()
  )
  returning id into v_pedido;

  insert into public.pedido_itens (pedido_id, servico_id, descricao, especificacoes, quantidade, preco_unitario, ordem)
  select v_pedido, i.servico_id, i.descricao, i.especificacoes, i.quantidade, i.preco_unitario, i.ordem
  from public.orcamento_itens i
  where i.orcamento_id = p_orcamento_id
  order by i.ordem;

  -- por último: a partir daqui o orçamento fica imutável (RF-16)
  update public.orcamentos set status = 'aprovado' where id = p_orcamento_id;

  return v_pedido;
end
$$;

-- ---------------------------------------------------------------------
-- RF-16: nova versão de um orçamento aprovado (ORC-2026-0142-v2)
-- ---------------------------------------------------------------------
create or replace function public.nova_versao_orcamento(p_orcamento_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orc   public.orcamentos%rowtype;
  v_raiz  uuid;
  v_novo  uuid;
  v_versao integer;
  v_numero text;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  select * into v_orc from public.orcamentos where id = p_orcamento_id;
  if not found then
    raise exception 'Orçamento não encontrado.';
  end if;

  v_raiz := coalesce(v_orc.orcamento_pai_id, v_orc.id);

  select coalesce(max(versao), 1) + 1 into v_versao
  from public.orcamentos
  where id = v_raiz or orcamento_pai_id = v_raiz;

  select numero into v_numero from public.orcamentos where id = v_raiz;
  v_numero := split_part(v_numero, '-v', 1) || '-v' || v_versao;

  insert into public.orcamentos (
    numero, cliente_id, status, validade, prazo_producao_dias,
    desconto_tipo, desconto_valor, observacoes, versao, orcamento_pai_id, created_by
  ) values (
    v_numero, v_orc.cliente_id, 'rascunho',
    (now() at time zone 'America/Sao_Paulo')::date
      + public.config_num('validade_orcamento_dias', 15)::int,
    v_orc.prazo_producao_dias, v_orc.desconto_tipo, v_orc.desconto_valor,
    v_orc.observacoes, v_versao, v_raiz, auth.uid()
  )
  returning id into v_novo;

  insert into public.orcamento_itens (orcamento_id, servico_id, descricao, especificacoes, quantidade, preco_unitario, ordem)
  select v_novo, i.servico_id, i.descricao, i.especificacoes, i.quantidade, i.preco_unitario, i.ordem
  from public.orcamento_itens i
  where i.orcamento_id = p_orcamento_id
  order by i.ordem;

  return v_novo;
end
$$;

-- ---------------------------------------------------------------------
-- Movimentação no quadro com reordenação atômica (RF-18)
-- ---------------------------------------------------------------------
create or replace function public.mover_pedido(
  p_pedido_id uuid,
  p_coluna_id uuid,
  p_posicao   integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coluna_antiga uuid;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  select coluna_id into v_coluna_antiga from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  update public.pedidos
  set coluna_id = p_coluna_id,
      posicao = p_posicao
  where id = p_pedido_id;

  -- renumera a coluna de destino mantendo a ordem pedida
  with ordenado as (
    select id, row_number() over (
      order by posicao, case when id = p_pedido_id then 0 else 1 end, created_at
    ) as nova
    from public.pedidos
    where coluna_id = p_coluna_id and deleted_at is null
  )
  update public.pedidos p
  set posicao = o.nova
  from ordenado o
  where p.id = o.id and p.posicao is distinct from o.nova;

  -- e a de origem, se mudou
  if v_coluna_antiga is distinct from p_coluna_id then
    with ordenado as (
      select id, row_number() over (order by posicao, created_at) as nova
      from public.pedidos
      where coluna_id = v_coluna_antiga and deleted_at is null
    )
    update public.pedidos p
    set posicao = o.nova
    from ordenado o
    where p.id = o.id and p.posicao is distinct from o.nova;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- Fluxo 7.2 — "Repetir orçamento": duplica os itens com os mesmos preços
-- a partir de um orçamento OU de um pedido antigo.
-- ---------------------------------------------------------------------
create or replace function public.repetir_orcamento(
  p_orcamento_id uuid default null,
  p_pedido_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cliente uuid;
  v_novo    uuid;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  if p_orcamento_id is not null then
    select cliente_id into v_cliente from public.orcamentos where id = p_orcamento_id;
  elsif p_pedido_id is not null then
    select cliente_id into v_cliente from public.pedidos where id = p_pedido_id;
  end if;

  if v_cliente is null then
    raise exception 'Origem não encontrada para repetir o orçamento.';
  end if;

  v_novo := public.criar_orcamento(v_cliente);

  if p_orcamento_id is not null then
    insert into public.orcamento_itens (orcamento_id, servico_id, descricao, especificacoes, quantidade, preco_unitario, ordem)
    select v_novo, i.servico_id, i.descricao, i.especificacoes, i.quantidade, i.preco_unitario, i.ordem
    from public.orcamento_itens i
    where i.orcamento_id = p_orcamento_id
    order by i.ordem;
  else
    insert into public.orcamento_itens (orcamento_id, servico_id, descricao, especificacoes, quantidade, preco_unitario, ordem)
    select v_novo, i.servico_id, i.descricao, i.especificacoes, i.quantidade, i.preco_unitario, i.ordem
    from public.pedido_itens i
    where i.pedido_id = p_pedido_id
    order by i.ordem;
  end if;

  return v_novo;
end
$$;
