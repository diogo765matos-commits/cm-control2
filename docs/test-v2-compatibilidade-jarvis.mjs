// Local, synthetic, in-memory only. Requires the reviewed source of the prior
// Jarvis candidate; it does not use its server, credentials, or real project.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const jarvis = process.env.JARVIS_SOURCE;
const pglite = process.env.PGLITE_MODULE;
if (!jarvis || !pglite) throw new Error('Informe JARVIS_SOURCE e PGLITE_MODULE, ambos locais.');
const { PGlite } = await import(pglite.startsWith('/') ? pathToFileURL(pglite).href : pglite);
const legado = (await readFile(new URL('../supabase-schema.sql', import.meta.url), 'utf8')).split('-- =========================================================================')[0];
const v2 = await readFile(new URL('../supabase/migrations/20261123221000_cm_control_v2.sql', import.meta.url), 'utf8');
const migrations = join(jarvis, 'supabase', 'migrations');
const jarvisSql = await Promise.all(['20261015_viagens_rpc.sql','20261016_oauth_readonly.sql'].map(file =>
  readFile(join(migrations, file), 'utf8')));
const ui = '99999999-0000-4000-8000-000000000001';
const oauth = '99999999-0000-4000-8000-000000000002';
const stored = { id:1795031393100, data:'2026-11-19', dataEntrega:'2026-11-19', nf:'00012 A', cte:'0-13', volFiscal:100, volEntregue:107.23, taxa:37.77 };
const v2Trip = { ...stored, id:1795031393101, nf:'00020 B', cte:'0-21', motoristaId:1, percentualAplicado:10 };
const claims = (db, sub, client) => db.query('select set_config($1,$2,false)',
  ['test.jwt', JSON.stringify({sub,role:'authenticated', ...(client ? {client_id:client} : {})})]);
const fixture = await PGlite.create();
await fixture.exec(`
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
grant usage on schema auth to authenticated, anon;
` + legado + `
grant select,insert,update on public.caminhoes,public.viagens_semanas,public.despesas_semanas,public.despesas_gerais_semanas to authenticated;
grant usage on all sequences in schema public to authenticated;
insert into auth.users values ('${ui}'),('${oauth}');
insert into caminhoes(modelo,placa,motorista,frota) values ('Modelo','TST9A44','Condutor sintético','cm');
`);
await fixture.query('insert into viagens_semanas(caminhao_id,inicio,fim,viagens) values(1,$1,$2,$3)', ['2026-11-16','2026-11-21',JSON.stringify([stored])]);
async function restore(db) {
  const before = (await db.query('select * from viagens_semanas order by id')).rows;
  const archive = await db.dumpDataDir();
  const restored = await PGlite.create({ loadDataDir:archive });
  assert.deepEqual((await restored.query('select * from viagens_semanas order by id')).rows, before);
  console.log('Backup/restauração sintéticos iguais; SHA256', createHash('sha256').update(Buffer.from(await archive.arrayBuffer())).digest('hex'));
  return restored;
}
const db = await restore(fixture);
await fixture.close();
for (const script of jarvisSql) await db.exec(script);
await db.query('insert into cm_viagens_acl(user_id,caminhao_id,can_write,allow_integration) values ($1,1,true,false),($2,1,false,true)',[ui,oauth]);
await db.query("insert into cm_viagens_oauth_capabilities(user_id,client_id,capability,active) values($1,'fixture-read','cm:read',true)",[oauth]);
const subject = await restore(db);
await db.close();

