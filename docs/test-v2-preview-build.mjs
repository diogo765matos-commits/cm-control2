import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Run in a clean checkout, with dependencies already installed.
const out = mkdtempSync(join(tmpdir(), 'cm-preview-build-'))
const ref = 'aiycrrhuvdwyslpnybiu'
const wrongRef = 'afrausczplulzrfhikjg'
const testUrl = 'https://' + ref + '.supabase.co'
const wrongUrl = 'https://' + wrongRef + '.supabase.co'
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const syntheticJwt = (ref, role = 'anon') =>
  [encode({ alg: 'HS256' }), encode({ iss: 'supabase', ref, role }), 'ficticia'].join('.')
const hosted = {
  VERCEL_ENV: 'preview',
  VITE_CM_PREVIEW: '1',
  VITE_SUPABASE_URL: testUrl,
  VITE_SUPABASE_ANON_KEY: syntheticJwt(ref),
}
const base = { ...process.env }
for (const name of Object.keys(hosted)) delete base[name]
function build(name, config, expectError, args = []) {
  const path = join(out, name)
  const result = spawnSync(process.execPath, [
    'node_modules/vite/bin/vite.js', 'build', '--outDir', path, ...args,
  ], { env: { ...base, ...config }, encoding: 'utf8' })
  assert.ifError(result.error)
  const log = result.stdout + result.stderr
  if (expectError) {
    assert.equal(result.status, 1, log)
    assert.match(log, expectError)
    assert.equal(existsSync(path), false, 'a build inválida não deve emitir artefatos')
    return ''
  }
  assert.equal(result.status, 0, log)
  return readdirSync(join(path, 'assets')).filter(file => file.endsWith('.js'))
    .map(file => readFileSync(join(path, 'assets', file), 'utf8')).join('\n')
}

try {
  build('sem-marcador', { ...hosted, VITE_CM_PREVIEW: '' }, /Preview requer VITE_CM_PREVIEW=1/)
  const { VITE_CM_PREVIEW: _marker, ...semMarcador } = hosted
  build('vercel-sem-marcador', semMarcador, /Preview requer VITE_CM_PREVIEW=1/)
  build('marcador-incorreto', { ...hosted, VITE_CM_PREVIEW: '0' }, /Preview requer VITE_CM_PREVIEW=1/)
  build('sem-url', { ...hosted, VITE_SUPABASE_URL: '' }, /Preview requer a URL HTTPS/)
  build('localhost-hospedado', { ...hosted, VITE_SUPABASE_URL: 'http://127.0.0.1:4781' }, /Preview requer a URL HTTPS/)
  build('producao', { ...hosted, VITE_SUPABASE_URL: wrongUrl }, /Preview requer a URL HTTPS/)
  build('modo-explicito', { ...hosted, VERCEL_ENV: '', VITE_SUPABASE_URL: wrongUrl }, /Preview requer a URL HTTPS/)
  build('nao-url', { ...hosted, VITE_SUPABASE_URL: 'not-a-url' }, /Preview requer a URL HTTPS/)
  build('url-inesperada', { ...hosted, VITE_SUPABASE_URL: testUrl + '/extra' }, /Preview requer a URL HTTPS/)
  build('sem-chave', { ...hosted, VITE_SUPABASE_ANON_KEY: '' }, /Preview requer a chave anon JWT/)
  build('chave-outro-projeto', { ...hosted, VITE_SUPABASE_ANON_KEY: syntheticJwt(wrongRef) }, /Preview requer a chave anon JWT/)
  build('chave-privilegiada', { ...hosted, VITE_SUPABASE_ANON_KEY: syntheticJwt(ref, 'service_role') }, /Preview requer a chave anon JWT/)
  build('chave-invalida', { ...hosted, VITE_SUPABASE_ANON_KEY: 'x.y.z' }, /Preview requer a chave anon JWT/)

  const preview = build('preview-ok', hosted)
  assert.ok(preview.includes(testUrl))
  assert.ok(!preview.includes(wrongRef))
  assert.ok(preview.includes('Cadastro indisponível nesta versão de teste'), 'deve desligar cadastro no cliente')
  const local = { VITE_SUPABASE_URL: 'http://127.0.0.1:4781', VITE_SUPABASE_ANON_KEY: 'ficticia' }
  assert.ok(build('normal', local).includes(local.VITE_SUPABASE_URL))
  assert.ok(build('preview-local', local, null, ['--mode', 'preview']).includes('Cadastro indisponível nesta versão de teste'))
  console.log('Preview build guard: casos inválidos, build hospedada válida, produção e ensaio local passaram.')
} finally {
  rmSync(out, { recursive: true, force: true })
}
