-- =====================================================================
-- VINIGOR — 0010: troca obrigatória da senha provisória
--
-- Quem é cadastrado pelo dono recebe uma senha que o dono escolheu e
-- conhece. Enquanto ela valer, "quem recebeu o pagamento" e o log de
-- auditoria apontam para alguém cuja senha outra pessoa sabe. A marca
-- abaixo obriga a troca no primeiro acesso.
-- =====================================================================

alter table public.profiles
  add column senha_provisoria boolean not null default false;

comment on column public.profiles.senha_provisoria is
  'true = senha definida pelo dono no convite; força troca no primeiro acesso.';

-- A policy de update em profiles é exclusiva do dono (RF-41), então o
-- próprio usuário não conseguiria baixar a marca. Esta função é o único
-- caminho: mexe apenas na própria linha e apenas nesta coluna.
create or replace function public.marcar_senha_definida()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Sem sessão.';
  end if;

  update public.profiles
  set senha_provisoria = false
  where id = (select auth.uid());
end
$$;

revoke execute on function public.marcar_senha_definida() from public, anon;
grant execute on function public.marcar_senha_definida() to authenticated;
