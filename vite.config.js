import { Buffer } from 'node:buffer'
import { env } from 'node:process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const previewProject = 'aiycrrhuvdwyslpnybiu'
const previewUrl = 'https://' + previewProject + '.supabase.co'

function isPreviewAnonJwt(key) {
  const parts = typeof key === 'string' && key.split('.')
  if (!parts || parts.length !== 3 || !parts.every(part => /^[\w-]+$/.test(part))) return false

  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    // This is a configuration check, not cryptographic JWT verification.
    // Supabase verifies the signature when the deployed client uses the key.
    return header?.alg === 'HS256' && claims?.iss === 'supabase' &&
      claims?.ref === previewProject && claims?.role === 'anon'
  } catch {
    return false
  }
}

function guardPreviewBuild() {
  return {
    name: 'cm-preview-build-guard',
    apply: 'build',
    configResolved(config) {
      // Vite has already applied .env files and process-variable precedence.
      const vars = config.env
      if (env.VERCEL_ENV !== 'preview' && vars.VITE_CM_PREVIEW === undefined) return
      if (vars.VITE_CM_PREVIEW !== '1') {
        throw new Error('C&M Preview requer VITE_CM_PREVIEW=1.')
      }
      if (vars.VITE_SUPABASE_URL !== previewUrl) {
        throw new Error('C&M Preview requer a URL HTTPS exata do projeto Supabase de teste.')
      }
      if (!isPreviewAnonJwt(vars.VITE_SUPABASE_ANON_KEY)) {
        throw new Error('C&M Preview requer a chave anon JWT pública do projeto Supabase de teste.')
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [guardPreviewBuild(), react()],
  define: { 'import.meta.env.VITE_CM_VERCEL_PREVIEW': JSON.stringify(env.VERCEL_ENV === 'preview') },
})
