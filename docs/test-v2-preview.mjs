// Production bundles only; no Vite dev server, production credentials, or remote requests.
// PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE are absolute local paths; PREVIEW_DIST and NORMAL_DIST point to synthetic builds.
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const { PLAYWRIGHT_MODULE, CHROMIUM_EXECUTABLE, PREVIEW_DIST, NORMAL_DIST } = process.env;
assert.ok(PLAYWRIGHT_MODULE && PREVIEW_DIST, 'Informe PLAYWRIGHT_MODULE e PREVIEW_DIST.');
const { chromium } = await import(pathToFileURL(PLAYWRIGHT_MODULE).href);
const { rewrites } = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
assert.deepEqual(rewrites.find((r) => r.source === '/caminhao/:id'), {
  source: '/caminhao/:id', destination: '/index.html',
});
const regras = rewrites.map(({source, destination}) => ({
  matcher: new RegExp('^' + source.replace(/:\w+/g, '[^/]+') + '/?$'), destination,
}));
const api = 'http://127.0.0.1:4781';
const doc = '/caminhao/1';
const placa = 'SYN1T23';
const account = {email:'fixture@example.test', password:'synthetic-only-123'};
const requests = [];
const falhas = [];
async function abrirServidor(dir) {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const path = new URL(req.url, 'http://127.0.0.1').pathname;
      let local = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (!local.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      if (!(await stat(local).catch(() => null))?.isFile()) {
        const regra = regras.find(({matcher})=>matcher.test(path));
        if (!regra) { res.writeHead(404).end(); return; }
        local = resolve(root, '.' + regra.destination);
        if (!local.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      }
      const tipos = {'.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml'};
      res.writeHead(200, {'content-type':tipos[extname(local)] || 'application/octet-stream'});
      res.end(await readFile(local));
    } catch (error) {
      falhas.push(error.message);
      res.writeHead(500).end();
    }
  });
  await new Promise((ok, fail) => server.listen(0, '127.0.0.1', ok).once('error', fail));
  return {server, origem:'http://127.0.0.1:' + server.address().port};
}
async function aplicarFixture(context, origem) {
  await context.route('**/*', async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.origin === origem) return route.continue();
    if (url.href === 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js') {
      return route.fulfill({contentType:'application/javascript', body:''});
    }
    if (url.origin !== api) {
      falhas.push('Origem inesperada: '+url.origin);
      return route.abort();
    }
    const headers = {'access-control-allow-origin':origem,
      'access-control-allow-headers':'content-type,apikey,authorization,prefer',
      'access-control-allow-methods':'GET,POST,OPTIONS'};
    if (req.method() === 'OPTIONS') return route.fulfill({status:204,headers});
    requests.push({path:url.pathname, method:req.method(), origem});
    let json;
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password' && req.method() === 'POST') {
      if (JSON.stringify(req.postDataJSON()) !== JSON.stringify(account)) falhas.push('Credenciais não são a fixture.');
      json = {access_token:'synthetic-session',user:{email:account.email}};
    } else if (url.pathname === '/rest/v1/caminhoes' && req.method() === 'GET') {
      json = [{id:1,modelo:'Caminhão fixture preview', placa, motorista:'Pessoa fictícia', frota:'cm'}];
    } else if (url.pathname.startsWith('/rest/v1/') && req.method() === 'GET') {
      json = [];
    } else {
      falhas.push('Requisição não autorizada no teste: '+req.method()+' '+url.pathname);
      return route.fulfill({json:{message:'fixture refused'},status:403,headers});
    }
    return route.fulfill({json,headers});
  });
}

const servidores = [];
let browser;
try {
  const preview = await abrirServidor(PREVIEW_DIST);
  servidores.push(preview.server);
  browser = await chromium.launch({executablePath:CHROMIUM_EXECUTABLE || undefined, headless:true, chromiumSandbox:true});
  const previewContext = await browser.newContext();
  await aplicarFixture(previewContext,preview.origem);
  const tab = await previewContext.newPage();
  tab.on('pageerror', err => falhas.push(err.message));
  tab.setDefaultTimeout(8000);
  const endereco = preview.origem + doc;
  const asset = tab.waitForResponse(resp => new URL(resp.url()).pathname.startsWith('/assets/') &&
    new URL(resp.url()).pathname.endsWith('.js'));
  const css = tab.waitForResponse(resp => new URL(resp.url()).pathname.startsWith('/assets/') &&
    new URL(resp.url()).pathname.endsWith('.css'));
  const raw = await tab.goto(endereco);
  assert.equal(raw.status(),200);
  assert.match(raw.headers()['content-type'],/^text\/html/);
  const staticResponse = await asset;
  assert.equal(staticResponse.status(),200);
  assert.match(staticResponse.headers()['content-type'],/javascript/);
  const cssResponse = await css;
  assert.equal(cssResponse.status(),200);
  assert.match(cssResponse.headers()['content-type'],/^text\/css/);
  for (const path of ['/assets/unknown.js','/api/unknown']) {
    assert.equal((await fetch(preview.origem+path)).status,404);
  }
  assert.equal(tab.url(),endereco);

  await tab.getByRole('heading',{name:/C&M Control/}).waitFor();
  assert.equal(await tab.getByRole('button',{name:'Criar conta',exact:true}).count(),0);
  assert.equal(requests.length,0);
  await tab.getByLabel('E-mail').fill(account.email);
  await tab.getByLabel('Senha').fill(account.password);
  await tab.getByRole('button',{name:'Entrar',exact:true}).click();
  await tab.getByRole('heading',{name:/Caminhão fixture preview/}).waitFor();
  assert.equal(tab.url(),endereco);
  assert.equal(requests.filter(r=>r.path === '/auth/v1/token').length,1);

  const novoTab = await previewContext.newPage();
  novoTab.on('pageerror', err => falhas.push(err.message));
  assert.equal((await novoTab.goto(endereco)).status(),200);
  await novoTab.getByRole('heading',{name:/Caminhão fixture preview/}).waitFor({timeout:8000});
  assert.equal(novoTab.url(),endereco);
  assert.equal((await novoTab.reload()).status(),200);
  await novoTab.getByRole('heading',{name:/Caminhão fixture preview/}).waitFor({timeout:8000});
  assert.equal(novoTab.url(),endereco);

  if (NORMAL_DIST) {
    const normal = await abrirServidor(NORMAL_DIST);
    servidores.push(normal.server);
    const normalContext = await browser.newContext();
    await aplicarFixture(normalContext,normal.origem);
    const normalTab = await normalContext.newPage();
    await normalTab.goto(normal.origem+doc);
    await normalTab.getByRole('button',{name:'Criar conta',exact:true}).waitFor({timeout:8000});
    assert.equal(normalTab.url(),normal.origem+doc);
    console.log('OK: build não-preview mantém a aba Criar conta sem abrir cadastro.');
  }
  assert.equal(requests.filter(r=>r.path === '/auth/v1/signup').length,0);
  assert.deepEqual(falhas,[]);
  console.log('OK: bundle de preview estático; deep link, JS real, login, nova aba e reload sem trocar rota ou pedir signup.');
} finally {
  await browser?.close();
  await Promise.all(servidores.map(s => new Promise(resolve => s.close(resolve))));
}
