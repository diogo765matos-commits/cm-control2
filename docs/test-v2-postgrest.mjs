// Local-only synthetic native PostgreSQL + PostgREST acceptance tests (Node 22+).
import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, chmod, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const pgbin = process.env.PGBIN;
const postgrestBin = process.env.POSTGREST || process.env.POSTGREST_BIN;
if (!pgbin || !postgrestBin) {
  throw new Error('Set PGBIN (native PostgreSQL bin directory) and POSTGREST (native binary). No cloud endpoints are supported.');
}

const temp = await mkdtemp(join(tmpdir(), 'cm-v2-native-'));
const pwfile = join(temp, 'pg-password');
const pgPassword = randomBytes(24).toString('hex');
const apiPassword = randomBytes(24).toString('hex');
const dataDir = join(temp, 'data');
const dump = join(temp, 'baseline.dump');
const logFile = join(temp, 'pg.log');
await chmod(temp, 0o700);
await writeFile(pwfile, pgPassword+'\n', { mode:0o600, flag:'wx' });
const seedDb = 'cm_v2_synthetic_baseline';
const testDb = 'cm_v2_synthetic_homolog';
const rollbackDb = 'cm_v2_synthetic_rollback';
const reserve = async () => {
  const s = createServer();
  s.listen(0, '127.0.0.1');
  await once(s, 'listening');
  return { s, port:s.address().port };
};
const [httpReservation, pgReservation] = await Promise.all([reserve(),reserve()]);
const httpPort=httpReservation.port, pgPort=String(pgReservation.port);
for (const {s} of [httpReservation, pgReservation]) await promisify(s.close).call(s);
// Do not inherit production DB, JWT, proxy, or key variables.
const localEnv = { PATH: process.env.PATH || '/usr/bin:/bin', HOME:temp, LANG:'C', TZ:'UTC', LD_LIBRARY_PATH:process.env.LD_LIBRARY_PATH || '' };
const pgEnv = { ...localEnv, PGPORT: pgPort, PGHOST:'127.0.0.1', PGUSER:'cm_v2_test_admin', PGPASSWORD:pgPassword };
const bin = (exe, args, extra = {}) => runFile(join(pgbin, exe), args, { env:pgEnv, timeout: 30000, maxBuffer: 8*1024*1024, ...extra });
const psql = async (db, sql) => (await bin('psql', ['-X','-A','-t','-v','ON_ERROR_STOP=1','-d',db,'-c',sql])).stdout.trim();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const eventually = async (probe, why, milliseconds = 12000) => {
  for (let i=0; i<milliseconds/80; i++) {
    if (await probe()) return;
    await delay(80);
  }
  throw new Error('Timed out: ' + why);
};
const syntheticJwtKey = randomBytes(48).toString('hex');
const encode = a => Buffer.from(JSON.stringify(a)).toString('base64url');
const jwt = claims => {
  const body = encode({ alg:'HS256', typ:'JWT' }) + '.' + encode({ ...claims, exp:Math.floor(Date.now()/1000)+3600 });
  return body + '.' + createHmac('sha256', syntheticJwtKey).update(body).digest('base64url');
};
const sub = 'beef1111-1111-4111-8111-111111111111';
const teamJwt = jwt({ role:'authenticated', sub, is_anonymous:false });
const anonJwt = jwt({ role:'authenticated', sub, is_anonymous:true });
const endpoint = 'http://127.0.0.1:' + httpPort;
let api, started = false, pgrTail = '';
let holder;
async function req(path, { method='GET', token=teamJwt, body, headers={} }={}) {
  assert.ok(path.startsWith('/') && !path.startsWith('//'));
  const response = await fetch(endpoint+path, {
    method, redirect:'error', signal:AbortSignal.timeout(20000),
    headers: { ...(token && { Authorization:'Bearer '+token }), ...(body && { 'Content-Type':'application/json' }), ...headers },
    body:body ? JSON.stringify(body) : undefined
  });
  const raw = await response.text();
  return { status:response.status, media:response.headers.get('content-type') || '', body:raw ? JSON.parse(raw) : null };
}
const ok = result => {
  assert.equal(result.status >= 200 && result.status < 300, true, JSON.stringify(result));
  assert.match(result.media, /^application\/json(?:;|$)/);
  return result.body;
};
const row = out => Array.isArray(out) ? out[0] : out;
const denied = response => assert.ok([401,403].includes(response.status), JSON.stringify(response));
const rpc = (p, token = teamJwt) => req('/rpc/v2_adicionar_viagem', { method:'POST', token, body:p, headers:{ Accept:'application/json' } });
const rides = async (truck = 1) => ok(await req('/viagens_semanas?caminhao_id=eq.'+truck+'&order=inicio.asc'));
const driver = async (nome, frota='cm') => row(ok(await req('/v2_motoristas',{ method:'POST', headers:{ Prefer:'return=representation' }, body:{ nome,frota } })));
const allocation = async (driverId, truck=1, inicio) => row(ok(await req('/v2_alocacoes',{method:'POST',headers:{Prefer:'return=representation'},body:{caminhao_id:truck,motorista_id:driverId,...(inicio && {inicio})}})));
const snapshot = db => psql(db,`
  select md5(string_agg(table_name || ':' || rows, '|' order by table_name)) from (
    select 'caminhoes' as table_name, coalesce(jsonb_agg(to_jsonb(r) order by id),'[]')::text as rows from caminhoes r
    union all select 'viagens_semanas',coalesce(jsonb_agg(to_jsonb(r) order by id),'[]')::text from viagens_semanas r
    union all select 'despesas_gerais_semanas',coalesce(jsonb_agg(to_jsonb(r) order by id),'[]')::text from despesas_gerais_semanas r
    union all select 'despesas_semanas',coalesce(jsonb_agg(to_jsonb(r) order by id),'[]')::text from despesas_semanas r
    union all select 'icms_registros',coalesce(jsonb_agg(to_jsonb(r) order by id),'[]')::text from icms_registros r
    union all select 'abastecimento_semanas',coalesce(jsonb_agg(to_jsonb(r) order by id),'[]')::text from abastecimento_semanas r
  ) snapshots`);
