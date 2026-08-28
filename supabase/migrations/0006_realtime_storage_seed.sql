-- =====================================================================
-- VINIGOR — 0006: realtime do quadro, storage de artes e catálogo inicial
-- =====================================================================

-- RNF-02: dois usuários movendo cards veem a mudança na hora
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.pedido_comentarios;

-- RF-24: bucket privado para arquivos de arte
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artes', 'artes', false, 52428800,
  array[
    'application/pdf','image/jpeg','image/png','image/webp','image/svg+xml',
    'application/postscript','application/illustrator','application/x-coreldraw',
    'application/octet-stream','application/zip'
  ]
)
on conflict (id) do nothing;

create policy artes_select on storage.objects
  for select to authenticated
  using (bucket_id = 'artes' and public.is_staff());

create policy artes_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artes' and public.is_staff());

create policy artes_update on storage.objects
  for update to authenticated
  using (bucket_id = 'artes' and public.is_staff())
  with check (bucket_id = 'artes' and public.is_staff());

create policy artes_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'artes' and public.is_dono());

-- ---------------------------------------------------------------------
-- Catálogo inicial (RF-05). Preço-base é sugestão, não trava (RF-06).
-- ---------------------------------------------------------------------
insert into public.servicos (nome, unidade, preco_base, descricao_padrao) values
  ('Banner em lona 440g',        'm2',       75.00,  'Lona 440g, impressão digital, bastão e cordão'),
  ('Banner em lona 280g',        'm2',       55.00,  'Lona 280g, impressão digital, bastão e cordão'),
  ('Adesivo vinil brilho',       'm2',       80.00,  'Vinil branco brilho, recorte reto'),
  ('Adesivo vinil recorte',      'm2',      120.00,  'Recorte eletrônico em vinil, aplicação com transfer'),
  ('Adesivo perfurado',          'm2',       95.00,  'Vinil perfurado para vidro, com laminação'),
  ('Cartão de visita 4x4',       'milheiro', 90.00,  'Couché 300g, 4x4 cores, laminação fosca, 9x5cm'),
  ('Cartão de visita 4x0',       'milheiro', 70.00,  'Couché 300g, 4x0 cores, sem laminação, 9x5cm'),
  ('Panfleto A5 4x4',            'milheiro',150.00,  'Couché 90g, 4x4 cores, 15x21cm'),
  ('Panfleto A6 4x0',            'milheiro', 95.00,  'Couché 90g, 4x0 cores, 10x15cm'),
  ('Folder A4 dobrado',          'milheiro',280.00,  'Couché 150g, 4x4 cores, uma dobra'),
  ('Plotagem em lona',           'm2',       70.00,  'Impressão digital em lona, acabamento a definir'),
  ('Plotagem de veículo',        'm2',      180.00,  'Vinil automotivo, aplicação inclusa'),
  ('Camisa personalizada',       'un',       45.00,  'Malha PV, estampa em silk ou DTF, tamanho a definir'),
  ('Camisa DTF',                 'un',       55.00,  'Impressão DTF, algodão 30.1 penteado'),
  ('Faixa em lona',              'm2',       65.00,  'Lona 440g com bainha e ilhós'),
  ('Placa em ACM',               'm2',      420.00,  'ACM 3mm com adesivo vinil aplicado'),
  ('Placa em PS 2mm',            'm2',      180.00,  'Poliestireno 2mm com adesivo aplicado'),
  ('Letra caixa em PVC',         'un',       85.00,  'PVC expandido 10mm, pintura automotiva'),
  ('Fachada em lona tensionada', 'm2',      150.00,  'Estrutura metálica + lona tensionada'),
  ('Bloco de pedido 1 via',      'cento',   120.00,  'Sulfite 75g, 100 folhas, 1x0 cor'),
  ('Talão 2 vias',               'cento',   180.00,  'Autocopiativo 2 vias, numerado'),
  ('Impressão A4 colorida',      'un',        2.00,  'Sulfite 75g, 4x0'),
  ('Impressão A4 P&B',           'un',        0.50,  'Sulfite 75g, 1x0'),
  ('Encadernação espiral',       'un',       12.00,  'Capa transparente e contracapa preta'),
  ('Arte / criação',             'hora',     80.00,  'Criação ou adequação de arte pelo designer');
