-- =====================================================================
-- VINIGOR — 0012: ajustes pedidos pela operação
--   · coluna "Instalação", depois de Entregue
--   · "A/C" no orçamento (a quem o documento é endereçado)
--   · condições de pagamento padrão por cliente
-- =====================================================================

-- ---------------------------------------------------------------------
-- Instalação entra DEPOIS de Entregue. Entregue continua sendo is_final,
-- então a trava de saldo devedor (RF-29) segue valendo na entrega — que
-- é onde o dinheiro precisa ter entrado. Instalação é etapa de serviço.
-- ---------------------------------------------------------------------
update public.colunas set ordem = 11 where slug = 'cancelado';

insert into public.colunas (slug, nome, ordem, cor, is_final, is_cancelado)
values ('instalacao', 'Instalação', 10, '#0EA5E9', false, false)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- A/C — "aos cuidados de". O orçamento vai para a empresa, mas quem
-- recebe tem nome. Sai no cabeçalho do documento impresso.
-- ---------------------------------------------------------------------
alter table public.orcamentos
  add column aos_cuidados text;

comment on column public.orcamentos.aos_cuidados is
  'Pessoa a quem o orçamento é endereçado dentro do cliente (ex.: A/C Luciana).';

-- ---------------------------------------------------------------------
-- Condições de pagamento que se repetem para o mesmo cliente (dados
-- bancários, prazo combinado). Ficam no cadastro e entram sozinhas no
-- orçamento, onde ainda podem ser editadas caso a caso.
-- ---------------------------------------------------------------------
alter table public.clientes
  add column condicoes_padrao text;

comment on column public.clientes.condicoes_padrao is
  'Texto de condições/observações que entra por padrão nos orçamentos deste cliente.';
