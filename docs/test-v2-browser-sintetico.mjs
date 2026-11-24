// PLAYWRIGHT_MODULE deve apontar para playwright-core instalado à parte.
// Execute o Vite com URL/credencial sintéticas conforme o runbook, nunca com .env de produção.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const origem = 'http://127.0.0.1:4720';
const api = 'http://127.0.0.1:4719';
if (!process.env.PLAYWRIGHT_MODULE) throw new Error('Informe PLAYWRIGHT_MODULE absoluto.');
const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
  headless:true, chromiumSandbox:true,
});
const cm = {id:1,modelo:'Caminhão fictício A',placa:'AAA1B22',motorista:'Legado Fictício',frota:'cm'};
const ter = {id:2,modelo:'Caminhão fictício B',placa:'BBB1D33',motorista:'Terceirizado Fictício',frota:'terceirizada'};
const bagaco = {id:3,modelo:'Caminhão fictício C',placa:'DDD9A10',motorista:'Bagaço Fictício',frota:'bagaco'};
const semanaAnterior = {id:1,caminhao_id:1,inicio:'2026-11-09',fim:'2026-11-14',
  viagens:[{id:1794402000001,nf:'NF-LEGADO',data:'2026-11-11',dataEntrega:'2026-11-11',volFiscal:100,volEntregue:112,taxa:37.77}]};
const semanaTerceirizada = {id:3,caminhao_id:2,inicio:'2026-11-09',fim:'2026-11-14',
  viagens:[{id:1794402000003,nf:'NF-TERC-HIST',data:'2026-11-12',dataEntrega:'2026-11-12',volFiscal:100,volEntregue:250,taxa:40}]};
