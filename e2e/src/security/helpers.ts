import { expect } from 'vitest'
import type { Stack } from '../harness/build-stack.js'

export const API_VERSION = '2026-04-01'

export function apiHeaders(rawApiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${rawApiKey}`,
    'Orbit-Version': API_VERSION,
    'content-type': 'application/json',
  }
}

export async function rawApi(
  stack: Stack,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return stack.api.fetch(new Request(`http://test.local/v1/${path}`, {
    ...init,
    headers: {
      ...apiHeaders(stack.rawApiKey),
      ...(init.headers ?? {}),
    },
  }))
}

export async function expectApiError(
  response: Response,
  input: { status: number; code: string; label: string },
): Promise<void> {
  expect(response.status, `${input.label} status`).toBe(input.status)
  const envelope = (await response.json()) as { error?: { code?: string } }
  expect(envelope.error?.code, `${input.label} code`).toBe(input.code)
}

export async function expectRawApiNotFound(
  stack: Stack,
  entity: string,
  id: string,
): Promise<void> {
  await expectApiError(await rawApi(stack, `${entity}/${id}`), {
    status: 404,
    code: 'RESOURCE_NOT_FOUND',
    label: `raw-api ${entity}/${id}`,
  })
}

export function unwrapData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  const data = record.data
  if (data && typeof data === 'object') return data as Record<string, unknown>
  return record
}
