import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

import { assertOrbitId } from '../ids/parse-id.js'
import {
  activities,
  apiKeys,
  companies,
  contacts,
  deals,
  notes,
  organizationMemberships,
  organizations,
  pipelines,
  stages,
  tasks,
  users,
} from './tables.js'

const emailSchema = z.string().email().optional().nullable()
const phoneSchema = z.string().min(5).optional().nullable()
const websiteSchema = z.string().url().optional().nullable()
const orbitId = (kind: Parameters<typeof assertOrbitId>[1]) =>
  z.string().transform((value, ctx) => {
    try {
      return assertOrbitId(value, kind)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : `Invalid ${kind} id`,
      })

      return z.NEVER
    }
  })

export const organizationSelectSchema = createSelectSchema(organizations, {
  id: orbitId('organization'),
})
export const organizationInsertSchema = createInsertSchema(organizations)
export const organizationUpdateSchema = createUpdateSchema(organizations)

export const userSelectSchema = createSelectSchema(users, {
  id: orbitId('user'),
  organizationId: orbitId('organization'),
  email: z.string().email(),
})
export const userInsertSchema = createInsertSchema(users, {
  organizationId: orbitId('organization'),
  email: z.string().email(),
})
export const userUpdateSchema = createUpdateSchema(users, {
  organizationId: orbitId('organization').optional(),
  email: emailSchema,
})

export const organizationMembershipSelectSchema = createSelectSchema(organizationMemberships, {
  id: orbitId('membership'),
  organizationId: orbitId('organization'),
  userId: orbitId('user'),
  invitedByUserId: orbitId('user').optional().nullable(),
})
export const organizationMembershipInsertSchema = createInsertSchema(organizationMemberships, {
  organizationId: orbitId('organization'),
  userId: orbitId('user'),
  invitedByUserId: orbitId('user').optional().nullable(),
})
export const organizationMembershipUpdateSchema = createUpdateSchema(organizationMemberships, {
  organizationId: orbitId('organization').optional(),
  userId: orbitId('user').optional(),
  invitedByUserId: orbitId('user').optional().nullable(),
})

export const apiKeySelectSchema = createSelectSchema(apiKeys, {
  id: orbitId('apiKey'),
  organizationId: orbitId('organization'),
})
export const apiKeyInsertSchema = createInsertSchema(apiKeys, {
  organizationId: orbitId('organization'),
})
export const apiKeyUpdateSchema = createUpdateSchema(apiKeys, {
  organizationId: orbitId('organization').optional(),
})

export const companySelectSchema = createSelectSchema(companies, {
  id: orbitId('company'),
  organizationId: orbitId('organization'),
  assignedToUserId: orbitId('user').optional().nullable(),
  website: websiteSchema,
})
export const companyInsertSchema = createInsertSchema(companies, {
  organizationId: orbitId('organization'),
  assignedToUserId: orbitId('user').optional().nullable(),
  website: websiteSchema,
})
export const companyUpdateSchema = createUpdateSchema(companies, {
  organizationId: orbitId('organization').optional(),
  assignedToUserId: orbitId('user').optional().nullable(),
  website: websiteSchema,
})

export const contactSelectSchema = createSelectSchema(contacts, {
  id: orbitId('contact'),
  organizationId: orbitId('organization'),
  email: emailSchema,
  phone: phoneSchema,
  assignedToUserId: orbitId('user').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})
export const contactInsertSchema = createInsertSchema(contacts, {
  organizationId: orbitId('organization'),
  email: emailSchema,
  phone: phoneSchema,
  assignedToUserId: orbitId('user').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})
export const contactUpdateSchema = createUpdateSchema(contacts, {
  organizationId: orbitId('organization').optional(),
  email: emailSchema,
  phone: phoneSchema,
  assignedToUserId: orbitId('user').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})

export const pipelineSelectSchema = createSelectSchema(pipelines, {
  id: orbitId('pipeline'),
  organizationId: orbitId('organization'),
})
export const pipelineInsertSchema = createInsertSchema(pipelines, {
  organizationId: orbitId('organization'),
})
export const pipelineUpdateSchema = createUpdateSchema(pipelines, {
  organizationId: orbitId('organization').optional(),
})

