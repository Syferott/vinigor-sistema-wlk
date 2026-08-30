-- =====================================================================
-- VINIGOR — 0009: expiração de orçamento vira tarefa agendada
--
-- expirar_orcamentos() estava sendo chamada na renderização da lista de
-- orçamentos: um UPDATE disparado por uma leitura, a cada F5, em série
-- antes de buscar os dados. Expiração por validade é trabalho de
-- calendário, não de request.
--
-- Roda 03:05 em America/Sao_Paulo (06:05 UTC — o Brasil não tem mais
-- horário de verão desde 2019, então o deslocamento é fixo).
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'vinigor-expirar-orcamentos',
  '5 6 * * *',
  $$ select public.expirar_orcamentos() $$
);
