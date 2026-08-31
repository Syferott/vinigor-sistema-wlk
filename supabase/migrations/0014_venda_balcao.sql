-- =====================================================================
-- VINIGOR — 0014: venda de balcão
--
-- Impressão avulsa, encadernação, cartão pronto: orçar cada uma custa
-- mais que a venda. Aqui o pedido nasce direto, sem orçamento, e os
-- itens continuam alimentando o histórico de preço do cliente (RF-11),
-- porque vw_historico_preco lê de pedido_itens.
--
-- A venda entra em "Aprovado" e só então é movida para "Entregue", em
-- vez de nascer entregue. Parece rodeio, mas é de propósito: mover é o
-- que dispara fn_valida_entrega, então a trava de saldo devedor (RF-29)
-- vale igual no balcão. Nascer entregue furaria a regra.
-- =====================================================================

create or replace function public.criar_venda_balcao(
  p_cliente_id       uuid,
  p_itens            jsonb,
  p_entrega_imediata boolean default true,
  p_pagamento_valor  numeric default null,
  p_pagamento_forma  text default null,
  p_observacoes      text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido   uuid;
  v_coluna   uuid;
  v_entregue uuid;
  v_posicao  integer;
  v_total    numeric(12,2);
  v_item     jsonb;
  v_ordem    integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Sem permissão.';
  end if;

  if p_cliente_id is null then
    raise exception 'Escolha o cliente da venda.';
  end if;

  if p_itens is null or jsonb_array_length(p_itens) = 0 then
    raise exception 'A venda precisa de ao menos um item.';
  end if;

  select coalesce(sum(
           round((i ->> 'quantidade')::numeric * (i ->> 'preco_unitario')::numeric, 2)
         ), 0)
  into v_total
  from jsonb_array_elements(p_itens) i;

  if v_total <= 0 then
    raise exception 'O total da venda precisa ser maior que zero.';
  end if;

  select id into v_coluna   from public.colunas where slug = 'aprovado';
  select id into v_entregue from public.colunas where slug = 'entregue';

  select coalesce(max(posicao), 0) + 1 into v_posicao
  from public.pedidos where coluna_id = v_coluna and deleted_at is null;

  insert into public.pedidos (
    numero, orcamento_id, cliente_id, coluna_id, posicao,
    prazo_entrega, valor_total, responsavel_id, observacoes, created_by
  ) values (
    public.proximo_numero('PED'), null, p_cliente_id, v_coluna, v_posicao,
    (now() at time zone 'America/Sao_Paulo')::date,
    v_total, auth.uid(), p_observacoes, auth.uid()
  )
  returning id into v_pedido;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_ordem := v_ordem + 1;
    insert into public.pedido_itens (
      pedido_id, servico_id, descricao, quantidade, preco_unitario, ordem
    ) values (
      v_pedido,
      nullif(v_item ->> 'servico_id', '')::uuid,
      v_item ->> 'descricao',
      (v_item ->> 'quantidade')::numeric,
      (v_item ->> 'preco_unitario')::numeric,
      v_ordem
    );
  end loop;

  if coalesce(p_pagamento_valor, 0) > 0 then
    insert into public.pagamentos (
      pedido_id, tipo, valor, forma, recebido_por, created_by
    ) values (
      v_pedido,
      case when p_pagamento_valor >= v_total then 'quitacao' else 'sinal' end,
      p_pagamento_valor,
      coalesce(p_pagamento_forma, 'dinheiro'),
      auth.uid(), auth.uid()
    );
  end if;

  -- move em vez de nascer entregue: é o UPDATE que aciona a validação
  -- de saldo devedor. Se faltar dinheiro, o erro VG001 sobe daqui.
  if p_entrega_imediata then
    update public.pedidos set coluna_id = v_entregue where id = v_pedido;
  end if;

  return v_pedido;
end
$$;

revoke execute on function public.criar_venda_balcao(uuid, jsonb, boolean, numeric, text, text) from public, anon;
grant execute on function public.criar_venda_balcao(uuid, jsonb, boolean, numeric, text, text) to authenticated;
