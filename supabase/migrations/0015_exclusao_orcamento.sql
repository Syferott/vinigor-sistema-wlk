-- =====================================================================
-- VINIGOR — 0015: excluir orçamento
--
-- Mesma régua do pedido (0011): exclusão lógica (RF-44). O orçamento
-- sai da lista, da ficha do cliente e da impressão, mas a linha fica no
-- banco com quem excluiu, quando e por quê. Todas as telas já filtram
-- deleted_at is null, então nenhuma consulta precisa mudar.
--
-- Quem exclui é o dono. O operador tem o status "Recusado", que é o
-- caminho normal para um orçamento que não vai fechar — excluir é para
-- lançamento errado, duplicado ou teste.
--
-- Orçamento já aprovado só sai se o pedido dele tiver saído antes:
-- apagar a origem e deixar o pedido órfão no quadro quebraria a
-- rastreabilidade que o RF-16 existe para garantir.
-- =====================================================================

alter table public.orcamentos
  add column exclusao_motivo text;

comment on column public.orcamentos.exclusao_motivo is
  'Justificativa da exclusão lógica. Preenchida junto com deleted_at.';

-- ---------------------------------------------------------------------
-- RF-16 continua valendo: orçamento aprovado é imutável. A exceção que
-- já existia era deleted_at; agora exclusao_motivo viaja junto com ela,
-- senão a própria justificativa faria a imutabilidade barrar a exclusão.
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
     and to_jsonb(new) - 'deleted_at' - 'exclusao_motivo' - 'updated_at'
         is distinct from
         to_jsonb(old) - 'deleted_at' - 'exclusao_motivo' - 'updated_at' then
    raise exception 'Orçamento % está aprovado e é imutável (RF-16). Gere uma nova versão.', old.numero;
  end if;

  return new;
end
$$;

-- ---------------------------------------------------------------------
-- Trava da exclusão. Roda depois de tg_orcamentos_imutavel (ordem
-- alfabética do nome), então a imutabilidade continua sendo a primeira
-- palavra sobre um orçamento aprovado.
-- ---------------------------------------------------------------------
create or replace function public.fn_valida_exclusao_orcamento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido text;
begin
  -- só interessa a transição para excluído
  if new.deleted_at is null or old.deleted_at is not null then
    return new;
  end if;

  if not public.is_dono() then
    raise exception
      'Apenas o dono pode excluir um orçamento. Para um orçamento que não vai fechar, marque como Recusado.'
      using errcode = 'VG005';
  end if;

  if coalesce(trim(new.exclusao_motivo), '') = '' then
    raise exception 'Excluir um orçamento exige justificativa.'
      using errcode = 'VG006';
  end if;

  select p.numero into v_pedido
  from public.pedidos p
  where p.orcamento_id = new.id and p.deleted_at is null
  limit 1;

  if v_pedido is not null then
    raise exception
      'Este orçamento virou o pedido %. Exclua o pedido primeiro — senão ele fica no quadro sem origem.', v_pedido
      using errcode = 'VG007';
  end if;

  return new;
end
$$;

create trigger tg_orcamentos_valida_exclusao
  before update of deleted_at on public.orcamentos
  for each row execute function public.fn_valida_exclusao_orcamento();

revoke execute on function public.fn_valida_exclusao_orcamento() from public, anon, authenticated;
