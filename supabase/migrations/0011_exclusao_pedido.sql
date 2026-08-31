-- =====================================================================
-- VINIGOR — 0011: excluir pedido do quadro
--
-- Continua sendo exclusão lógica (RF-44): o card sai do quadro, das
-- fichas e dos relatórios, mas a linha permanece no banco com quem
-- excluiu, quando e por quê. As views já filtram deleted_at, então
-- nenhuma delas precisa mudar.
--
-- Quem exclui é o dono (PRD 4: "Edita e exclui qualquer registro").
-- O operador tem a coluna Cancelado, que é o caminho normal para um
-- pedido que não vai acontecer.
-- =====================================================================

alter table public.pedidos
  add column exclusao_motivo text;

comment on column public.pedidos.exclusao_motivo is
  'Justificativa da exclusão lógica. Preenchida junto com deleted_at.';

create or replace function public.fn_valida_exclusao_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- só interessa a transição para excluído
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  if not public.is_dono() then
    raise exception
      'Apenas o dono pode excluir um pedido. Para um pedido que não vai acontecer, mova o card para a coluna Cancelado.'
      using errcode = 'VG003';
  end if;

  if coalesce(trim(new.exclusao_motivo), '') = '' then
    raise exception 'Excluir um pedido exige justificativa.'
      using errcode = 'VG004';
  end if;

  return new;
end
$$;

create trigger tg_pedidos_valida_exclusao
  before update of deleted_at on public.pedidos
  for each row execute function public.fn_valida_exclusao_pedido();

revoke execute on function public.fn_valida_exclusao_pedido() from public, anon, authenticated;
