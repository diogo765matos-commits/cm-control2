-- Cole este script inteiro no SQL Editor do seu projeto Supabase
-- (menu lateral "SQL Editor" -> "New query") e clique em RUN.
-- Cria as tabelas do CM Control e restringe o acesso a usuários logados.

create table if not exists caminhoes (
  id bigint generated always as identity primary key,
  modelo text not null,
  placa text not null unique,
  motorista text not null,
  frota text not null default 'cm',
  motorista_cnh text,
  motorista_cpf text,
  motorista_telefone text,
  documentos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists viagens_semanas (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references caminhoes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  viagens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists abastecimento_semanas (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references caminhoes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  abastecimentos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table if not exists despesas_semanas (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references caminhoes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  despesas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

-- Despesas gerais da empresa, sem ligação com um caminhão específico
-- (aba "Despesas Extras" do menu), organizadas por semana.
create table if not exists despesas_gerais_semanas (
  id bigint generated always as identity primary key,
  inicio date not null,
  fim date not null,
  despesas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

alter table caminhoes enable row level security;
alter table viagens_semanas enable row level security;
alter table abastecimento_semanas enable row level security;
alter table despesas_semanas enable row level security;
alter table despesas_gerais_semanas enable row level security;

-- Qualquer pessoa com login válido (criado por você no painel do Supabase)
-- pode ler e escrever em todas as tabelas. Não existe cadastro público:
-- só quem você criar em Authentication -> Users consegue entrar.

create policy "usuarios autenticados - caminhoes" on caminhoes
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "usuarios autenticados - viagens" on viagens_semanas
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "usuarios autenticados - abastecimentos" on abastecimento_semanas
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "usuarios autenticados - despesas" on despesas_semanas
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "usuarios autenticados - despesas gerais" on despesas_gerais_semanas
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- =========================================================================
-- MIGRAÇÃO: aba "Documentação" (dados do motorista + fotos de documentos)
-- Se o seu banco já existia antes dessa funcionalidade, rode só o bloco
-- abaixo no SQL Editor (o restante do arquivo, acima, já foi executado).
-- =========================================================================

alter table caminhoes
  add column if not exists motorista_cnh text,
  add column if not exists motorista_cpf text,
  add column if not exists motorista_telefone text,
  add column if not exists documentos jsonb not null default '[]'::jsonb;

-- Bucket de Storage onde ficam as fotos dos documentos. Leitura pública
-- (para as fotos aparecerem sem precisar de login em cada requisição),
-- mas só usuários autenticados do sistema podem enviar ou apagar arquivos.
insert into storage.buckets (id, name, public)
values ('documentos-caminhoes', 'documentos-caminhoes', true)
on conflict (id) do nothing;

create policy "leitura publica - documentos caminhoes"
  on storage.objects for select
  using (bucket_id = 'documentos-caminhoes');

create policy "upload autenticado - documentos caminhoes"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documentos-caminhoes');

create policy "exclusao autenticada - documentos caminhoes"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documentos-caminhoes');
