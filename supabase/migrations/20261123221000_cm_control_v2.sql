-- C&M Control V2: aditivo. Ensaiar em cópia isolada antes de considerar produção.
begin;

create table public.v2_motoristas (
  id bigint generated always as identity primary key,
  nome text not null check (btrim(nome) <> ''),
  frota text not null check (frota in ('cm', 'terceirizada')),
  ativo boolean not null default true,
  caminhao_origem_id bigint unique references public.caminhoes(id) on delete restrict,
  check (caminhao_origem_id is null or frota = 'terceirizada')
);

create table public.v2_alocacoes (
  id bigint generated always as identity primary key,
  caminhao_id bigint not null references public.caminhoes(id) on delete restrict,
  motorista_id bigint references public.v2_motoristas(id) on delete restrict,
  inicio timestamptz not null default statement_timestamp(),
  criado_em timestamptz not null default statement_timestamp(),
  check (inicio <= criado_em),
  unique (caminhao_id, inicio)
);
create index v2_alocacoes_motorista_idx on public.v2_alocacoes (motorista_id, inicio desc);

create table public.v2_taxas (
  id bigint generated always as identity primary key,
  frota text not null check (frota in ('cm', 'terceirizada')),
  vigencia date not null,
  percentual numeric(5,2) not null check (percentual between 0 and 100),
  unique (frota, vigencia)
);

create table public.v2_despesas_motoristas (
  id bigint generated always as identity primary key,
  motorista_id bigint not null references public.v2_motoristas(id) on delete restrict,
  data date not null,
  descricao text not null check (btrim(descricao) <> ''),
  valor numeric(14,2) not null check (valor > 0 and valor < 'Infinity'::numeric),
  adiantamento boolean not null default false,
  recuperado numeric(14,2) not null default 0 check (recuperado >= 0 and recuperado < 'Infinity'::numeric),
  excluido_em timestamptz,
  chave_cliente uuid unique,
  check (recuperado <= valor and (adiantamento or recuperado = 0))
);
create index v2_despesas_motoristas_data_idx on public.v2_despesas_motoristas (data desc);
create index v2_despesas_motoristas_perfil_idx on public.v2_despesas_motoristas (motorista_id, data desc);

-- Preservar o modelo atual de equipe compartilhada (somente contas autenticadas,
-- permanentes e provisionadas). O runbook exige verificar cadastro público desligado.
-- Não habilitar signup público sem antes introduzir autorização por membros no app.
alter table public.v2_motoristas enable row level security;
alter table public.v2_alocacoes enable row level security;
alter table public.v2_taxas enable row level security;
alter table public.v2_despesas_motoristas enable row level security;

revoke all on public.v2_motoristas, public.v2_alocacoes, public.v2_taxas, public.v2_despesas_motoristas
  from public, anon, authenticated;
revoke all on sequence public.v2_motoristas_id_seq, public.v2_alocacoes_id_seq,
  public.v2_taxas_id_seq, public.v2_despesas_motoristas_id_seq from public, anon, authenticated;
grant usage on sequence public.v2_motoristas_id_seq, public.v2_alocacoes_id_seq,
  public.v2_taxas_id_seq, public.v2_despesas_motoristas_id_seq to authenticated;

grant select on public.v2_motoristas, public.v2_alocacoes, public.v2_taxas, public.v2_despesas_motoristas to authenticated;
grant insert (nome, frota, ativo), update (nome, ativo) on public.v2_motoristas to authenticated;
grant insert (caminhao_id, motorista_id, inicio) on public.v2_alocacoes to authenticated;
grant insert (frota, vigencia, percentual) on public.v2_taxas to authenticated;
grant insert (motorista_id, data, descricao, valor, adiantamento, recuperado, chave_cliente),
      update (motorista_id, data, descricao, valor, adiantamento, recuperado, excluido_em)
  on public.v2_despesas_motoristas to authenticated;

-- Acesso da equipe não implica acesso do Jarvis. A integração OAuth é
-- somente leitura; a presença do claim client_id caracteriza essa sessão
-- mesmo com valor malformado. Se o classificador da beta anterior existir,
-- respeite também suas contas dedicadas (inclusive sem client_id).
create function public.v2_sessao_equipe() returns boolean
language plpgsql stable security invoker set search_path = '' as $$
declare
  v_classificador pg_catalog.regprocedure;
  v_dedicado boolean;
