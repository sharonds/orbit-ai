import type { OrbitClient } from '@orbit-ai/sdk'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { ZodTypeAny } from 'zod'
import { toToolError } from '../errors.js'
import { searchRecordsTool, getRecordTool, createRecordTool, updateRecordTool, deleteRecordTool, handleSearchRecords, handleGetRecord, handleCreateRecord, handleUpdateRecord, handleDeleteRecord } from './core-records.js'
import { relateRecordsTool, listRelatedRecordsTool, handleRelateRecords, handleListRelatedRecords } from './relationships.js'
import { bulkOperationTool, handleBulkOperation } from './bulk.js'
import { getPipelinesTool, moveDealStageTool, getPipelineStatsTool, handleGetPipelines, handleMoveDealStage, handleGetPipelineStats } from './pipelines.js'
import { logActivityTool, listActivitiesTool, handleLogActivity, handleListActivities } from './activities.js'
import { enrollInSequenceTool, unenrollFromSequenceTool, handleEnrollInSequence, handleUnenrollFromSequence } from './sequences.js'
import { assignRecordTool, handleAssignRecord } from './team.js'
import { getSchemaTool, createCustomFieldTool, updateCustomFieldTool, handleGetSchema, handleCreateCustomField, handleUpdateCustomField } from './schema.js'
import { importRecordsTool, exportRecordsTool, handleImportRecords, handleExportRecords } from './imports.js'
import { runReportTool, getDashboardSummaryTool, handleRunReport, handleGetDashboardSummary } from './analytics.js'

export interface ToolHandlerContext {
  client: OrbitClient
}

type ToolDefinition = ReturnType<typeof buildTools>[number]
type ToolHandler = (client: OrbitClient, args: unknown) => Promise<CallToolResult>

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  search_records: handleSearchRecords,
  get_record: handleGetRecord,
  create_record: handleCreateRecord,
  update_record: handleUpdateRecord,
  delete_record: handleDeleteRecord,
  relate_records: handleRelateRecords,
  list_related_records: handleListRelatedRecords,
  bulk_operation: handleBulkOperation,
  get_pipelines: handleGetPipelines,
  move_deal_stage: handleMoveDealStage,
  get_pipeline_stats: handleGetPipelineStats,
  log_activity: handleLogActivity,
  list_activities: handleListActivities,
  get_schema: handleGetSchema,
  create_custom_field: handleCreateCustomField,
  update_custom_field: handleUpdateCustomField,
  import_records: handleImportRecords,
  export_records: handleExportRecords,
  enroll_in_sequence: handleEnrollInSequence,
  unenroll_from_sequence: handleUnenrollFromSequence,
  run_report: handleRunReport,
  get_dashboard_summary: handleGetDashboardSummary,
  assign_record: handleAssignRecord,
}

const TOOL_DEFINITIONS = [
  searchRecordsTool,
  getRecordTool,
  createRecordTool,
  updateRecordTool,
  deleteRecordTool,
  relateRecordsTool,
  listRelatedRecordsTool,
  bulkOperationTool,
  getPipelinesTool,
  moveDealStageTool,
  getPipelineStatsTool,
  logActivityTool,
  listActivitiesTool,
  getSchemaTool,
  createCustomFieldTool,
  updateCustomFieldTool,
  importRecordsTool,
  exportRecordsTool,
  enrollInSequenceTool,
  unenrollFromSequenceTool,
  runReportTool,
  getDashboardSummaryTool,
  assignRecordTool,
] as const

export function buildTools() {
  return [...TOOL_DEFINITIONS]
}

export async function executeTool(
  client: OrbitClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const tool = TOOL_DEFINITIONS.find((entry) => entry.name === toolName)
  const handler = TOOL_HANDLERS[toolName]

  if (!tool || !handler) {
    return toToolError({
      code: 'UNKNOWN_TOOL' as const,
      message: `Unknown tool: ${toolName}`,
    })
  }

  try {
    return await handler(client, parseArgs(tool.inputZodSchema, args))
  } catch (error) {
    return toToolError(error)
  }
}

function parseArgs(schema: ZodTypeAny, args: Record<string, unknown>) {
  return schema.parse(args)
}
