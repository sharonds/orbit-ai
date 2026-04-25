import { expect } from 'vitest'

type McpToolResponse = { content?: Array<{ type?: string; text?: string }>; isError?: boolean }

export function parseMcpTextPayload(response: McpToolResponse, label: string): Record<string, unknown> {
  expect(response.content?.[0]?.type, `${label}: first content block type`).toBe('text')
  const text = response.content?.[0]?.text
  expect(text, `${label}: text payload`).toBeTruthy()
  return JSON.parse(text!) as Record<string, unknown>
}

export function expectMcpSuccess(response: McpToolResponse, label: string): Record<string, unknown> {
  expect(response.isError, `${label}: isError`).toBeFalsy()
  const payload = parseMcpTextPayload(response, label)
  expect(payload.ok ?? true, `${label}: ok flag`).not.toBe(false)
  return payload
}

export function expectMcpError(response: McpToolResponse, code: string, label: string): Record<string, unknown> {
  expect(response.isError, `${label}: isError`).toBe(true)
  const payload = parseMcpTextPayload(response, label)
  const error = (payload.error ?? payload) as { code?: unknown; message?: unknown; hint?: unknown; recovery?: unknown }
  expect(error.code, `${label}: error.code`).toBe(code)
  expect(typeof error.message, `${label}: error.message`).toBe('string')
  if ('hint' in error) expect(typeof error.hint, `${label}: error.hint`).toBe('string')
  if ('recovery' in error) expect(typeof error.recovery, `${label}: error.recovery`).toBe('string')
  return payload
}
