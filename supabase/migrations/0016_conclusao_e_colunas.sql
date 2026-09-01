-- =====================================================================
-- VINIGOR — 0016: coluna Concluído, colunas editáveis pelo dono
--
-- Venda fechada não se apaga: sumiria do faturamento e do histórico do
-- cliente, e o dinheiro sumiria junto. O que faltava era um lugar para
-- ela descansar depois de entregue e paga — daí a coluna "Concluído",
-- que é para onde o card vai quando não há mais nada a fazer. A tela
-- "Vendas concluídas" lê justamente essa coluna.
--
-- Concluir exige saldo zero, sem exceção. A entrega tem a válvula do
-- RF-29 (entregar devendo, com justificativa) porque o material às vezes
-- precisa sair; concluir não tem urgência nenhuma, então aqui a régua é
-- reta: recebeu tudo, conclui.
--
-- E como a fila muda de gráfica para gráfica, as colunas passam a ser
-- editáveis pelo dono (nome, cor, ordem, ativa). O que não muda é o
-- slug: é por ele que o código encontra "aprovado", "entregue" e
-- "concluido".
-- =====================================================================

-- ---------------------------------------------------------------------
-- Quando a venda foi dada por concluída. Guardado no pedido em vez de
-- deduzido do log de eventos: é data de relatório, precisa ser barata de
-- ler e de filtrar.
-- ---------------------------------------------------------------------
alter table public.pedidos
  add column concluido_em timestamptz;

comment on column public.pedidos.concluido_em is
  'Momento em que o pedido entrou na coluna Concluído. Nulo enquanto não concluído.';

create index idx_pedidos_concluido on public.pedidos (concluido_em desc)
  where deleted_at is null and concluido_em is not null;

-- ---------------------------------------------------------------------
-- A coluna. is_final porque é estado terminal: a trava de saldo do
-- RF-29 vale aqui também, e ainda mais apertada logo abaixo.
-- ---------------------------------------------------------------------
insert into public.colunas (slug, nome, ordem, cor, is_final, is_cancelado)
values ('concluido', 'Concluído', 10, '#3F5A15', true, false)
on conflict (slug) do nothing;

-- Instalação é etapa de serviço e vinha depois de Entregue, o que deixava
-- "Entregue" no meio da fila. Agora a fila termina no que é fim de fato:
-- ... Instalação, Entregue, Concluído, Cancelado.
update public.colunas set ordem = 8  where slug = 'instalacao';
update public.colunas set ordem = 9  where slug = 'entregue';
update public.colunas set ordem = 10 where slug = 'concluido';
update public.colunas set ordem = 11 where slug = 'cancelado';

-- ---------------------------------------------------------------------
-- Concluir com dinheiro na rua não conclui nada.
-- ---------------------------------------------------------------------
create or replace function public.fn_valida_conclusao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug  text;
  v_saldo numeric;
begin
  if new.coluna_id is not distinct from old.coluna_id then
    return new;
  end if;

  select c.slug into v_slug from public.colunas c where c.id = new.coluna_id;

  if v_slug = 'concluido' then
    v_saldo := public.saldo_devedor(new.id);

    if v_saldo > 0 then
      raise exception
        'Pedido % ainda tem R$ % a receber. Registre o pagamento antes de concluir.',
        new.numero, to_char(v_saldo, 'FM999G999G990D00')
        using errcode = 'VG008';
    end if;

    new.concluido_em := coalesce(new.concluido_em, now());
  else
    -- voltou para o fluxo: deixa de ser venda concluída
    new.concluido_em := null;
  end if;

  return new;
end
$$;

create trigger tg_pedidos_valida_conclusao
  before update of coluna_id on public.pedidos
  for each row execute function public.fn_valida_conclusao();

revoke execute on function public.fn_valida_conclusao() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Colunas editáveis, com três travas: o slug é contrato de código;
-- coluna com card dentro não some do quadro (o card sumiria junto); e as
-- quatro colunas que o sistema movimenta sozinho continuam de pé.
-- ---------------------------------------------------------------------
create or replace function public.fn_valida_coluna()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception
      'O identificador interno da coluna não muda — renomeie só o título.'
      using errcode = 'VG009';
  end if;

  if old.ativo and not new.ativo then
    if new.slug in ('aprovado', 'entregue', 'concluido', 'cancelado') then
      raise exception
        'A coluna "%" é usada pelo sistema (aprovação, entrega, conclusão) e não pode ser desativada.',
        old.nome
        using errcode = 'VG010';
    end if;

    if exists (
      select 1 from public.pedidos p
      where p.coluna_id = new.id and p.deleted_at is null
    ) then
      raise exception
        'Ainda há pedidos em "%". Mova os cards para outra coluna antes de desativar.',
        old.nome
        using errcode = 'VG011';
    end if;
  end if;

  return new;
end
$$;

create trigger tg_colunas_valida
  before update on public.colunas
  for each row execute function public.fn_valida_coluna();

revoke execute on function public.fn_valida_coluna() from public, anon, authenticated;
