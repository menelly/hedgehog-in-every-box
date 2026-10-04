// 🦔 The demo app's server: static pages + a tiny save/load API.
//
// The server itself is CORRECT on purpose. Every bug in broken.html is in the
// page, where these bugs usually live. Saves are kept in memory, per
// ?profile=, so parallel tests don't trip over each other.
//
//   node demo/server.mjs          → http://127.0.0.1:4790/broken.html and /fixed.html
//   HEDGEHOG_DEMO_PORT=5000 node demo/server.mjs

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.HEDGEHOG_DEMO_PORT ?? 4790)
const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url))
const store = new Map() // key → saved object
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const key = url.searchParams.get('key') ?? 'default'

  if (url.pathname === '/health') return json(res, 200, { ok: true })

  if (url.pathname === '/api/load') return json(res, 200, store.get(key) ?? {})

  if (url.pathname === '/api/save' && req.method === 'POST') {
    let body = ''
    for await (const chunk of req) body += chunk
    // a little delay, like a real network, so double-clicks have a window to land in
    await new Promise((r) => setTimeout(r, 150))
    try {
      store.set(key, JSON.parse(body))
      return json(res, 200, { saved: true })
    } catch (e) {
      return json(res, 400, { error: `that wasn't valid JSON: ${e.message}` })
    }
  }

  // static files
  const path = url.pathname === '/' ? '/index.html' : url.pathname
  const file = normalize(join(PUBLIC, decodeURIComponent(path)))
  if (!file.startsWith(normalize(PUBLIC))) return json(res, 403, { error: 'no' })
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    json(res, 404, { error: 'not found' })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`🦔 demo app on http://127.0.0.1:${PORT}/  (broken.html · fixed.html)`))
