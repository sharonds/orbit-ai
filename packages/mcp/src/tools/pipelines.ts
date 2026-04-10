import { z } from 'zod'
import type { OrbitClient } from '@orbit-ai/sdk'
import { defineTool, LimitSchema } from './schemas.js'
import { toToolSuccess } from '../errors.js'
import { sanitizeObjectDeep } from '../output/sensitive.js'

const GetPipelinesInput = z.object({
  limit: LimitSchema,
  cursor: z.string().optional(),
})

const MoveDealStageInput = z.object({
  deal_id: z.string(),
  stage_id: z.string(),
  occurred_at: z.string().optional(),
  note: z.string().optional(),
})

const PipelineStatsInput = z.object({
  pipeline_id: z.string().optional(),
})

export const getPipelinesTool = defineTool({
  name: 'get_pipelines',
  title: 'List Orbit pipelines',
  description:
    'Use this to inspect available pipelines and stages before moving deals. Do not use it when you need a specific deal record.',
  inputSchema: GetPipelinesInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export const moveDealStageTool = defineTool({
  name: 'move_deal_stage',
  title: 'Move an Orbit deal to a new stage',
  description:
    'Use this when a deal must move between stages and you already know both the deal ID and target stage ID. Do not patch deals directly for stage transitions.',
  inputSchema: MoveDealStageInput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
})

export const getPipelineStatsTool = defineTool({
  name: 'get_pipeline_stats',
  title: 'Get Orbit pipeline stats',
  description:
    'Use this for aggregate pipeline metrics. Do not use it for individual deal reads.',
  inputSchema: PipelineStatsInput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
})

export async function handleGetPipelines(client: OrbitClient, rawArgs: unknown) {
  const args = GetPipelinesInput.parse(rawArgs)
  return toToolSuccess(
    await client.pipelines.list({
      ...(args.limit !== undefined ? { limit: args.limit } : {}),
      ...(args.cursor ? { cursor: args.cursor } : {}),
    }),
  )
}

export async function handleMoveDealStage(client: OrbitClient, rawArgs: unknown) {
  const args = MoveDealStageInput.parse(rawArgs)
  // The current SDK seam accepts only { stage_id }. Keep the richer MCP input for forward compatibility.
  return toToolSuccess(sanitizeObjectDeep(await client.deals.move(args.deal_id, { stage_id: args.stage_id })))
}

export async function handleGetPipelineStats(client: OrbitClient, rawArgs: unknown) {
  const args = PipelineStatsInput.parse(rawArgs)
  return toToolSuccess(await client.deals.stats(args))
}
