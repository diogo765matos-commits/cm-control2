-- Bootstrap only for an empty, isolated project with Supabase Auth already installed.
-- Do not apply to production or any project that already has any of these six relations.
-- One transaction; an existing relation causes rollback without altering legacy data.
-- App access is for permanent provisioned team users. Disable public sign-up in Auth.

begin;

create table public.caminhoes (
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

create table public.viagens_semanas (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references public.caminhoes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  viagens jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.abastecimento_semanas (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references public.caminhoes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  abastecimentos jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.despesas_semanas (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references public.caminhoes(id) on delete cascade,
  inicio date not null,
  fim date not null,
  despesas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

-- Despesas gerais da empresa, sem ligação com um caminhão específico
-- (aba "Despesas Extras" do menu), organizadas por semana.
create table public.despesas_gerais_semanas (
  id bigint generated always as identity primary key,
  inicio date not null,
  fim date not null,
  despesas jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now()
);

create table public.icms_registros (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references public.caminhoes(id) on delete cascade,
  data date not null,
  valor numeric not null,
  cte text,
  criado_em timestamptz not null default now()
);

-- Existing default privileges may include anon/public; reset only these objects.
revoke all on public.caminhoes, public.viagens_semanas, public.abastecimento_semanas,
  public.despesas_semanas, public.despesas_gerais_semanas, public.icms_registros
  from public, anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.caminhoes, public.viagens_semanas,
  public.abastecimento_semanas, public.despesas_semanas, public.despesas_gerais_semanas
  to authenticated;
grant select, insert, delete on public.icms_registros to authenticated;

revoke all on sequence public.caminhoes_id_seq, public.viagens_semanas_id_seq,
  public.abastecimento_semanas_id_seq, public.despesas_semanas_id_seq,
  public.despesas_gerais_semanas_id_seq, public.icms_registros_id_seq
  from public, anon, authenticated;
grant usage on sequence public.caminhoes_id_seq, public.viagens_semanas_id_seq,
  public.abastecimento_semanas_id_seq, public.despesas_semanas_id_seq,
  public.despesas_gerais_semanas_id_seq, public.icms_registros_id_seq to authenticated;

do $bootstrap$
declare
  rel text;
begin
  foreach rel in array array['caminhoes', 'viagens_semanas', 'abastecimento_semanas',
    'despesas_semanas', 'despesas_gerais_semanas', 'icms_registros']
  loop
    execute pg_catalog.format('alter table public.%I enable row level security', rel);
    execute pg_catalog.format($policy$
      create policy legacy_equipe_permanente on public.%I for all to authenticated
      using (
        (select auth.uid()) is not null
        and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
        and not coalesce((select auth.jwt()) ? 'client_id', false)
      )
      with check (
        (select auth.uid()) is not null
        and (select auth.jwt()->>'is_anonymous') is distinct from 'true'
        and not coalesce((select auth.jwt()) ? 'client_id', false)
      )
    $policy$, rel);
  end loop;
end
$bootstrap$;

commit;
