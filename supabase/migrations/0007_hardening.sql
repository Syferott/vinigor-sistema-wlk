-- =====================================================================
-- VINIGOR — 0007: endurecimento apontado pelo advisor de segurança
-- =====================================================================

-- 1. search_path fixo no trigger de updated_at
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 2. Quem entra sozinho não vira operador ativo.
--    Só o primeiro usuário (bootstrap do dono) e quem foi convidado pelo
--    dono via service_role (app_metadata.convidado, que o cliente não
--    consegue forjar) nascem ativos. O resto fica inativo esperando
--    liberação em /usuarios.
-- ---------------------------------------------------------------------
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role     text;
  v_primeiro boolean;
  v_convidado boolean;
begin
  select not exists (select 1 from public.profiles) into v_primeiro;

  v_convidado := coalesce(new.raw_app_meta_data ->> 'convidado', 'false') = 'true';

  v_role := coalesce(new.raw_user_meta_data ->> 'role', 'operador');
  if v_role not in ('dono','operador') then
    v_role := 'operador';
  end if;
  if v_primeiro then
    v_role := 'dono';
  elsif not v_convidado then
    -- papel pedido no metadata do próprio usuário não vale nada
    v_role := 'operador';
  end if;

  insert into public.profiles (id, nome, email, role, ativo)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    v_role,
    v_primeiro or v_convidado
  )
  on conflict (id) do nothing;

  return new;
end
$$;

-- ---------------------------------------------------------------------
-- 3. Funções SECURITY DEFINER que liam dados sem checar papel.
--    clientes_duplicados devolvia ficha de cliente para qualquer conta
--    autenticada, mesmo sem perfil ativo.
-- ---------------------------------------------------------------------
create or replace function public.clientes_duplicados(p_documento text, p_telefone text, p_ignorar uuid default null)
returns setof public.clientes
language sql
stable
security definer
set search_path = ''
as $$
  select c.*
  from public.clientes c
  where public.is_staff()
    and c.deleted_at is null
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

create or replace function public.saldo_devedor(p_pedido_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_staff() then round(
    coalesce((select p.valor_total from public.pedidos p where p.id = p_pedido_id), 0)
    - coalesce((select sum(g.valor) from public.pagamentos g
                where g.pedido_id = p_pedido_id and g.deleted_at is null), 0)
  , 2) end
$$;

-- ---------------------------------------------------------------------
-- 4. Nada de SECURITY DEFINER exposto ao anônimo no /rest/v1/rpc.
--    Funções de trigger saem de cena por completo: o privilégio de
--    EXECUTE é checado na criação do trigger, não a cada disparo.
-- ---------------------------------------------------------------------
revoke execute on function public.auth_role()    from public, anon;
revoke execute on function public.is_dono()      from public, anon;
revoke execute on function public.is_staff()     from public, anon;
revoke execute on function public.config_texto(text, text)    from public, anon;
revoke execute on function public.config_bool(text, boolean)  from public, anon;
revoke execute on function public.config_num(text, numeric)   from public, anon;

revoke execute on function public.fn_touch_updated_at()               from public, anon, authenticated;
revoke execute on function public.fn_recalcula_orcamento()            from public, anon, authenticated;
revoke execute on function public.fn_recalcula_orcamento_desconto()   from public, anon, authenticated;
revoke execute on function public.fn_registra_movimentacao()          from public, anon, authenticated;
revoke execute on function public.fn_valida_entrega()                 from public, anon, authenticated;
revoke execute on function public.fn_bloqueia_orcamento_aprovado()    from public, anon, authenticated;
revoke execute on function public.fn_bloqueia_item_de_orcamento_aprovado() from public, anon, authenticated;
revoke execute on function public.fn_pedido_itens_congelado()         from public, anon, authenticated;

-- as policies e views chamam estas com o papel do próprio usuário
grant execute on function public.auth_role()   to authenticated;
grant execute on function public.is_dono()     to authenticated;
grant execute on function public.is_staff()    to authenticated;
grant execute on function public.config_texto(text, text)   to authenticated;
grant execute on function public.config_bool(text, boolean) to authenticated;
grant execute on function public.config_num(text, numeric)  to authenticated;

-- 5. pg_trgm fora do schema public
alter extension pg_trgm set schema extensions;