begin
  if (select auth.uid()) is null
    or (select auth.jwt()->>'is_anonymous') = 'true'
    or coalesce((select auth.jwt()) ? 'client_id', false) then
    return false;
  end if;
  v_classificador := pg_catalog.to_regprocedure('public.cm_is_integration_principal()');
  if v_classificador is not null then
    if not pg_catalog.has_function_privilege(v_classificador::oid, 'EXECUTE') then
      return false;
    end if;
    execute 'select public.cm_is_integration_principal()' into v_dedicado;
    return v_dedicado is false;
  end if;
  return true;
end;
$$;
revoke all on function public.v2_sessao_equipe() from public, anon, authenticated;
grant execute on function public.v2_sessao_equipe() to authenticated;

create policy v2_motoristas_equipe on public.v2_motoristas for all to authenticated
  using ((select public.v2_sessao_equipe()))
  with check ((select public.v2_sessao_equipe()));

create policy v2_alocacoes_equipe_leitura on public.v2_alocacoes for select to authenticated
  using ((select public.v2_sessao_equipe()));
create policy v2_alocacoes_equipe_inclusao on public.v2_alocacoes for insert to authenticated with check (
  (select public.v2_sessao_equipe())
  and exists (
    select 1 from public.caminhoes c
    where c.id = caminhao_id and c.frota = 'cm'
      and (motorista_id is null or exists (
        select 1 from public.v2_motoristas m where m.id = motorista_id and m.frota = c.frota and m.ativo
      ))
  )
);

create policy v2_taxas_equipe on public.v2_taxas for all to authenticated
  using ((select public.v2_sessao_equipe()))
  with check ((select public.v2_sessao_equipe()));

create policy v2_despesas_motoristas_equipe on public.v2_despesas_motoristas for all to authenticated
  using ((select public.v2_sessao_equipe()))
  with check ((select public.v2_sessao_equipe()));

-- Só cria referências independentes para o legado terceirizado não ambíguo.
-- Não reescreve viagens, não vincula frota própria e não copia documentos pessoais.
insert into public.v2_motoristas (nome, frota, caminhao_origem_id)
select btrim(c.motorista), 'terceirizada', c.id
from public.caminhoes c
where c.frota = 'terceirizada'
  and btrim(c.motorista) <> ''
  and lower(btrim(c.motorista)) not in ('-', 'sem motorista', 'não informado', 'nao informado')
  and (
    select count(*) from public.caminhoes d
    where d.frota = 'terceirizada'
      and lower(regexp_replace(btrim(d.motorista), '[[:space:]]+', ' ', 'g'))
         = lower(regexp_replace(btrim(c.motorista), '[[:space:]]+', ' ', 'g'))
  ) = 1;

create function public.v2_adicionar_viagem(
  p_caminhao_id bigint, p_inicio date, p_fim date, p_viagem jsonb
) returns public.viagens_semanas
language plpgsql security invoker set search_path = '' as $$
declare
  v_caminhao public.caminhoes%rowtype;
  v_semana public.viagens_semanas%rowtype;
  v_motorista public.v2_motoristas%rowtype;
  v_data date;
  v_data_entrega date;
  v_id text;
  v_payload jsonb;
  v_existente jsonb;
  v_quantidade bigint;
  v_percentual numeric;
