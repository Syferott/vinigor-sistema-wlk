-- =====================================================================
-- VINIGOR — 0005: Row Level Security
--
-- Regra central (PRD 6.2):
--   dono     -> tudo
--   operador -> opera (clientes, orçamentos, pedidos, pagamentos),
--               mas nunca enxerga visão agregada de faturamento
--   ninguém  -> DELETE físico. Não existe policy de DELETE em nenhuma
--               tabela: exclusão é sempre lógica via deleted_at (RF-44).
-- =====================================================================

alter table public.profiles           enable row level security;
alter table public.clientes           enable row level security;
alter table public.servicos           enable row level security;
alter table public.orcamentos         enable row level security;
alter table public.orcamento_itens    enable row level security;
alter table public.colunas            enable row level security;
alter table public.pedidos            enable row level security;
alter table public.pedido_itens       enable row level security;
alter table public.pedido_eventos     enable row level security;
alter table public.pedido_anexos      enable row level security;
alter table public.pedido_comentarios enable row level security;
alter table public.pagamentos         enable row level security;
alter table public.configuracoes      enable row level security;
alter table public.audit_log          enable row level security;
alter table public.numeracao          enable row level security;

-- ---------------------------------------------------------------------
-- profiles — leitura para o staff (precisa dos nomes de responsável /
-- quem recebeu); escrita apenas para o dono (RF-41).
-- ---------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_staff() or id = (select auth.uid()));

create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.is_dono());

create policy profiles_update on public.profiles
  for update to authenticated
  using (public.is_dono()) with check (public.is_dono());

-- ---------------------------------------------------------------------
-- Operação — leitura e escrita para dono e operador
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'clientes','servicos','orcamentos','orcamento_itens',
    'pedidos','pedido_itens','pedido_eventos',
    'pedido_anexos','pedido_comentarios','pagamentos'
  ]
  loop
    execute format(
      'create policy %1$s_select on public.%1$s for select to authenticated using (public.is_staff())', t);
    execute format(
      'create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_staff())', t);
    execute format(
      'create policy %1$s_update on public.%1$s for update to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end
$$;

-- Única exceção à regra de "nenhum DELETE": item de orçamento ainda em
-- rascunho é edição, não exclusão de registro. Em orçamento aprovado o
-- trigger tg_orc_itens_imutavel barra o delete de qualquer forma (RF-16).
create policy orcamento_itens_delete on public.orcamento_itens
  for delete to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------
-- Colunas do quadro — todos leem, só o dono reconfigura
-- ---------------------------------------------------------------------
create policy colunas_select on public.colunas
  for select to authenticated using (public.is_staff());
create policy colunas_write on public.colunas
  for insert to authenticated with check (public.is_dono());
create policy colunas_update on public.colunas
  for update to authenticated using (public.is_dono()) with check (public.is_dono());

-- ---------------------------------------------------------------------
-- Configurações — todos leem (o front precisa do % de sinal),
-- só o dono altera
-- ---------------------------------------------------------------------
create policy configuracoes_select on public.configuracoes
  for select to authenticated using (public.is_staff());
create policy configuracoes_update on public.configuracoes
  for update to authenticated using (public.is_dono()) with check (public.is_dono());

-- ---------------------------------------------------------------------
-- Auditoria — leitura só do dono; escrita apenas via trigger
-- (fn_audit é SECURITY DEFINER e não passa por policy).
-- ---------------------------------------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated using (public.is_dono());

-- numeracao: nenhuma policy. Só proximo_numero() (SECURITY DEFINER) toca.

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
grant select on
  public.vw_pedido_financeiro,
  public.vw_historico_preco,
  public.vw_faturamento_mensal,
  public.vw_contas_receber,
  public.vw_ranking_clientes,
  public.vw_servicos_vendidos,
  public.vw_evolucao_preco_servico
to authenticated;

revoke all on public.numeracao from anon, authenticated;

-- Funções internas não devem ser chamáveis direto pelo cliente
revoke execute on function public.proximo_numero(text)            from public, anon, authenticated;
revoke execute on function public.fn_audit()                      from public, anon, authenticated;
revoke execute on function public.fn_handle_new_user()            from public, anon, authenticated;

-- Funções de negócio: só usuário autenticado (a checagem de papel está dentro)
revoke execute on function public.aprovar_orcamento(uuid, date, uuid)  from public, anon;
revoke execute on function public.nova_versao_orcamento(uuid)          from public, anon;
revoke execute on function public.mover_pedido(uuid, uuid, integer)    from public, anon;
revoke execute on function public.expirar_orcamentos()                 from public, anon;
revoke execute on function public.clientes_duplicados(text, text, uuid) from public, anon;
revoke execute on function public.saldo_devedor(uuid)                  from public, anon;
revoke execute on function public.criar_orcamento(uuid, date, integer, text) from public, anon;
revoke execute on function public.repetir_orcamento(uuid, uuid)        from public, anon;

grant execute on function public.aprovar_orcamento(uuid, date, uuid)   to authenticated;
grant execute on function public.nova_versao_orcamento(uuid)           to authenticated;
grant execute on function public.mover_pedido(uuid, uuid, integer)     to authenticated;
grant execute on function public.expirar_orcamentos()                  to authenticated;
grant execute on function public.clientes_duplicados(text, text, uuid) to authenticated;
grant execute on function public.saldo_devedor(uuid)                   to authenticated;
grant execute on function public.criar_orcamento(uuid, date, integer, text) to authenticated;
grant execute on function public.repetir_orcamento(uuid, uuid)         to authenticated;
