import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { defineTool } from './schemas.js'
import { McpNotImplementedError } from '../errors.js'

const ImportExportInput = z.object({
  object_type: z.string().optional(),
  file: z.string().optional(),
  file_path: z.string().optional(),
})

export const importRecordsTool = defineTool({
  name: 'import_records',
  title: 'Import Orbit records',
  description: 'Use this when a real import seam exists. Do not use it until Orbit exposes file-backed imports through the SDK.',
  inputSchema: ImportExportInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const exportRecordsTool = defineTool({
  name: 'export_records',
  title: 'Export Orbit records',
  description: 'Use this only when Orbit exposes a real export capability. Do not use it for normal record reads.',
  inputSchema: ImportExportInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export async function handleImportRecords(): Promise<CallToolResult> {
  throw new McpNotImplementedError()
}

export async function handleExportRecords(): Promise<CallToolResult> {
  throw new McpNotImplementedError()
}