const tables = {
  caminhoes:[cm,ter,bagaco],
  v2_motoristas:[
    {id:1,nome:'Motorista Fictício A',frota:'cm',ativo:true},
    {id:2,nome:'Motorista Fictício B',frota:'cm',ativo:true},
    {id:3,nome:'Terceirizado Fictício',frota:'terceirizada',ativo:true,caminhao_origem_id:2},
  ],
  v2_alocacoes:[{id:1,caminhao_id:1,motorista_id:1,inicio:'2026-11-07T12:00:00Z'}],
  v2_taxas:[{id:1,frota:'cm',vigencia:'2026-11-16',percentual:12.5}],
  viagens_semanas:[semanaAnterior,semanaTerceirizada],
  despesas_gerais_semanas:[{id:1,inicio:'2026-11-09',fim:'2026-11-14',despesas:[{id:1794384000001,data:'2026-11-10',descricao:'Despesa Geral Fictícia',valor:180}]}],
  despesas_semanas:[{id:1,caminhao_id:1,inicio:'2026-11-16',fim:'2026-11-21',despesas:[{id:1794988800001,data:'2026-11-18',descricao:'Despesa Veicular Fictícia',valor:120}]}],
  v2_despesas_motoristas:[],
};
const requests = [];
const errors = [];
function filtrar(lista, params) {
  return lista.filter(r=>[...params].every(([k,v])=>{
    if (v==='is.null') return r[k]==null;
    if (v.startsWith('eq.')) return String(r[k])===v.slice(3);
    return true;
  })).slice(Number(params.get('offset')||0),Number(params.get('offset')||0)+Number(params.get('limit')||1000));
}
async function criarPage(viewport) {
  const context = await browser.newContext({viewport});
  await context.addInitScript(()=>{
    localStorage.setItem('cm-control-auth', JSON.stringify({access_token:'sintetico',user:{email:'synthetic@example.test'}}));
  });
  await context.route('**/*', async route=>{
    const url = new URL(route.request().url());
    if (url.origin === origem) return route.continue();
    // O Excel roda em outro teste com o pacote real; nada sai de localhost neste ensaio.
    if (url.href === 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js') return route.fulfill({contentType:'application/javascript', body:''});
    if (url.origin !== api) { errors.push('Requisição inesperada para ' + url.origin); return route.abort(); }
    if (route.request().method() === 'OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':origem,'access-control-allow-headers':'apikey,authorization,content-type,prefer','access-control-allow-methods':'GET,POST,PATCH,OPTIONS'}});
    const k = url.pathname.split('/').at(-1);
    const method = route.request().method();
    const body = method === 'POST' || method === 'PATCH' ? route.request().postDataJSON() : null;
    requests.push({k,method,body});
    let result;
    if (method==='GET') result=filtrar(tables[k] || [],url.searchParams);
    else if (k==='v2_adicionar_viagem' && method==='POST') {
      const semana = {id:2,caminhao_id:body.p_caminhao_id,inicio:body.p_inicio,fim:body.p_fim,viagens:[body.p_viagem]};
      tables.viagens_semanas.push(semana);
      result=semana;
    } else if (method==='POST' && tables[k]) {
      const registro = {id:tables[k].length+1,inicio:'2026-11-22T20:00:00Z',...body};
      tables[k].push(registro); result=[registro];
    } else if (method==='PATCH' && tables[k]) {
      result=filtrar(tables[k],url.searchParams);
      for (const row of result) Object.assign(row,body);
    } else {
      errors.push('Operação não simulada: '+method+' '+url.pathname);
      return route.fulfill({status:503,body:'Not configured'});
    }
    return route.fulfill({json:result,headers:{'access-control-allow-origin':origem}});
  });
  const page = await context.newPage();
  page.on('pageerror', e=>errors.push(e.message));
  await page.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'));
  return {page,context};
}
let paginaAtiva;
try {
  const {page,context} = await criarPage({width:1300,height:900});
  paginaAtiva = page;
  page.setDefaultTimeout(6000);
  await page.goto(origem+'/frota');
  await page.getByRole('heading',{name:'Frota',exact:true}).waitFor();
  assert.deepEqual(await page.locator('nav.menu .menu-label').allTextContents(),
    ['Dashboard','Novo lançamento','Frota','Alocação de motoristas','Despesas','Relatórios']);
  await page.getByRole('button',{name:'Fechar menu'}).click();
  const fechada = await page.locator('main.content').boundingBox();
  await page.getByRole('button',{name:'Abrir menu'}).click();
  const aberta = await page.locator('main.content').boundingBox();
  assert.ok(fechada.width > aberta.width+200);
  await page.getByRole('heading',{name:'Motorista Fictício A'}).waitFor();
  await page.getByRole('heading',{name:'Frota de Bagaço de Cana'}).waitFor();
  // O vínculo originado pelo caminhão é leitura histórica; não copia a viagem.
  await page.goto(origem+'/frota/motorista/3');
  await page.getByRole('cell',{name:'NF-TERC-HIST',exact:true}).waitFor();
  assert.equal(await page.getByRole('cell',{name:'NF-TERC-HIST',exact:true}).count(),1);
  await page.getByText(/Bruto R\$\s*10\.000,00 · Repasse bruto R\$\s*8\.900,00/).waitFor();
  assert.equal(await page.getByRole('cell',{name:'NF-LEGADO',exact:true}).count(),0);
  for (const [id,nf] of [[2,'NF-TERC-HIST'],[1,'NF-LEGADO']]) {
    await page.goto(origem+'/caminhao/'+id);
    await page.getByRole('button',{name:'Abrir →',exact:true}).click();
    await page.getByRole('cell',{name:nf,exact:true}).waitFor();
    assert.equal(await page.getByRole('cell',{name:nf,exact:true}).count(),1);
  }
  await page.goto(origem+'/consulta-periodo');
  await page.getByLabel('Data inicial').fill('2026-11-12');
  await page.getByLabel('Data final').fill('2026-11-12');
  await page.getByRole('button',{name:'Consultar',exact:true}).click();
  const gerais = page.getByRole('region',{name:'Resumo do escopo selecionado'});
  await gerais.waitFor();
  for (const [titulo, quantia] of [
    ['Viagens',/^1$/],
    ['Faturamento bruto geral',/10\.000,00/],
    ['C&M dos terceirizados (11%)',/1\.100,00/],
    ['Caminhoneiros (89%, antes de encargos)',/8\.900,00/],
  ]) {
    const indicador = gerais.getByRole('article').filter({has:page.getByText(titulo,{exact:true})});
    assert.match(await indicador.locator('strong').innerText(),quantia,titulo);
  }
  assert.equal(await page.getByRole('cell',{name:'NF-TERC-HIST',exact:true}).count(),1);
  // A NF anterior da C&M sem vínculo permanece fora de todos os perfis próprios.
  for (const id of [1,2]) {
    await page.goto(origem+'/frota/motorista/'+id);
    await page.getByText('Carregando viagens…',{exact:true}).waitFor({state:'hidden'});
    await page.getByText(/^0 viagens ·/).waitFor();
    assert.equal(await page.getByRole('cell',{name:'NF-LEGADO',exact:true}).count(),0);
  }
  await page.getByRole('link',{name:'Novo lançamento'}).click();
  await page.getByRole('link',{name:/Cadastrar viagem/}).click();
  await page.getByLabel('Caminhão',{exact:true}).selectOption('1');
  assert.equal(await page.getByLabel('Motorista responsável por esta viagem').inputValue(),'1');
  await page.getByLabel('Motorista responsável por esta viagem').selectOption('2');
  await page.getByLabel('Nota fiscal').fill('NF-TESTE-ACEITE');
  await page.getByLabel('Data de transporte').fill('2026-11-19');
  assert.equal(await page.getByLabel('Data de entrega').inputValue(),'2026-11-19');
  await page.getByLabel('Volume entregue').fill('100');
  await page.getByRole('button',{name:'Salvar viagem'}).click();
  assert.equal(requests.filter(r=>r.k==='v2_adicionar_viagem').length,0);
  await page.getByText('Confirmo que este motorista fez a viagem nesta data.').click();
  await page.getByRole('button',{name:'Salvar viagem'}).click();
  await page.getByRole('status').filter({hasText:'NF-TESTE-ACEITE'}).waitFor();
  const lancamento=requests.find(r=>r.k==='v2_adicionar_viagem').body.p_viagem;
  assert.equal(lancamento.motoristaId,2);
  assert.equal(lancamento.taxa,37.77);
  assert.equal(lancamento.percentualAplicado,12.5);
  assert.equal(tables.v2_alocacoes.at(-1).motorista_id,1);
  await page.goto(origem+'/alocacoes');
  const card = page.getByRole('article').filter({hasText:'AAA1B22'});
  await card.getByRole('combobox').selectOption('');
  await card.getByRole('button',{name:'Registrar troca'}).click();
  await card.getByText('Troca registrada.').waitFor();
  assert.equal(tables.v2_alocacoes.at(-1).motorista_id,null);
  assert.equal(tables.viagens_semanas.at(-1).viagens[0].motoristaId,2);
  await page.goto(origem+'/frota/motorista/2');
  await page.getByRole('cell',{name:'NF-TESTE-ACEITE',exact:true}).waitFor();
  assert.equal(await page.getByRole('cell',{name:'NF-LEGADO',exact:true}).count(),0);
  await page.getByRole('link',{name:'Nova despesa'}).click();
  await page.getByLabel('Descrição').fill('Adiantamento Fictício');
  await page.getByLabel('Data',{exact:true}).fill('2026-11-19');
  await page.getByLabel('Valor (R$)',{exact:true}).fill('100');
  assert.equal(await page.getByLabel('É um adiantamento?').isChecked(),false);
  await page.getByLabel('É um adiantamento?').check();
  await page.getByLabel('Valor recuperado (R$)').fill('30');
  await page.getByRole('button',{name:'Salvar lançamento'}).click();
  await page.getByText('Despesa salva.').waitFor();
  await page.getByRole('link',{name:'Ver Despesas'}).click();
  await page.getByText('Adiantamento · Pago parcialmente').waitFor();
  await page.getByLabel('Semana',{exact:true}).selectOption('2026-11-16:2026-11-21');
  assert.equal(await page.getByText('Despesa Geral Fictícia').count(),0);
  assert.match(await page.getByRole('region',{name:'Indicadores das despesas selecionadas'}).innerText(), /120,00/);
  await page.getByRole('link',{name:'Editar adiantamento'}).click();
  await page.getByRole('button',{name:'Quitar valor'}).click();
  await page.getByRole('button',{name:'Salvar lançamento'}).click();
  await page.getByText('Despesa salva.').waitFor();
  assert.equal(tables.v2_despesas_motoristas[0].recuperado,100);
  await context.close();

  const mobile = await criarPage({width:390,height:844});
  paginaAtiva = mobile.page;
  mobile.page.setDefaultTimeout(6000);
  await mobile.page.goto(origem+'/frota');
  await mobile.page.getByRole('button',{name:'Abrir menu'}).click();
  await mobile.page.getByRole('dialog',{name:'Menu principal'}).waitFor();
  await mobile.page.getByRole('link',{name:'Novo lançamento'}).click();
  assert.equal(await mobile.page.getByRole('dialog',{name:'Menu principal'}).count(),0);
  await mobile.page.getByRole('heading',{name:'Novo lançamento',exact:true}).waitFor();
  assert.equal(await mobile.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mobile.context.close();
  assert.deepEqual(errors,[]);
  console.log('OK: navegador desktop/mobile; menu, confirmação de viagem atrasada, snapshots, perfil, despesas por semana, adiantamento parcial e quitado.');
} catch (erro) {
  if (paginaAtiva && !paginaAtiva.isClosed()) console.error('Estado sintético na falha:', paginaAtiva.url(), await paginaAtiva.locator('body').innerText());
  throw erro;
} finally { await browser.close(); }
