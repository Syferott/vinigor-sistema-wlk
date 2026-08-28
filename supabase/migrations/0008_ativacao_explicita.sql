-- =====================================================================
-- VINIGOR — 0008: ativação de usuário deixa de depender do app_metadata
--
-- O GoTrue grava raw_app_meta_data num UPDATE posterior ao INSERT, então
-- o trigger nunca via o carimbo 'convidado' e todo convidado nascia
-- inativo. Em vez de correr atrás da ordem de escrita interna do Auth,
-- o modelo fica com um caminho único e explícito:
--
--   trigger  -> perfil nasce OPERADOR INATIVO (exceto o 1º, que é o dono)
--   convite  -> a server action do dono grava nome, papel e ativo = true
--
-- Quem se cadastrar por fora não passa do login, e não existe metadata
-- que o próprio usuário consiga forjar para mudar isso.
-- =====================================================================

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_primeiro boolean;
begin
  select not exists (select 1 from public.profiles) into v_primeiro;

  insert into public.profiles (id, nome, email, role, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when v_primeiro then 'dono' else 'operador' end,
    v_primeiro
  )
  on conflict (id) do nothing;

  return new;
end
$$;
