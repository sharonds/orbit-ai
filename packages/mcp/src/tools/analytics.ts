import { z } from 'zod'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { defineTool } from './schemas.js'
import { McpNotImplementedError } from '../errors.js'

const AnalyticsInput = z.object({
  object_type: z.string().optional(),
  query: z.record(z.string(), z.unknown()).optional(),
})

export const runReportTool = defineTool({
  name: 'run_report',
  title: 'Run an Orbit report',
  description: 'Use this only after Orbit ships reporting APIs. Do not use it for ordinary search or list operations.',
  inputSchema: AnalyticsInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export const getDashboardSummaryTool = defineTool({
  name: 'get_dashboard_summary',
  title: 'Get an Orbit dashboard summary',
  description: 'Use this only after Orbit ships a dashboard summary API. Do not approximate it from unrelated tools.',
  inputSchema: AnalyticsInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export async function handleRunReport(): Promise<CallToolResult> {
  throw new McpNotImplementedError()
}

export async function handleGetDashboardSummary(): Promise<CallToolResult> {
  throw new McpNotImplementedError()
}
