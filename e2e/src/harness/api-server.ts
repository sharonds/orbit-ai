import { createServer, type Server } from 'node:http'

export interface StartedApiServer {
  readonly baseUrl: string
  close(): Promise<void>
}

export async function startApiServer(api: { fetch(request: Request): Promise<Response> | Response }): Promise<StartedApiServer> {
  const server = createServer(async (req, res) => {
    try {
      const host = req.headers.host ?? '127.0.0.1'
      const url = `http://${host}${req.url ?? '/'}`
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      const body = chunks.length === 0 ? undefined : Buffer.concat(chunks)
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item)
        } else if (value !== undefined) {
          headers.set(key, value)
        }
      }
      const init: RequestInit = { headers }
      if (req.method !== undefined) init.method = req.method
      if (body !== undefined) init.body = body
      const response = await api.fetch(new Request(url, init))
      res.statusCode = response.status
      const setCookieValues =
        typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === 'function'
          ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie()
          : []
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie' && setCookieValues.length > 0) return
        res.setHeader(key, value)
      })
      if (setCookieValues.length > 0) res.setHeader('set-cookie', setCookieValues)
      const arrayBuffer = await response.arrayBuffer()
      res.end(Buffer.from(arrayBuffer))
    } catch (err) {
      console.error('E2E API server request failed:', err instanceof Error ? err.message : String(err))
      res.statusCode = 500
      res.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR' } }))
    }
  })

  try {
    await listen(server)
  } catch (err) {
    try {
      await closeServer(server)
    } catch {
      // The server may already be closed after a bind failure.
    }
    throw err
  }

  const address = server.address()
  if (!address || typeof address === 'string') {
    await closeServer(server)
    throw new Error('E2E API server did not bind to a TCP port')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server),
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: Error) => {
      server.off('listening', onListening)
      reject(err)
    }
    const onListening = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(0, '127.0.0.1')
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()))
  })
}
