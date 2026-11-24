import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const legacy = (await readFile(new URL('../supabase-schema.sql', import.meta.url), 'utf8')).split('-- =========================================================================')[0];
const migration = await readFile(new URL('../supabase/migrations/20261123221000_cm_control_v2.sql', import.meta.url), 'utf8');
const fixture = await PGlite.create();
await fixture.exec(`
create role anon nologin;
create role authenticated nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('test.jwt', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
grant usage on schema auth to authenticated, anon;
` + legacy + `
grant select,insert,update on public.caminhoes, public.viagens_semanas, public.despesas_semanas, public.despesas_gerais_semanas to authenticated;
grant usage on all sequences in schema public to authenticated;
insert into caminhoes (modelo,placa,motorista,frota) values
  ('Modelo','ABC1D23','Pessoa própria','cm'), ('Modelo','ABC1D24','Pessoa terceirizada','terceirizada'),
  ('Modelo','ABC1D25','Pessoa ambígua','terceirizada'), ('Modelo','ABC1D26',' Pessoa   ambígua ','terceirizada'),
  ('Modelo','ABC1D27','Pessoa bagaço','bagaco');
insert into viagens_semanas (caminhao_id,inicio,fim,viagens) values
  (1,'2026-11-16','2026-11-22','[{"id":1795031393000,"data":"2026-11-22","nf":"9","cte":"4","taxa":37.77,"volFiscal":100,"volEntregue":98}]'),
  (2,'2026-11-16','2026-11-21','[{"id":1795031393001,"data":"2026-11-19","nf":"10","volEntregue":12}]'),
  (3,'2026-11-16','2026-11-21','[]'),
  (3,'2026-11-17','2026-11-22','[]'),
  (5,'2026-11-16','2026-11-21','[{"id":1795031393002,"data":"2026-11-19","nf":"11","taxa":290}]');
insert into despesas_gerais_semanas (inicio,fim,despesas) values ('2026-11-16','2026-11-21','[{"id":1795031393001,"data":"2026-11-19","descricao":"Despesa fictícia","valor":31.1}]');
insert into despesas_semanas (caminhao_id,inicio,fim,despesas) values (1,'2026-11-16','2026-11-21','[{"id":1795031393001,"data":"2026-11-19","descricao":"Despesa fictícia","valor":42.2}]');
`);
const before = async db => (await db.query(`
select table_name, rows from (
 select 'caminhoes' as table_name, jsonb_agg(to_jsonb(c) order by id) as rows from caminhoes c
 union all select 'viagens_semanas', jsonb_agg(to_jsonb(s) order by id) from viagens_semanas s
 union all select 'despesas_semanas', jsonb_agg(to_jsonb(s) order by id) from despesas_semanas s
 union all select 'despesas_gerais_semanas', jsonb_agg(to_jsonb(s) order by id) from despesas_gerais_semanas s
) x order by table_name`)).rows;
const baseSnapshot = await before(fixture);
const backup = await fixture.dumpDataDir();
const backupDigest = createHash('sha256').update(Buffer.from(await backup.arrayBuffer())).digest('hex');
const db = await PGlite.create({ loadDataDir: backup });
assert.deepEqual(await before(db), baseSnapshot);
await fixture.close();
console.log('PASS backup sintético restaurado e legacy snapshots iguais, SHA256', backupDigest);
console.log('PostgreSQL:', (await db.query('select version()')).rows[0].version);
await db.exec(migration);
assert.deepEqual(await before(db), baseSnapshot);
const origins = await db.query('select caminhao_origem_id, nome from v2_motoristas');
assert.deepEqual(origins.rows, [{caminhao_origem_id:2,nome:'Pessoa terceirizada'}]);
console.log('PASS migração aditiva, legado intacto e somente terceirizada inequívoca vinculada');
const tryRole = async (role, jwt) => db.exec(`reset role; set role ${role}; select set_config('test.jwt', '${JSON.stringify(jwt)}', false)`);
await tryRole('anon', {role:'anon'});
await assert.rejects(db.query('select * from v2_motoristas'), {code:'42501'});
await assert.rejects(db.query("select v2_adicionar_viagem(1,'2026-11-16','2026-11-22','{}')"), {code:'42501'});
let uid = '99999999-0000-4000-8000-000000000000';
await tryRole('authenticated', {role:'authenticated',sub:uid,is_anonymous:true});
assert.deepEqual((await db.query('select * from v2_motoristas')).rows,[]);
await assert.rejects(db.query("select v2_adicionar_viagem(1,'2026-11-16','2026-11-22','{}')"), {code:'42501'});
await assert.rejects(db.query("insert into v2_motoristas(nome,frota) values ('Anônimo','cm')"), {code:'42501'});
await tryRole('authenticated', {role:'authenticated',sub:uid,is_anonymous:false});
let mid = (await db.query("insert into v2_motoristas(nome,frota) values ('Pessoa A','cm') returning id")).rows[0].id;
let ms = (await db.query("insert into v2_motoristas(nome,frota) values ('Pessoa B','cm') returning id")).rows[0].id;
await db.query("insert into v2_alocacoes(caminhao_id,motorista_id,inicio) values (1,$1,'2026-11-01T00:00Z')",[mid]);
await db.query("insert into v2_alocacoes(caminhao_id,motorista_id) values (1,$1)",[ms]);
await assert.rejects(db.query("insert into v2_alocacoes(caminhao_id,motorista_id) values (2,$1)",[ms]),{code:'42501'});
await db.query("insert into v2_taxas(frota,vigencia,percentual) values ('cm','2026-11-23',14.5),('cm','2026-11-25',15)");
const trip = { id:1795031393010,data:'2026-11-22',dataEntrega:'2026-11-22',nf:'13',cte:'4',volFiscal:100,volEntregue:90,taxa:37.77,motoristaId:mid,percentualAplicado:10 };
const add = async(p,truck=1,ini='2026-11-16',fim='2026-11-22') => (await db.query('select to_jsonb(public.v2_adicionar_viagem($1,$2,$3,$4)) as s',[truck,ini,fim,JSON.stringify(p)])).rows[0].s;
let s = await add(trip);
assert.equal(s.viagens.length,2);
assert.equal(s.viagens[1].placaRegistrada,'ABC1D23');
assert.equal(s.viagens[1].motoristaNome,'Pessoa A');
assert.equal(s.viagens[1].percentualAplicado,10);
assert.equal((await add(trip)).viagens.length,2);
await assert.rejects(add({...trip,nf:'14'}),{code:'23505'});
await assert.rejects(add({...trip,id:1795031393050,dataEntrega:'2026-11-21'}),{code:'22023'});
await assert.rejects(add({...trip,id:1795031393050,volEntregue:0}),{code:'22023'});
await assert.rejects(add({...trip,id:1795031393050,volFiscal:-1}),{code:'22023'});
await assert.rejects(add(trip,3,'2026-11-16','2026-11-21'),{code:'22023'}); // old Sunday outside range
await assert.rejects(add({...trip,data:'2026-11-19'},3,'2026-11-16','2026-11-21'),{code:'23514'}); // ambiguity
await assert.rejects(add({...trip,data:'2026-11-19'},5,'2026-11-16','2026-11-21'),{code:'22023'}); // Bagaço
let later = {...trip,id:1795031393020,nf:'15',data:'2026-11-23',dataEntrega:'2026-11-23',motoristaId:ms,percentualAplicado:14.5};
s = await add(later,1,'2026-11-23','2026-11-28');
assert.deepEqual([s.viagens[0].motoristaNome,s.viagens[0].percentualAplicado],['Pessoa B',14.5]);
await assert.rejects(add({...later,id:1795031393021,data:'2026-11-25',dataEntrega:'2026-11-25'},1,'2026-11-23','2026-11-28'),{code:'23514'});
assert.equal((await add(trip)).viagens[1].motoristaId,mid);
console.log('PASS gestão de acesso, troca, vigência, domingo legado, idempotência, ambiguidades e bagaço');
const expense = {id:1795031393030,data:'2026-11-19',descricao:'Exemplo',valor:25.52};
const addExpense = async(p,truck=null,ini='2026-11-16',fim='2026-11-21') => (await db.query('select public.v2_adicionar_despesa($1,$2,$3,$4) as s',[truck,ini,fim,JSON.stringify(p)])).rows[0].s;
for (const truck of [null,1]) {
  assert.equal((await addExpense(expense,truck)).despesas.length,2);
  assert.equal((await addExpense(expense,truck)).despesas.length,2);
  await assert.rejects(addExpense({...expense,valor:30},truck),{code:'23505'});
}
const newExpense = {...expense,id:1795031393040,data:'2026-11-24'};
assert.equal((await addExpense(newExpense,null,'2026-11-23','2026-11-28')).despesas.length,1);
const chaveCliente = '99999999-0000-4000-8000-000000000099';
const insertAdvance = () => db.query("insert into v2_despesas_motoristas (motorista_id,data,descricao,valor,adiantamento,recuperado,chave_cliente) values ($1,'2026-11-24','Fictício',100,true,30,$2) returning id", [mid,chaveCliente]);
let d = (await insertAdvance()).rows[0].id;
await assert.rejects(insertAdvance(),{code:'23505'});
await assert.rejects(db.query('update v2_despesas_motoristas set chave_cliente=null where id=$1',[d]),{code:'42501'});
await assert.rejects(db.query('update v2_despesas_motoristas set recuperado=110 where id=$1',[d]),{code:'23514'});
await db.query('update v2_despesas_motoristas set recuperado=100 where id=$1',[d]);
await db.query('update v2_despesas_motoristas set excluido_em=now() where id=$1',[d]);
assert.equal((await db.query('select count(*)::integer as n from v2_despesas_motoristas where excluido_em is null')).rows[0].n,0);
console.log('PASS despesas em storage canônico, retentativa, parcial/quitado e exclusão lógica');
await db.close();
