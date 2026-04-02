import { generateId } from '../../ids/generate-id.js'
import { assertDeleted, assertFound } from '../../services/service-helpers.js'
import type { EntityService } from '../../services/entity-service.js'
import { createOrbitError } from '../../types/errors.js'
import type { CompanyRepository } from '../companies/repository.js'
import type { ContactRepository } from '../contacts/repository.js'
import type { DealRepository } from '../deals/repository.js'
import type { UserRepository } from '../users/repository.js'
import type { TaskRepository } from './repository.js'
import {
  taskCreateInputSchema,
  taskRecordSchema,
  taskUpdateInputSchema,
  type TaskCreateInput,
  type TaskRecord,
  type TaskUpdateInput,
} from './validators.js'

async function assertTaskRelations(
  ctx: Parameters<EntityService<TaskCreateInput, TaskUpdateInput, TaskRecord>['create']>[0],
  deps: {
    contacts: ContactRepository
    companies: CompanyRepository
    deals: DealRepository
    users: UserRepository
  },
  input: {
    contactId?: string | null | undefined
    companyId?: string | null | undefined
    dealId?: string | null | undefined
    assignedToUserId?: string | null | undefined
  },
): Promise<void> {
  function relationNotFound(message: string) {
    return createOrbitError({
      code: 'RELATION_NOT_FOUND',
      message,
    })
  }

  if (input.contactId !== undefined && input.contactId !== null) {
    const contact = await deps.contacts.get(ctx, input.contactId)
    if (!contact) {
      throw relationNotFound(`Contact ${input.contactId} not found for task`)
    }
  }

  if (input.companyId !== undefined && input.companyId !== null) {
    const company = await deps.companies.get(ctx, input.companyId)
    if (!company) {
      throw relationNotFound(`Company ${input.companyId} not found for task`)
    }
  }

  if (input.dealId !== undefined && input.dealId !== null) {
    const deal = await deps.deals.get(ctx, input.dealId)
    if (!deal) {
      throw relationNotFound(`Deal ${input.dealId} not found for task`)
    }
  }

  if (input.assignedToUserId !== undefined && input.assignedToUserId !== null) {
    const user = await deps.users.get(ctx, input.assignedToUserId)
    if (!user) {
      throw relationNotFound(`User ${input.assignedToUserId} not found for task`)
    }
  }
}

function assertTaskCompletionState(input: {
  isCompleted: boolean
  completedAt: Date | null
}): void {
  if (input.completedAt !== null && !input.isCompleted) {
    throw createOrbitError({
      code: 'VALIDATION_FAILED',
      message: 'Task completedAt requires isCompleted to be true',
      field: 'completedAt',
    })
  }
}

export function createTaskService(deps: {
  tasks: TaskRepository
  contacts: ContactRepository
  companies: CompanyRepository
  deals: DealRepository
  users: UserRepository
}): EntityService<TaskCreateInput, TaskUpdateInput, TaskRecord> {
  return {
    async create(ctx, input) {
      const parsed = taskCreateInputSchema.parse(input)
      await assertTaskRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        assignedToUserId: parsed.assignedToUserId,
      })
      assertTaskCompletionState({
        isCompleted: parsed.isCompleted ?? false,
        completedAt: parsed.completedAt ?? null,
      })

      const now = new Date()
      return deps.tasks.create(
        ctx,
        taskRecordSchema.parse({
          id: generateId('task'),
          organizationId: ctx.orgId,
          title: parsed.title,
          description: parsed.description ?? null,
          dueDate: parsed.dueDate ?? null,
          priority: parsed.priority ?? 'medium',
          isCompleted: parsed.isCompleted ?? false,
          completedAt: parsed.completedAt ?? null,
          contactId: parsed.contactId ?? null,
          dealId: parsed.dealId ?? null,
          companyId: parsed.companyId ?? null,
          assignedToUserId: parsed.assignedToUserId ?? null,
          customFields: parsed.customFields ?? {},
          createdAt: now,
          updatedAt: now,
        }),
      )
    },
    async get(ctx, id) {
      return deps.tasks.get(ctx, id)
    },
    async update(ctx, id, input) {
      const parsed = taskUpdateInputSchema.parse(input)
      const current = assertFound(await deps.tasks.get(ctx, id), `Task ${id} not found`)
      await assertTaskRelations(ctx, deps, {
        contactId: parsed.contactId,
        companyId: parsed.companyId,
        dealId: parsed.dealId,
        assignedToUserId: parsed.assignedToUserId,
      })

      const nextIsCompleted = parsed.isCompleted ?? current.isCompleted
      const nextCompletedAt = parsed.completedAt !== undefined ? parsed.completedAt ?? null : current.completedAt
      assertTaskCompletionState({
        isCompleted: nextIsCompleted,
        completedAt: nextCompletedAt,
      })

      const patch: Partial<TaskRecord> = {
        updatedAt: new Date(),
      }

      if (parsed.title !== undefined) patch.title = parsed.title
      if (parsed.description !== undefined) patch.description = parsed.description ?? null
      if (parsed.dueDate !== undefined) patch.dueDate = parsed.dueDate ?? null
      if (parsed.priority !== undefined) patch.priority = parsed.priority
      if (parsed.isCompleted !== undefined) patch.isCompleted = parsed.isCompleted
      if (parsed.completedAt !== undefined) patch.completedAt = parsed.completedAt ?? null
      if (parsed.contactId !== undefined) patch.contactId = parsed.contactId ?? null
      if (parsed.dealId !== undefined) patch.dealId = parsed.dealId ?? null
      if (parsed.companyId !== undefined) patch.companyId = parsed.companyId ?? null
      if (parsed.assignedToUserId !== undefined) patch.assignedToUserId = parsed.assignedToUserId ?? null
      if (parsed.customFields !== undefined) patch.customFields = parsed.customFields

      return assertFound(await deps.tasks.update(ctx, id, patch), `Task ${id} not found`)
    },
    async delete(ctx, id) {
      assertDeleted(await deps.tasks.delete(ctx, id), `Task ${id} not found`)
    },
    async list(ctx, query) {
      return deps.tasks.list(ctx, query)
    },
    async search(ctx, query) {
      return deps.tasks.search(ctx, query)
    },
  }
}