begin
  if not (select public.v2_sessao_equipe()) then
    raise exception 'Sessão de equipe necessária.' using errcode = '42501';
  end if;
  v_id := p_viagem->>'id';
  if p_caminhao_id is null or p_inicio is null or p_fim is null or p_inicio > p_fim
    or jsonb_typeof(p_viagem) is distinct from 'object'
    or jsonb_typeof(p_viagem->'id') is distinct from 'number'
    or v_id !~ '^[1-9][0-9]{12}$'
    or coalesce(p_viagem->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(p_viagem->>'dataEntrega','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or btrim(coalesce(p_viagem->>'nf','')) = ''
    or (coalesce(p_viagem->>'volFiscal','') <> '' and
        coalesce(p_viagem->>'volFiscal','') !~ '^[0-9]{1,12}([.][0-9]{1,8})?$')
    or coalesce(p_viagem->>'motoristaId','') !~ '^[1-9][0-9]{0,18}$'
    or coalesce(p_viagem->>'volEntregue','') !~ '^[0-9]{1,12}([.][0-9]{1,8})?$'
    or coalesce(p_viagem->>'taxa','') !~ '^[0-9]{1,12}([.][0-9]{1,8})?$'
    or coalesce(p_viagem->>'percentualAplicado','') !~ '^[0-9]{1,3}([.][0-9]{1,2})?$' then
    raise exception 'Dados da viagem inválidos.' using errcode = '22023';
  end if;
  v_data := (p_viagem->>'data')::date;
  v_data_entrega := (p_viagem->>'dataEntrega')::date;
  if v_data not between p_inicio and p_fim or v_data_entrega < v_data
    or (p_viagem->>'volEntregue')::numeric <= 0 or (p_viagem->>'taxa')::numeric <= 0 then
    raise exception 'Confira o período, os volumes e o frete.' using errcode = '22023';
  end if;

  -- O bloqueio por caminhão serializa criações V2; o de linha coordena
  -- o acréscimo com as escritas compare-and-swap do formulário legado.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cm-v2:viagens:' || p_caminhao_id, 0));
  select c.* into v_caminhao from public.caminhoes c where c.id = p_caminhao_id;
  if not found or v_caminhao.frota not in ('cm', 'terceirizada') then
    raise exception 'Use o fluxo original para esta frota.' using errcode = '22023';
  end if;

  select count(*) into v_quantidade from public.viagens_semanas s
    where s.caminhao_id = p_caminhao_id and v_data between s.inicio and s.fim;
  if v_quantidade > 1 then
    raise exception 'Há semanas de viagens sobrepostas. Nenhum registro foi alterado.' using errcode = '23514';
  elsif v_quantidade = 1 then
    select s.* into v_semana from public.viagens_semanas s
      where s.caminhao_id = p_caminhao_id and v_data between s.inicio and s.fim for update;
    if not found or v_semana.inicio <> p_inicio or v_semana.fim <> p_fim then
      raise exception 'O período mudou. Atualize a página antes de tentar novamente.' using errcode = '23514';
    end if;
    select item into v_existente from pg_catalog.jsonb_array_elements(v_semana.viagens) item where item->>'id' = v_id;
    if found then
      if v_existente @> (p_viagem - array['motoristaNome','placaRegistrada','frotaRegistrada']) then
        return v_semana;
      end if;
      raise exception 'Identificador de viagem já usado com outros dados.' using errcode = '23505';
    end if;
  else
    if exists (select 1 from public.viagens_semanas s where s.caminhao_id = p_caminhao_id
        and s.inicio <= p_fim and s.fim >= p_inicio) then
      raise exception 'O período sobrepõe outra semana. Nenhum registro foi alterado.' using errcode = '23514';
    end if;
    if extract(isodow from p_inicio) <> 1 or p_fim <> p_inicio + 5 then
      raise exception 'Cadastre novas semanas de segunda a sábado.' using errcode = '22023';
    end if;
  end if;

  select m.* into v_motorista from public.v2_motoristas m
    where m.id = (p_viagem->>'motoristaId')::bigint and m.frota = v_caminhao.frota and m.ativo;
  if not found then
    raise exception 'Motorista ativo não encontrado para a frota do caminhão.' using errcode = '22023';
  end if;
  select t.percentual into v_percentual from public.v2_taxas t
    where t.frota = v_caminhao.frota and t.vigencia <= v_data order by t.vigencia desc limit 1;
  v_percentual := coalesce(v_percentual, case v_caminhao.frota when 'cm' then 10 else 11 end);
  if (p_viagem->>'percentualAplicado')::numeric <> v_percentual then
    raise exception 'A taxa vigente mudou. Atualize a página e confira o percentual.' using errcode = '23514';
  end if;
  -- Salva os valores no registro canônico; nenhum vínculo separado por perfil.
  v_payload := p_viagem || pg_catalog.jsonb_build_object(
    'motoristaNome', v_motorista.nome, 'placaRegistrada', v_caminhao.placa,
    'frotaRegistrada', v_caminhao.frota, 'percentualAplicado', v_percentual
  );
  if v_semana.id is null then
    insert into public.viagens_semanas (caminhao_id, inicio, fim, viagens)
      values (p_caminhao_id, p_inicio, p_fim, pg_catalog.jsonb_build_array(v_payload)) returning * into v_semana;
  else
    update public.viagens_semanas set viagens = v_semana.viagens || pg_catalog.jsonb_build_array(v_payload)
      where id = v_semana.id returning * into v_semana;
  end if;
  return v_semana;
end;
$$;

create function public.v2_adicionar_despesa(
  p_caminhao_id bigint, p_inicio date, p_fim date, p_despesa jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_data date;
  v_id text;
  v_quantidade bigint;
  v_semana record;
  v_existente jsonb;
  v_resultado jsonb;
begin
  if not (select public.v2_sessao_equipe()) then
    raise exception 'Sessão de equipe necessária.' using errcode = '42501';
  end if;
  v_id := p_despesa->>'id';
  if p_inicio is null or p_fim is null or p_inicio > p_fim
    or jsonb_typeof(p_despesa) is distinct from 'object'
    or jsonb_typeof(p_despesa->'id') is distinct from 'number' or v_id !~ '^[1-9][0-9]{12}$'
    or coalesce(p_despesa->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or btrim(coalesce(p_despesa->>'descricao','')) = ''
    or coalesce(p_despesa->>'valor','') !~ '^[0-9]{1,12}([.][0-9]{1,2})?$'
    or p_despesa ?| array['adiantamento','recuperado','motorista_id'] then
    raise exception 'Dados da despesa inválidos.' using errcode = '22023';
  end if;
  v_data := (p_despesa->>'data')::date;
  if v_data not between p_inicio and p_fim or (p_despesa->>'valor')::numeric <= 0 then
    raise exception 'Confira o período e o valor da despesa.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('cm-v2:despesas:' || coalesce(p_caminhao_id::text, 'geral'), 0));

  if p_caminhao_id is null then
    select count(*) into v_quantidade from public.despesas_gerais_semanas s where v_data between s.inicio and s.fim;
  else
    select count(*) into v_quantidade from public.despesas_semanas s
      where s.caminhao_id = p_caminhao_id and v_data between s.inicio and s.fim;
  end if;

  if v_quantidade > 1 then
    raise exception 'Há semanas de despesas sobrepostas. Nenhum registro foi alterado.' using errcode = '23514';
  elsif v_quantidade = 1 then
    if p_caminhao_id is null then
      select s.* into v_semana from public.despesas_gerais_semanas s where v_data between s.inicio and s.fim for update;
    else
      select s.* into v_semana from public.despesas_semanas s
        where s.caminhao_id = p_caminhao_id and v_data between s.inicio and s.fim for update;
    end if;
    if not found or v_semana.inicio <> p_inicio or v_semana.fim <> p_fim then
      raise exception 'O período mudou. Atualize a página antes de tentar novamente.' using errcode = '23514';
    end if;
    select item into v_existente from pg_catalog.jsonb_array_elements(v_semana.despesas) item where item->>'id' = v_id;
    if found then
      if v_existente = p_despesa then return pg_catalog.to_jsonb(v_semana); end if;
      raise exception 'Identificador de despesa já usado com outros dados.' using errcode = '23505';
    end if;
    if p_caminhao_id is null then
      update public.despesas_gerais_semanas as s
        set despesas = v_semana.despesas || pg_catalog.jsonb_build_array(p_despesa)
        where s.id = v_semana.id returning pg_catalog.to_jsonb(s) into v_resultado;
    else
      update public.despesas_semanas as s
        set despesas = v_semana.despesas || pg_catalog.jsonb_build_array(p_despesa)
        where s.id = v_semana.id returning pg_catalog.to_jsonb(s) into v_resultado;
    end if;
  else
    if exists (select 1 from public.despesas_gerais_semanas s where p_caminhao_id is null and s.inicio <= p_fim and s.fim >= p_inicio)
      or exists (select 1 from public.despesas_semanas s where s.caminhao_id = p_caminhao_id and s.inicio <= p_fim and s.fim >= p_inicio) then
      raise exception 'O período sobrepõe outra semana. Nenhum registro foi alterado.' using errcode = '23514';
    end if;
    if extract(isodow from p_inicio) <> 1 or p_fim <> p_inicio + 5 then
      raise exception 'Cadastre novas semanas de segunda a sábado.' using errcode = '22023';
    end if;
    if p_caminhao_id is null then
      insert into public.despesas_gerais_semanas as s (inicio, fim, despesas)
        values (p_inicio, p_fim, pg_catalog.jsonb_build_array(p_despesa)) returning pg_catalog.to_jsonb(s) into v_resultado;
    else
      insert into public.despesas_semanas as s (caminhao_id, inicio, fim, despesas)
        values (p_caminhao_id, p_inicio, p_fim, pg_catalog.jsonb_build_array(p_despesa)) returning pg_catalog.to_jsonb(s) into v_resultado;
    end if;
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.v2_adicionar_viagem(bigint, date, date, jsonb)
  from public, anon, authenticated;
revoke all on function public.v2_adicionar_despesa(bigint, date, date, jsonb)
  from public, anon, authenticated;
grant execute on function public.v2_adicionar_viagem(bigint, date, date, jsonb) to authenticated;
grant execute on function public.v2_adicionar_despesa(bigint, date, date, jsonb) to authenticated;
commit;