function stalePatch(week, id) {
  const filter = new URLSearchParams({ id:'eq.'+week.id, inicio:'eq.'+week.inicio, fim:'eq.'+week.fim, viagens:'eq.'+JSON.stringify(week.viagens) });
  return req('/viagens_semanas?'+filter, { method:'PATCH', headers:{ Prefer:'return=representation' },
    body:{ viagens:[...week.viagens, { id,nf:'TESTE-LEGADO',data:'2026-11-23' }] } });
}
async function holdLock(lockSql) {
  assert.equal(holder, undefined);
  holder=spawn(join(pgbin,'psql'), ['-X','-A','-t','-v','ON_ERROR_STOP=1','-d',testDb],
    { env:{...pgEnv,PGAPPNAME:'cm-v2-synthetic-holder'}, stdio:['pipe','pipe','pipe'] });
  let output='';
  holder.stdout.setEncoding('utf8').on('data', chunk => { output+=chunk; });
  holder.stdin.write(`BEGIN; ${lockSql}; SELECT 'READY_CM_V2';\n`);
  await eventually(() => output.includes('READY_CM_V2'), 'session acquired precondition lock');
}
async function waitForBlocked(wanted) {
  await eventually(async () => Number(await psql(testDb,`
    select count(*) from pg_stat_activity a where a.datname = current_database()
      and a.pid <> pg_backend_pid()
      and a.usename = 'cm_v2_authenticator'
      and a.wait_event_type = 'Lock'`)) >= wanted, `${wanted} API requests waiting in separate PostgreSQL backend sessions`);
}
async function release() {
  const child=holder;
  holder=undefined;
  child.stdin.end('COMMIT;\n');
  assert.equal((await once(child,'exit'))[0],0);
}
function payload(driverId, id, extras = {}) {
  return { p_caminhao_id:1, p_inicio:'2026-11-23', p_fim:'2026-11-28',
    p_viagem:{ id, data:'2026-11-23', dataEntrega:'2026-11-23', nf:'TESTE-'+id, cte:'SINTETICO', volFiscal:100,
      volEntregue:90, taxa:37.77, motoristaId:driverId, percentualAplicado:10, ...extras } };
}
// Build the exact previous browser data modules, not copied equivalents or the
// candidate sources. The only host emulation is login storage and Supabase's
// /rest/v1 prefix; the database requests go through the real local PostgREST.
async function verifyFrontendRollback({advance, active}) {
  const previous='305148e9c120809ceca18acfb48924e0f46a3c0d';
  const repo=fileURLToPath(new URL('../',import.meta.url));
  const previousRoot=join(temp,'previous-code');
  const modules=['src/lib/supabase.js','src/data/viagens.js','src/data/despesas.js','src/data/despesasGerais.js'];
  for (const file of modules) {
    const dest=join(previousRoot,file);
    await mkdir(dirname(dest),{recursive:true});
    const {stdout}=await runFile('git',['show',previous+':'+file],{cwd:repo});
    await writeFile(dest,stdout);
  }
  const entry=join(previousRoot,'entry.js');
  await writeFile(entry,modules.slice(1).map(file=>"export * from './"+file+"';").join('\n'));
  const {build}=await import('vite');
  await build({
    root:previousRoot, configFile:false, envFile:false, logLevel:'error',
    define:{ 'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(endpoint),
      'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('loopback-synthetic-anon') },
    build:{ outDir:join(previousRoot,'output'), target:'node22', lib:{entry,formats:['es'],fileName:()=> 'legacy.mjs'} },
  });
  const nativeFetch=globalThis.fetch;
  const storage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const requests=[];
  try {
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
      getItem:key=>key==='cm-control-auth' ? JSON.stringify({access_token:teamJwt}) : null,
      removeItem:()=>{ throw new Error('Previous client session unexpectedly expired'); },
    }});
    globalThis.fetch=(url,init)=>{
      const parsed=new URL(url);
      assert.equal(parsed.origin,endpoint);
      assert.match(parsed.pathname,/^\/rest\/v1\//);
      requests.push(parsed.pathname);
      parsed.pathname=parsed.pathname.replace(/^\/rest\/v1/,'');
      return nativeFetch(parsed,{...init,redirect:'error'});
    };
    const legacy=await import(pathToFileURL(join(previousRoot,'output','legacy.mjs')).href);
    const [oldTrips,oldGeneral,oldTruck]=await Promise.all([
      legacy.getSemanasViagens(1),legacy.getSemanasDespesasGerais(),legacy.getSemanasDespesas(1),
    ]);
    const legacyWeek=oldTrips.find(w=>w.id===active.id);
    assert.ok(oldTrips.flatMap(w=>w.viagens).some(v=>v.nf==='LEGADO-A'));
    const v2Trip=legacyWeek.viagens.find(v=>v.id===1795701100003);
    assert.ok(v2Trip?.motoristaId && v2Trip?.percentualAplicado===15);
    assert.ok(oldGeneral.flatMap(w=>w.despesas).some(d=>d.id===1795701100010));
    assert.ok(oldTruck.flatMap(w=>w.despesas).some(d=>d.id===1795701100011));
    assert.ok(![...oldGeneral,...oldTruck].flatMap(w=>w.despesas).some(d=>d.descricao===advance.descricao),
      'driver-only V2 advance is not surfaced by the old expense queries');
    assert.deepEqual([...new Set(requests)].sort(),[
      '/rest/v1/despesas_gerais_semanas','/rest/v1/despesas_semanas','/rest/v1/viagens_semanas',
    ]);
    const edited=await legacy.editarViagem(legacyWeek,v2Trip,{...v2Trip,cte:'LEGADO-EDITADO'});
    assert.deepEqual(edited.viagens.find(v=>v.id===v2Trip.id),{...v2Trip,cte:'LEGADO-EDITADO'},
      'previous legitimate edit leaves every unknown V2 field intact');
  } finally {
    globalThis.fetch=nativeFetch;
    if (storage) Object.defineProperty(globalThis,'localStorage',storage);
    else delete globalThis.localStorage;
  }
  const persisted=await rides();
  assert.equal(persisted.flatMap(w=>w.viagens).find(v=>v.id===1795701100003).cte,'LEGADO-EDITADO');
  assert.equal(row(ok(await req('/v2_despesas_motoristas?id=eq.'+advance.id))).descricao,advance.descricao);
  console.log('PASS frontend rollback to exact 305148e9 legacy data modules; V2 writes retained in canonical or dedicated stores');
}
try {
  await bin('initdb',['-D',dataDir,'--username=cm_v2_test_admin','--auth-local=reject','--auth-host=scram-sha-256','--pwfile='+pwfile,'--no-locale','--encoding=UTF8']);
  await bin('pg_ctl',['-D',dataDir,'-l',logFile,'-o',`-h 127.0.0.1 -c unix_socket_directories='' -p ${pgPort}`,'-w','start']);
  started=true;
  const sqlVersion = await psql('postgres','select version()');
  await psql('postgres',`
    create role anon nologin;
    create role authenticated nologin;
    create role cm_v2_authenticator login noinherit password '${apiPassword}';
    grant anon, authenticated to cm_v2_authenticator;
  `);
  for (const database of [seedDb,testDb,rollbackDb]) await bin('createdb',[database]);
  const bootstrap = new URL('../supabase/bootstrap/legacy_fresh.sql',import.meta.url).pathname;
  await psql(seedDb,`
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
    $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;
    grant usage on schema auth to authenticated, anon;
    -- Simulate permissive defaults sometimes present on freshly hosted projects.
    alter default privileges in schema public grant all on tables to public, anon, authenticated;
    alter default privileges in schema public grant all on sequences to public, anon, authenticated;
  `);
  const applyBootstrap=()=>bin('psql',['-X','-v','ON_ERROR_STOP=1','-d',seedDb,'-f',bootstrap]);
  await applyBootstrap();
  await psql(seedDb,`
    insert into caminhoes (modelo,placa,motorista,frota) values
      ('Mode A','ZZA1A00','Sintético legado próprio','cm'),
      ('Mode B','ZZA1A01','Sintético terceirizado','terceirizada'),
      ('Mode C','ZZA1A02','Sintético bagaço','bagaco');
    insert into viagens_semanas(caminhao_id,inicio,fim,viagens) values
      (1,'2026-11-16','2026-11-22','[{"id":1780000000001,"data":"2026-11-22","nf":"LEGADO-A","volEntregue":42,"taxa":37.77}]'),
      (2,'2026-11-16','2026-11-21','[{"id":1780000000002,"data":"2026-11-20","nf":"LEGADO-B","volEntregue":71,"taxa":37.77}]'),
      (3,'2026-11-16','2026-11-21','[{"id":1780000000003,"data":"2026-11-20","nf":"LEGADO-C","volEntregue":21,"taxa":290}]');
    insert into despesas_gerais_semanas(inicio,fim,despesas) values
      ('2026-11-16','2026-11-21','[{"id":1780000000004,"data":"2026-11-19","descricao":"Sintética","valor":35}]');
    insert into despesas_semanas(caminhao_id,inicio,fim,despesas) values
      (1,'2026-11-16','2026-11-21','[{"id":1780000000005,"data":"2026-11-19","descricao":"Sintética","valor":11}]');
  `);
  const baseline=await snapshot(seedDb);
  await assert.rejects(applyBootstrap(), error => /relation .* already exists/.test(error.stderr));
  assert.equal(await snapshot(seedDb),baseline,'bootstrap retry left original rows untouched');
  await bin('pg_dump',['-Fc','-f',dump,seedDb]);
  const digest=createHash('sha256').update(await readFile(dump)).digest('hex');
  for (const db of [testDb,rollbackDb]) {
    await bin('pg_restore',['--exit-on-error','-d',db,dump]);
    assert.equal(await snapshot(db),baseline,'baseline restored exactly before applying migration');
  }
  console.log('PASS native backup/restored before migration', { digest, baseline, sqlVersion });
  await bin('psql',['-X','-v','ON_ERROR_STOP=1','-d',testDb,'-f',
    new URL('../supabase/migrations/20261123221000_cm_control_v2.sql',import.meta.url).pathname]);
  assert.equal(await snapshot(testDb),baseline,'migration preserved legacy snapshots');
  const dbUri='postgresql://cm_v2_authenticator:'+apiPassword+'@127.0.0.1:'+pgPort+'/'+testDb;
  api=spawn(postgrestBin,[],{ env:{...localEnv,PGRST_DB_URI:dbUri,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',
    PGRST_JWT_SECRET:syntheticJwtKey,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(httpPort),PGRST_DB_POOL:'8'},
    stdio:['ignore','pipe','pipe'] });
  api.stdout.on('data', b => {pgrTail=(pgrTail+b.toString()).slice(-4000);});
  api.stderr.on('data', b => {pgrTail=(pgrTail+b.toString()).slice(-4000);});
  await eventually(async () => {
    if (api.exitCode !== null) throw new Error('PostgREST did not start: '+pgrTail);
    try { return (await req('/viagens_semanas?select=id&limit=1')).status===200; } catch { return false; }
  },'local PostgREST on loopback');
  const header = { Prefer:'return=representation' };
  const noRows = response => {
    if ([401,403].includes(response.status)) denied(response);
    else assert.deepEqual(ok(response),[]);
  };
  const oauthLegacyJwt=jwt({role:'authenticated',sub,is_anonymous:false,client_id:'synthetic-oauth-client'});
  const malformedOAuthJwt=jwt({role:'authenticated',sub,is_anonymous:false,client_id:null});
  const dates={inicio:'2026-11-30',fim:'2026-12-05'};
  const legacyScenarios=[
    { table:'caminhoes', record:{modelo:'TESTE TEMP',placa:'ZZZ9991',motorista:'Fictício',frota:'cm'}, patch:{modelo:'EDITADO'}, field:'modelo' },
    { table:'viagens_semanas', record:{...dates,caminhao_id:1,viagens:[]}, patch:{viagens:[{id:1795701190001,nf:'XX',data:'2026-11-30'}]}, field:'viagens' },
    { table:'abastecimento_semanas', record:{...dates,caminhao_id:1,abastecimentos:[]}, patch:{abastecimentos:[{id:1795701190002,data:'2026-11-30'}]}, field:'abastecimentos' },
    { table:'despesas_semanas', record:{...dates,caminhao_id:1,despesas:[]}, patch:{despesas:[{id:1795701190003,data:'2026-11-30',valor:15}]}, field:'despesas' },
    { table:'despesas_gerais_semanas', record:{...dates,despesas:[]}, patch:{despesas:[{id:1795701190004,data:'2026-11-30',valor:16}]}, field:'despesas' },
    { table:'icms_registros', record:{caminhao_id:2,data:'2026-11-30',valor:13,cte:'XX'}, patch:{valor:10}, field:'valor', insertDeleteOnly:true },
  ];
  for (const {table,record,patch,field,insertDeleteOnly} of legacyScenarios) {
    const base='/'+table;
    const create=(token=teamJwt)=>req(base,{method:'POST',token,headers:header,body:record});
    const made=row(ok(await create()));
    const path=base+'?id=eq.'+made.id;
    assert.equal(row(ok(await req(path))).id,made.id,table);
    for (const token of [null,anonJwt,oauthLegacyJwt,malformedOAuthJwt]) {
      noRows(await req(path,{token}));
      denied(await create(token));
      noRows(await req(path,{method:'PATCH',token,headers:header,body:patch}));
      noRows(await req(path,{method:'DELETE',token,headers:header}));
      assert.deepEqual(row(ok(await req(path))),made,table+' remains unchanged for forbidden writes');
    }
    const edited=await req(path,{method:'PATCH',headers:header,body:patch});
    if (insertDeleteOnly) {
      denied(edited);
      assert.deepEqual(row(ok(await req(path))),made);
    } else {
      assert.deepEqual(row(ok(edited))[field],patch[field]);
    }
    assert.equal(row(ok(await req(path,{method:'DELETE',headers:header}))).id,made.id);
    assert.deepEqual(ok(await req(path)),[]);
  }
  console.log('PASS fresh-only legacy bootstrap and HTTP privileges on all six tables');
  const before = await rides();
  const drivers=ok(await req('/v2_motoristas?select=nome,frota,caminhao_origem_id'));
  assert.deepEqual(drivers,[{nome:'Sintético terceirizado',frota:'terceirizada',caminhao_origem_id:2}]);
  denied(await req('/v2_motoristas',{token:null}));
  assert.deepEqual(ok(await req('/v2_motoristas',{token:anonJwt})),[]);
  denied(await req('/v2_motoristas',{method:'POST',token:anonJwt,body:{nome:'negado',frota:'cm'}}));
  denied(await rpc(payload(1,1795701100000),null));
  denied(await rpc(payload(1,1795701100000),anonJwt));
  const a=await driver('Pessoa sintética A'), b=await driver('Pessoa sintética B');
  await allocation(a.id,1,'2026-11-20T10:00:00Z');
  const p=payload(a.id,1795701100001);
  // Force three requests to occupy distinct worker sessions before release.
  await holdLock("SELECT pg_advisory_xact_lock(hashtextextended('cm-v2:viagens:1',0))");
  const many=Promise.all([rpc(p),rpc(p),rpc(payload(a.id,1795701100002))]);
  many.catch(()=>{});
  await waitForBlocked(3);
  await release();
  for (const r of await many) assert.ok(row(ok(r)).id,'real RPC media type and response');
  let active=(await rides()).find(w=>w.inicio==='2026-11-23');
  assert.equal((await rides()).filter(w=>w.inicio==='2026-11-23').length,1);
  assert.deepEqual(active.viagens.map(v=>v.id).sort(),[1795701100001,1795701100002]);
  assert.deepEqual((await rides())[0],before[0],'legacy trips unchanged');

  await allocation(b.id,1,'2026-11-22T10:00:00Z');
  ok(await req('/v2_taxas',{method:'POST',headers:{Prefer:'return=representation'},body:{frota:'cm',vigencia:'2026-11-24',percentual:15}}));
  const next=payload(b.id,1795701100003,{data:'2026-11-24',dataEntrega:'2026-11-24',percentualAplicado:15});
  // Hold a row lock, then queue V2 insertion first and stale legacy CAS second.
  await holdLock("SELECT id FROM public.viagens_semanas WHERE id="+active.id+" FOR UPDATE");
  const added=rpc(next); added.catch(()=>{});
  await waitForBlocked(1);
  const stale=stalePatch(active,1795701100004); stale.catch(()=>{});
  await waitForBlocked(2);
  await release();
  ok(await added);
  assert.deepEqual(ok(await stale),[],'stale legacy CAS must fail without losing V2 write');
  active=(await rides()).find(w=>w.inicio==='2026-11-23');
  assert.equal(active.viagens.length,3);
  assert.deepEqual(active.viagens.filter(v=>v.motoristaId===a.id).map(v=>v.percentualAplicado),[10,10]);
  assert.equal(active.viagens.find(v=>v.motoristaId===b.id)?.percentualAplicado,15);
  assert.equal((await rides(3))[0].viagens[0].nf,'LEGADO-C');
  const latestLegacy=ok(await stalePatch(active,1795701100005));
  assert.equal(latestLegacy[0].viagens.length,4,'fresh legacy CAS still operates after rollout');
  // Expense RPC must keep one record in each original store.
  const addExpense = (truck,id) => req('/rpc/v2_adicionar_despesa',{
    method:'POST',body:{p_caminhao_id:truck,p_inicio:'2026-11-16',p_fim:'2026-11-21',
      p_despesa:{id,data:'2026-11-20',descricao:'Sintética HTTP',valor:25.50}},
  });
  for (const truck of [null,1]) {
    const id=truck===null?1795701100010:1795701100011;
    const created=row(ok(await addExpense(truck,id)));
    assert.equal(created.despesas.length,2);
    assert.deepEqual(row(ok(await addExpense(truck,id))),created);
  }
  const advanceBody = {motorista_id:a.id,data:'2026-11-23',descricao:'Adiantamento sintético',valor:87,adiantamento:true,recuperado:0,
    chave_cliente:'beef1111-1111-4111-8111-111111111199'};
  const advance=row(ok(await req('/v2_despesas_motoristas',{
    method:'POST',headers:{Prefer:'return=representation'},body:advanceBody,
  })));
  const patchAdvance = (recuperado,token=teamJwt) => req('/v2_despesas_motoristas?id=eq.'+advance.id,{
    method:'PATCH',token,headers:{Prefer:'return=representation'},body:{recuperado},
  });
  assert.equal(row(ok(await patchAdvance(23))).recuperado,23);
  assert.equal(row(ok(await patchAdvance(87))).recuperado,87);
  assert.equal((await patchAdvance(88)).status,400);
  const oauthJwt=jwt({role:'authenticated',sub,is_anonymous:false,client_id:'synthetic-oauth-client'});
  assert.deepEqual(ok(await req('/v2_despesas_motoristas',{token:oauthJwt})),[]);
  // A restrictive RLS UPDATE may report success with no visible rows, or deny explicitly.
  const oauthPatch=await patchAdvance(45,oauthJwt);
  if ([401,403].includes(oauthPatch.status)) denied(oauthPatch);
  else assert.deepEqual(ok(oauthPatch),[]);
  assert.equal(row(ok(await req('/v2_despesas_motoristas?id=eq.'+advance.id))).recuperado,87);
  denied(await req('/v2_despesas_motoristas',{method:'POST',token:oauthJwt,body:advanceBody}));
  denied(await rpc(payload(a.id,1795701100020),oauthJwt));
  await verifyFrontendRollback({advance,active});
  assert.equal(await snapshot(rollbackDb),baseline,'restore remained independent from new writes');
  // Simulate a recovery after writes without restoring over the active copy.
  const lateRecovery='cm_v2_synthetic_recovery_after';
  await bin('createdb',[lateRecovery]);
  await bin('pg_restore',['--exit-on-error','-d',lateRecovery,dump]);
  assert.equal(await snapshot(lateRecovery),baseline,'post-write recovery restored original rows only');
  assert.equal(await psql(lateRecovery,"select to_regclass('public.v2_despesas_motoristas') is null"),'t');
  assert.equal(await psql(lateRecovery,`
    select not exists (select 1 from viagens_semanas w,
      jsonb_array_elements(w.viagens) v where v->>'id'='1795701100003')
    and not exists (select 1 from despesas_gerais_semanas w,
      jsonb_array_elements(w.despesas) d where d->>'id'='1795701100010')
    and not exists (select 1 from despesas_semanas w,
      jsonb_array_elements(w.despesas) d where d->>'id'='1795701100011')`),'t');
  assert.ok((await rides()).flatMap(w=>w.viagens).some(v=>v.id===1795701100003));
  assert.ok(ok(await req('/despesas_gerais_semanas')).flatMap(w=>w.despesas).some(d=>d.id===1795701100010));
  assert.ok(ok(await req('/despesas_semanas')).flatMap(w=>w.despesas).some(d=>d.id===1795701100011));
  assert.equal(row(ok(await req('/v2_despesas_motoristas?id=eq.'+advance.id))).recuperado,87);
  console.log('PASS database restore into separate database excludes post-backup writes without altering active copy');
  assert.equal(await psql(rollbackDb,"select to_regclass('public.v2_motoristas') is null"),'t');
  assert.notEqual(await snapshot(testDb),baseline,'do not overwrite post-migration writes on rollback');
  console.log('PASS real PostgREST RPC JSON, role/JWT/RLS, multi-session idempotency, legacy CAS, history, finance/OAuth isolation and isolated restoration');
} catch (error) {
  if (pgrTail) console.error(pgrTail);
  if (!started) try { console.error(await readFile(logFile,'utf8')); } catch { /* initdb failed */ }
  throw error;
} finally {
  if (holder) { holder.stdin.end('ROLLBACK;\n'); holder.kill('SIGTERM'); }
  if (api && api.exitCode === null) { api.kill('SIGTERM'); await once(api,'exit'); }
  if (started) await bin('pg_ctl',['-D',dataDir,'-m','immediate','-w','stop']);
  await rm(temp,{ recursive:true, force:true });
}
