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
-- MIGRAÇÃO: aba "Documentação" (dados do motorista: CNH, CPF, telefone)
-- Se o seu banco já existia antes dessa funcionalidade, rode só o bloco
-- abaixo no SQL Editor (o restante do arquivo, acima, já foi executado).
-- =========================================================================

alter table caminhoes
  add column if not exists motorista_cnh text,
  add column if not exists motorista_cpf text,
  add column if not exists motorista_telefone text;

-- =========================================================================
-- LIMPEZA OPCIONAL: se você chegou a rodar a versão anterior deste script
-- (a que criava upload de fotos), pode rodar o bloco abaixo para remover
-- o bucket de arquivos e a coluna "documentos" que não são mais usados.
-- Se nunca rodou essa parte, pode ignorar — não tem nada para limpar.
-- =========================================================================

alter table caminhoes drop column if exists documentos;

delete from storage.objects where bucket_id = 'documentos-caminhoes';
delete from storage.buckets where id = 'documentos-caminhoes';

-- =========================================================================
-- MIGRAÇÃO: aba "ICMS a Pagar" (dentro do caminhão, só Frota Terceirizada)
-- Lançamentos simples de ICMS por CT-e: data, valor e o próprio CT-e.
-- Se o seu banco já existia antes dessa funcionalidade, rode só o bloco
-- abaixo no SQL Editor (o restante do arquivo, acima, já foi executado).
-- =========================================================================

create table if not exists icms_registros (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references caminhoes(id) on delete cascade,
  data date not null,
  valor numeric not null,
  cte text,
  criado_em timestamptz not null default now()
);

alter table icms_registros enable row level security;

create policy "usuarios autenticados - icms" on icms_registros
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