const legacyRead = async (request) => (await subject.query('select public.cm_viagens_read($1) as r',[JSON.stringify(request)])).rows[0].r;
await subject.exec('set role authenticated');
await claims(subject, oauth, 'fixture-read');
const query = { action:'trips', caminhaoId:'1', limit:100, offset:0 };
const beforeRead = await legacyRead(query);
assert.deepEqual(beforeRead[0].viagens,[stored]);
await assert.rejects(subject.query('select public.cm_viagens_mutate($1)',[JSON.stringify({action:'append'})]),{code:'42501'});
await subject.exec('reset role');
await subject.exec(v2);
await subject.exec('set role authenticated');
await claims(subject, oauth, 'fixture-read');
assert.deepEqual(await legacyRead(query), beforeRead);
console.log('PASS função real Jarvis read-only: NF/CT-e crus, as duas datas, semanas e dados permanecem iguais após V2!');
await assert.rejects(subject.query('select public.cm_viagens_mutate($1)',[JSON.stringify({action:'append'})]),{code:'42501'});
await subject.exec('reset role');
const amt = (await subject.query("insert into v2_motoristas(nome,frota) values ('Fixture privada','cm') returning id")).rows[0].id;
assert.ok(amt);
await subject.exec('set role authenticated');
for (const [id, client] of [[oauth, 'fixture-read'], [oauth, undefined], [ui, 'oauth-nao-provisionado']]) {
  await claims(subject, id, client);
  assert.equal((await subject.query('select public.v2_sessao_equipe() as allowed')).rows[0].allowed,false);
  assert.deepEqual((await subject.query('select * from v2_motoristas')).rows, []);
  await assert.rejects(subject.query("insert into v2_motoristas(nome,frota) values ('Fixture OAuth','cm')"),{code:'42501'});
  await assert.rejects(subject.query('select public.v2_adicionar_viagem(1,$1,$2,$3)', ['2026-11-16','2026-11-21',JSON.stringify(v2Trip)]),{code:'42501'});
}
console.log('PASS OAuth e conta dedicada impedidos de ler/gravar em V2, com o caminho Jarvis read-only preservado.');
await subject.exec('reset role');
const driver = (await subject.query("insert into v2_motoristas(nome,frota) values ('Fixture da equipe','cm') returning id")).rows[0].id;
v2Trip.motoristaId = driver;
await subject.exec('set role authenticated');
await claims(subject, ui);
await assert.rejects(
  subject.query('select public.v2_adicionar_viagem(1,$1,$2,$3)', ['2026-11-16','2026-11-21',JSON.stringify(v2Trip)]),
  {code:'42501'},
);
console.log('BLOQUEIO DE COEXISTÊNCIA (beta): guardas do Jarvis impedem o lançamento V2 no mesmo banco; não habilitar coexistência sem revisão.');
await subject.exec('reset role');
if ((await subject.query('select viagens from viagens_semanas where id=1')).rows[0].viagens.length === 1) {
  // Emula exclusivamente a forma JSON canônica que V2 pretende gravar, para
  // isolar o contrato de leitura e de detecção do outro bloqueio.
  await claims(subject, ui);
  await subject.query('update viagens_semanas set viagens=viagens || $1::jsonb where id=1', [JSON.stringify([{
    ...v2Trip, frotaRegistrada:'cm', placaRegistrada:'TST9A44', motoristaNome:'Fixture da equipe',
  }])]);
}
await subject.exec('set role authenticated');
await claims(subject, oauth, 'fixture-read');
const afterRead = await legacyRead(query);
assert.deepEqual(afterRead[0].viagens[0], stored);
assert.deepEqual(
  ['nf','cte','data','dataEntrega','volFiscal','volEntregue','taxa'].map(field => afterRead[0].viagens[1][field]),
  ['nf','cte','data','dataEntrega','volFiscal','volEntregue','taxa'].map(field => v2Trip[field]),
);
assert.equal(afterRead[0].viagens[1].placaRegistrada,'TST9A44');
console.log('PASS leitura Jarvis vê JSON antigo e campos fiscais V2 juntos, sem regravar nem normalizar.');
await subject.exec('reset role');
const indexed = (await subject.query("select count(*)::int as n from cm_viagens_legacy_candidates where original_trip->>'id'=$1",[String(v2Trip.id)])).rows[0].n;
assert.equal(indexed,0);
console.log('LIMITE: o indexador de candidatos beta é inicial; uma viagem V2 lida não aparece no índice de possíveis duplicidades.');
await subject.close();
