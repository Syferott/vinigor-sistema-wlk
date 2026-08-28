# VINIGOR — Sistema de Gestão

Sistema web de gestão de serviços da VINIGOR Gráfica: do orçamento à entrega,
com quadro de produção, histórico de preços por cliente, controle de sinal e
saldo, e relatório de faturamento.

Fase 1 (MVP) do PRD v1.0.

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind v4 + shadcn/ui (Base UI) |
| Drag and drop | `dnd-kit` |
| Banco / Auth / Storage / Realtime | Supabase (PostgreSQL 15+) |
| Gráficos | Recharts |

## Subir o projeto

### 1. Banco

Crie um projeto Supabase (região `sa-east-1`) e aplique as migrations **na
ordem**, pelo SQL Editor do painel ou pela CLI:

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push
```

Ordem e conteúdo:

| Arquivo | O que cria |
|---|---|
| `0001_base.sql` | `profiles`, helpers de papel (`is_dono`/`is_staff`), numeração sequencial, configurações, `audit_log` |
| `0002_cadastros_orcamentos.sql` | `clientes`, `servicos`, `orcamentos`, `orcamento_itens`, imutabilidade do aprovado, expiração automática |
| `0003_pedidos_kanban.sql` | `colunas`, `pedidos`, `pedido_itens`, eventos, anexos, comentários, `pagamentos`, regra de entrega com saldo, `aprovar_orcamento`, `mover_pedido` |
| `0004_views.sql` | `vw_pedido_financeiro`, `vw_historico_preco`, `vw_faturamento_mensal`, `vw_contas_receber`, rankings |
| `0005_rls.sql` | Row Level Security em todas as tabelas + grants |
| `0006_realtime_storage_seed.sql` | Realtime do quadro, bucket `artes`, catálogo inicial de serviços |
| `0007_hardening.sql` | Correções do advisor de segurança: `search_path` fixo, revogação de `EXECUTE` para `anon`, checagem de papel em `clientes_duplicados`/`saldo_devedor` |
| `0008_ativacao_explicita.sql` | Perfil novo nasce inativo; ativar é decisão explícita do dono |

### 2. Variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha com os dados do painel do Supabase (Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — só no servidor, usada pelo dono para cadastrar
  usuários. **Nunca** prefixe com `NEXT_PUBLIC_`.
- `NEXT_PUBLIC_SITE_URL` — origem usada no link de recuperação de senha.

### 3. Fechar o cadastro público

Em **Authentication → Sign In / Providers → Email**, desligue *Allow new users
to sign up*. Esta é uma gráfica, não um SaaS: ninguém deve criar a própria
conta.

Como defesa em profundidade, existe **um único caminho** para um perfil ficar
ativo: o trigger `fn_handle_new_user` cria todo perfil novo como operador
**inativo** (menos o primeiríssimo, que é o dono), e só a tela de Usuários —
que exige `service_role` — grava `ativo = true` e o papel. Papel pedido pelo
próprio usuário no metadata é ignorado. Quem se cadastrar por fora cai em
`/login?erro=inativo`.

### 4. Primeiro usuário

O primeiro usuário criado no Auth vira **dono** automaticamente. Crie-o pelo
painel do Supabase (Authentication → Users → Add user, marcando *Auto
Confirm*). Depois, esse dono cadastra os demais em **Usuários**, dentro do
sistema.

### 5. Rodar

```bash
npm install
npm run dev
```

## Perfis de acesso

| Perfil | Pode |
|---|---|
| **Dono** | Tudo: relatórios, contas a receber, totais de faturamento, cadastro de usuários. |
| **Operador** | Clientes, orçamentos, quadro, pagamentos. Vê o valor de cada pedido, **não** vê visão agregada. |

A restrição do operador está **no banco**, não só na tela: as views agregadas
(`vw_faturamento_mensal`, `vw_contas_receber`, rankings) carregam `is_dono()`
no `WHERE` e devolvem zero linhas para o operador, mesmo que alguém chame a API
direto.

## Decisões que valem conhecer

- **Nada é excluído fisicamente.** Não existe policy de `DELETE` em nenhuma
  tabela — exclusão é lógica via `deleted_at`. A única exceção é item de
  orçamento ainda em rascunho, que é edição, não exclusão.
- **Orçamento aprovado é imutável.** Um trigger barra qualquer alteração.
  Para mudar, o sistema gera uma nova versão (`ORC-2026-0142-v2`) e preserva a
  original.
- **Saldo devedor nunca é digitado.** É sempre `valor_total` menos a soma dos
  pagamentos, calculado em `vw_pedido_financeiro`.
- **Não se entrega com saldo em aberto** sem confirmar a exceção e justificar.
  A trava é um trigger (`SQLSTATE VG001`), não um `if` no front-end.
- **Vendido ≠ Recebido.** O relatório mostra os dois lado a lado: vendido é
  competência (pedidos aprovados no mês), recebido é caixa (pagamentos que
  entraram no mês).
- **Ativar usuário é ato do dono.** O trigger não tenta adivinhar quem foi
  convidado — o Auth grava `app_metadata` depois do `INSERT`, e depender dessa
  ordem deixava todo convidado inativo. Quem ativa é a server action, no único
  caminho que exige `service_role`.
- **Numeração sem corrida.** `ORC-`/`PED-` vêm de `proximo_numero()`, que é
  `SECURITY DEFINER` e está revogada do cliente.
- **Valores em `numeric(12,2)`**, nunca `float`. Datas de relatório sempre em
  `America/Sao_Paulo`.

## O que ficou para a Fase 2

Conforme o roadmap do PRD: PDF do orçamento via PDFShift (há uma versão para
impressão em `/orcamentos/[id]/imprimir` que serve de base), anexos de arte e
comentários no card (tabelas e bucket já criados), ranking de clientes e
serviços (views já criadas), exportação CSV/PDF e aviso de "pronto p/ retirada"
no WhatsApp.
