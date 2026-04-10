import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { OrbitClient } from '@orbit-ai/sdk'
import type { RuntimeApiAdapter } from '@orbit-ai/api'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { normalizeToolError, toToolError } from '../errors.js'
import type { StartMcpServerOptions } from '../server.js'
import { createMcpServer, writeStderrWarning } from '../server.js'

export interface HttpRuntime {
  address: string
  port: number
  server: Server
}

export function resolveHttpOptions(options: Pick<StartMcpServerOptions, 'bindAddress' | 'port'>) {
  return {
    bindAddress: options.bindAddress ?? '127.0.0.1',
    port: options.port ?? 3001,
  }
}

export async function startHttpTransport(options: StartMcpServerOptions): Promise<HttpRuntime> {
  const { bindAddress, port } = resolveHttpOptions(options)

  if (!options.adapter) {
    throw new Error('HTTP MCP transport requires adapter.')
  }

  if (bindAddress !== '127.0.0.1') {
    writeStderrWarning(`MCP HTTP transport binding to ${bindAddress}; this exposes the server to external connections.`)
  }

  const server = createServer(async (req, res) => {
    try {
      await handleAuthenticatedHttpRequest(req, res, options.client, options.adapter!, bindAddress)
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 500
      const isBodyTooLarge =
        error instanceof SyntaxError && error.message === 'Request body too large.'
      const normalized = normalizeToolError(
        statusCode === 400
          ? {
              code: 'VALIDATION_FAILED' as const,
              message: isBodyTooLarge
                ? 'Request body exceeds the 1 MB limit.'
                : 'Malformed JSON body.',
            }
          : error,
      )
      writeStderrWarning(`MCP HTTP ${statusCode} error: ${normalized.code}: ${normalized.message}`)
      if (res.headersSent) {
        return
      }

      res.writeHead(statusCode, { 'content-type': 'application/json' })
      res.end(JSON.stringify(toToolError(normalized)))
    }
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, bindAddress, () => {
      server.off('error', reject)
      resolve()
    })
  })

  return { address: bindAddress, port, server }
}

export async function handleAuthenticatedHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  templateClient: OrbitClient,
  adapter: RuntimeApiAdapter,
  _bindAddress = '127.0.0.1',
): Promise<void> {
  const auth = await authenticateRequest(req, adapter)
  if (!auth.ok) {
    res.writeHead(401, { 'content-type': 'application/json' })
    res.end(JSON.stringify(toToolError({ code: 'AUTH_INVALID', message: auth.message })))
    return
  }

  const body = req.method === 'POST' ? await readJsonBody(req) : undefined
  const server = createMcpServer({
    // Bind execution to the adapter-backed auth decision by scoping the direct client to the looked-up organization.
    client: new OrbitClient({
      adapter: adapter as never,
      context: { orgId: auth.key.organizationId },
      ...(templateClient.options.version ? { version: templateClient.options.version } : {}),
    }),
    transport: 'http',
    port: 0,
    bindAddress: '127.0.0.1',
    adapter,
  })
  const transport = new StreamableHTTPServerTransport()
  await server.connect(transport as never)
  await transport.handleRequest(req, res, body)
}

/**
 * Authenticates an HTTP request against the adapter's API-key store.
 *
 * On success, returns the resolved key record. The raw bearer token is
 * intentionally NOT included in the result — do not re-extract it from
 * req.headers for logging or forwarding, as that would defeat redaction.
 *
 * Checks: header presence, non-empty token, SHA-256 lookup, revocation, expiry.
 */
export async function authenticateRequest(
  req: IncomingMessage,
  adapter: RuntimeApiAdapter,
): Promise<
  | {
      ok: true
      key: NonNullable<Awaited<ReturnType<RuntimeApiAdapter['lookupApiKeyForAuth']>>>
    }
  | { ok: false; message: string }
> {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    return { ok: false, message: 'Missing or malformed Authorization header' }
  }

  const token = authorization.slice(7)
  if (!token) {
    return { ok: false, message: 'Missing or malformed Authorization header' }
  }

  const hash = await sha256Hex(token)
  const key = await adapter.lookupApiKeyForAuth(hash)
  if (!key) {
    return { ok: false, message: 'Invalid API key' }
  }
  if (key.revokedAt !== null) {
    return { ok: false, message: 'API key has been revoked' }
  }
  if (key.expiresAt !== null && key.expiresAt.getTime() < Date.now()) {
    return { ok: false, message: 'API key has expired' }
  }

  return { ok: true, key }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let totalLength = 0
  const MAX_BODY = 1_048_576 // 1 MB
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    totalLength += buf.length
    if (totalLength > MAX_BODY) {
      throw new SyntaxError('Request body too large.')
    }
    chunks.push(buf)
  }
  if (chunks.length === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(buffer))
    .map((entry) => entry.toString(16).padStart(2, '0'))
    .join('')
}