export const stageSelectBaseSchema = createSelectSchema(stages, {
  id: orbitId('stage'),
  organizationId: orbitId('organization'),
  pipelineId: orbitId('pipeline'),
})
export const stageSelectSchema = stageSelectBaseSchema.superRefine((value, ctx) => {
  const stage = value as { isWon?: boolean; isLost?: boolean }

  if (stage.isWon && stage.isLost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stage cannot be both won and lost',
      path: ['isLost'],
    })
  }
})

export const stageInsertBaseSchema = createInsertSchema(stages, {
  organizationId: orbitId('organization'),
  pipelineId: orbitId('pipeline'),
})
export const stageInsertSchema = stageInsertBaseSchema.superRefine((value, ctx) => {
  const stage = value as { isWon?: boolean; isLost?: boolean }

  if (stage.isWon && stage.isLost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stage cannot be both won and lost',
      path: ['isLost'],
    })
  }
})

export const stageUpdateBaseSchema = createUpdateSchema(stages, {
  organizationId: orbitId('organization').optional(),
  pipelineId: orbitId('pipeline').optional(),
})
export const stageUpdateSchema = stageUpdateBaseSchema.superRefine((value, ctx) => {
  const stage = value as { isWon?: boolean; isLost?: boolean }

  if (stage.isWon && stage.isLost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stage cannot be both won and lost',
      path: ['isLost'],
    })
  }
})

export const dealSelectBaseSchema = createSelectSchema(deals, {
  id: orbitId('deal'),
  organizationId: orbitId('organization'),
  stageId: orbitId('stage').optional().nullable(),
  pipelineId: orbitId('pipeline').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
})
export const dealSelectSchema = dealSelectBaseSchema.superRefine((value, ctx) => {
  const deal = value as { wonAt?: Date | null; status?: string }

  if (deal.wonAt && deal.status !== undefined && deal.status !== 'won') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deal wonAt requires a won status in slice 2',
      path: ['wonAt'],
    })
  }
})

export const dealInsertBaseSchema = createInsertSchema(deals, {
  organizationId: orbitId('organization'),
  stageId: orbitId('stage').optional().nullable(),
  pipelineId: orbitId('pipeline').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
})
export const dealInsertSchema = dealInsertBaseSchema.superRefine((value, ctx) => {
  const deal = value as { wonAt?: Date | null; status?: string }

  if (deal.wonAt && deal.status !== undefined && deal.status !== 'won') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deal wonAt requires a won status in slice 2',
      path: ['wonAt'],
    })
  }
})

export const dealUpdateBaseSchema = createUpdateSchema(deals, {
  organizationId: orbitId('organization').optional(),
  stageId: orbitId('stage').optional().nullable(),
  pipelineId: orbitId('pipeline').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})
export const dealUpdateSchema = dealUpdateBaseSchema.superRefine((value, ctx) => {
  const deal = value as { wonAt?: Date | null; status?: string }

  if (deal.wonAt && deal.status !== undefined && deal.status !== 'won') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deal wonAt requires a won status in slice 2',
      path: ['wonAt'],
    })
  }
})

export const activitySelectSchema = createSelectSchema(activities, {
  id: orbitId('activity'),
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  loggedByUserId: orbitId('user').optional().nullable(),
})
export const activityInsertSchema = createInsertSchema(activities, {
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  loggedByUserId: orbitId('user').optional().nullable(),
})
export const activityUpdateSchema = createUpdateSchema(activities, {
  organizationId: orbitId('organization').optional(),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  loggedByUserId: orbitId('user').optional().nullable(),
})

export const taskSelectSchema = createSelectSchema(tasks, {
  id: orbitId('task'),
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
})
export const taskInsertSchema = createInsertSchema(tasks, {
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
})
export const taskUpdateSchema = createUpdateSchema(tasks, {
  organizationId: orbitId('organization').optional(),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
})

export const noteSelectSchema = createSelectSchema(notes, {
  id: orbitId('note'),
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  createdByUserId: orbitId('user').optional().nullable(),
})
export const noteInsertSchema = createInsertSchema(notes, {
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  createdByUserId: orbitId('user').optional().nullable(),
})
export const noteUpdateSchema = createUpdateSchema(notes, {
  organizationId: orbitId('organization').optional(),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  createdByUserId: orbitId('user').optional().nullable(),
})
