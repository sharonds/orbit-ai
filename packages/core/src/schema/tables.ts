import { sql } from 'drizzle-orm'
import { boolean, customFieldsColumn, index, integer, jsonb, metadata, money, orbit, text, timestamp, timestamps, uniqueIndex } from './helpers.js'

export const organizations = orbit.table(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').notNull().default('community'),
    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [uniqueIndex('organizations_slug_idx').on(table.slug)],
)

export const users = orbit.table(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull().default('viewer'),
    avatarUrl: text('avatar_url'),
    externalAuthId: text('external_auth_id'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: metadata(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_org_email_idx').on(table.organizationId, table.email),
    index('users_external_auth_idx').on(table.externalAuthId),
  ],
)

export const organizationMemberships = orbit.table(
  'organization_memberships',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    userId: text('user_id').notNull().references(() => users.id),
    role: text('role').notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId)],
)

export const apiKeys = orbit.table(
  'api_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (table) => [uniqueIndex('api_keys_hash_idx').on(table.keyHash), uniqueIndex('api_keys_prefix_idx').on(table.keyPrefix)],
)

export const companies = orbit.table(
  'companies',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    domain: text('domain'),
    industry: text('industry'),
    size: integer('size'),
    website: text('website'),
    notes: text('notes'),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('companies_org_domain_idx').on(table.organizationId, table.domain),
    index('companies_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const contacts = orbit.table(
  'contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    sourceChannel: text('source_channel'),
    status: text('status').notNull().default('lead'),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    companyId: text('company_id').references(() => companies.id),
    leadScore: integer('lead_score').notNull().default(0),
    isHot: boolean('is_hot').notNull().default(false),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('contacts_org_email_idx').on(table.organizationId, table.email),
    index('contacts_company_idx').on(table.companyId),
    index('contacts_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const pipelines = orbit.table(
  'pipelines',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    description: text('description'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('pipelines_org_name_idx').on(table.organizationId, table.name),
    // At most one default pipeline per org. Partial unique index so
    // rows with `is_default = false` don't collide. The service layer
    // also demotes prior defaults transactionally (L8), but this DB
    // constraint is the multi-connection race-decider — the
    // application-level guard alone cannot prevent two concurrent
    // transactions from both writing their own default.
    uniqueIndex('pipelines_org_default_unique_idx')
      .on(table.organizationId)
      .where(sql`is_default = true`),
  ],
)

export const stages = orbit.table(
  'stages',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    pipelineId: text('pipeline_id').notNull().references(() => pipelines.id),
    name: text('name').notNull(),
    stageOrder: integer('stage_order').notNull(),
    probability: integer('probability').notNull().default(0),
    color: text('color'),
    isWon: boolean('is_won').notNull().default(false),
    isLost: boolean('is_lost').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('stages_pipeline_order_idx').on(table.pipelineId, table.stageOrder),
    uniqueIndex('stages_pipeline_name_idx').on(table.pipelineId, table.name),
  ],
)

export const deals = orbit.table(
  'deals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    value: money('value'),
    currency: text('currency').notNull().default('USD'),
    stageId: text('stage_id').references(() => stages.id),
    pipelineId: text('pipeline_id').references(() => pipelines.id),
    probability: integer('probability').notNull().default(0),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    contactId: text('contact_id').references(() => contacts.id),
    companyId: text('company_id').references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    status: text('status').notNull().default('open'),
    wonAt: timestamp('won_at', { withTimezone: true }),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    lostReason: text('lost_reason'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('deals_stage_idx').on(table.stageId),
    index('deals_pipeline_idx').on(table.pipelineId),
    index('deals_contact_idx').on(table.contactId),
    index('deals_company_idx').on(table.companyId),
  ],
)

export const activities = orbit.table(
  'activities',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    type: text('type').notNull(),
    subject: text('subject'),
    body: text('body'),
    direction: text('direction').notNull().default('internal'),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    durationMinutes: integer('duration_minutes'),
    outcome: text('outcome'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    loggedByUserId: text('logged_by_user_id').references(() => users.id),
    metadata: metadata(),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('activities_contact_idx').on(table.contactId),
    index('activities_deal_idx').on(table.dealId),
    index('activities_company_idx').on(table.companyId),
    index('activities_occurred_at_idx').on(table.occurredAt),
  ],
)

export const tasks = orbit.table(
  'tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    priority: text('priority').notNull().default('medium'),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('tasks_due_date_idx').on(table.dueDate),
    index('tasks_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const notes = orbit.table(
  'notes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    content: text('content').notNull(),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('notes_contact_idx').on(table.contactId),
    index('notes_deal_idx').on(table.dealId),
  ],
)

export const products = orbit.table(
  'products',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    price: money('price').notNull(),
    currency: text('currency').notNull().default('USD'),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [index('products_sort_order_idx').on(table.sortOrder)],
)

export const payments = orbit.table(
  'payments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    amount: money('amount').notNull(),
    currency: text('currency').notNull().default('USD'),
    status: text('status').notNull(),
    method: text('method'),
    dealId: text('deal_id').references(() => deals.id),
    contactId: text('contact_id').references(() => contacts.id),
    externalId: text('external_id'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    metadata: metadata(),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('payments_external_id_idx').on(table.organizationId, table.externalId),
    index('payments_status_idx').on(table.status),
  ],
)

export const contracts = orbit.table(
  'contracts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    content: text('content'),
    status: text('status').notNull().default('draft'),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    dealId: text('deal_id').references(() => deals.id),
    contactId: text('contact_id').references(() => contacts.id),
    companyId: text('company_id').references(() => companies.id),
    externalSignatureId: text('external_signature_id'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [index('contracts_status_idx').on(table.status)],
)

export const sequences = orbit.table(
  'sequences',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    description: text('description'),
    triggerEvent: text('trigger_event'),
    status: text('status').notNull().default('draft'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [uniqueIndex('sequences_org_name_idx').on(table.organizationId, table.name)],
)

export const sequenceSteps = orbit.table(
  'sequence_steps',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    sequenceId: text('sequence_id').notNull().references(() => sequences.id),
    stepOrder: integer('step_order').notNull(),
    actionType: text('action_type').notNull(),
    delayMinutes: integer('delay_minutes').notNull().default(0),
    templateSubject: text('template_subject'),
    templateBody: text('template_body'),
    taskTitle: text('task_title'),
    taskDescription: text('task_description'),
    metadata: metadata(),
    ...timestamps,
  },
  (table) => [uniqueIndex('sequence_steps_order_idx').on(table.sequenceId, table.stepOrder)],
)

export const sequenceEnrollments = orbit.table(
  'sequence_enrollments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    sequenceId: text('sequence_id').notNull().references(() => sequences.id),
    contactId: text('contact_id').notNull().references(() => contacts.id),
    status: text('status').notNull().default('active'),
    currentStepOrder: integer('current_step_order').notNull().default(0),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull(),
    exitedAt: timestamp('exited_at', { withTimezone: true }),
    exitReason: text('exit_reason'),
    ...timestamps,
  },
  (table) => [uniqueIndex('sequence_enrollments_active_idx').on(table.sequenceId, table.contactId, table.status)],
)

export const sequenceEvents = orbit.table(
  'sequence_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    sequenceEnrollmentId: text('sequence_enrollment_id').notNull().references(() => sequenceEnrollments.id),
    sequenceStepId: text('sequence_step_id').references(() => sequenceSteps.id),
    eventType: text('event_type').notNull(),
    payload: metadata(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index('sequence_events_enrollment_idx').on(table.sequenceEnrollmentId)],
)

export const tags = orbit.table(
  'tags',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    color: text('color'),
    ...timestamps,
  },
  (table) => [uniqueIndex('tags_org_name_idx').on(table.organizationId, table.name)],
)

export const entityTags = orbit.table(
  'entity_tags',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    tagId: text('tag_id').notNull().references(() => tags.id),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('entity_tags_unique_idx').on(table.organizationId, table.tagId, table.entityType, table.entityId),
    index('entity_tags_lookup_idx').on(table.organizationId, table.entityType, table.entityId),
  ],
)

export const imports = orbit.table(
  'imports',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    entityType: text('entity_type').notNull(),
    fileName: text('file_name').notNull(),
    totalRows: integer('total_rows').notNull().default(0),
    createdRows: integer('created_rows').notNull().default(0),
    updatedRows: integer('updated_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    status: text('status').notNull().default('pending'),
    rollbackData: jsonb('rollback_data').$type<Record<string, unknown>>().notNull().default({}),
    startedByUserId: text('started_by_user_id').references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('imports_entity_type_idx').on(table.entityType)],
)

export const webhooks = orbit.table(
  'webhooks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    url: text('url').notNull(),
    description: text('description'),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    secretEncrypted: text('secret_encrypted').notNull(),
    secretLastFour: text('secret_last_four').notNull(),
    secretCreatedAt: timestamp('secret_created_at', { withTimezone: true }).defaultNow().notNull(),
    status: text('status').notNull().default('active'),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index('webhooks_status_idx').on(table.status)],
)

export const webhookDeliveries = orbit.table(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    webhookId: text('webhook_id').notNull().references(() => webhooks.id),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: metadata(),
    signature: text('signature').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    status: text('status').notNull().default('pending'),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('webhook_deliveries_event_idx').on(table.webhookId, table.eventId),
    index('webhook_deliveries_next_attempt_idx').on(table.nextAttemptAt),
  ],
)

export const customFieldDefinitions = orbit.table(
  'custom_field_definitions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    entityType: text('entity_type').notNull(),
    fieldName: text('field_name').notNull(),
    fieldType: text('field_type').notNull(),
    label: text('label').notNull(),
    description: text('description'),
    isRequired: boolean('is_required').notNull().default(false),
    isIndexed: boolean('is_indexed').notNull().default(false),
    isPromoted: boolean('is_promoted').notNull().default(false),
    promotedColumnName: text('promoted_column_name'),
    defaultValue: jsonb('default_value').$type<unknown>(),
    options: jsonb('options').$type<string[]>().notNull().default([]),
    validation: jsonb('validation').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('custom_fields_unique_idx').on(table.organizationId, table.entityType, table.fieldName),
  ],
)

export const auditLogs = orbit.table(
  'audit_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    actorUserId: text('actor_user_id').references(() => users.id),
    actorApiKeyId: text('actor_api_key_id').references(() => apiKeys.id),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    requestId: text('request_id'),
    metadata: metadata(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps,
  },
  (table) => [
    index('audit_logs_entity_idx').on(table.organizationId, table.entityType, table.entityId),
    index('audit_logs_occurred_at_idx').on(table.occurredAt),
  ],
)

export const schemaMigrations = orbit.table(
  'schema_migrations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    checksum: text('checksum').notNull(),
    adapter: jsonb('adapter').$type<Record<string, unknown>>().notNull(),
    description: text('description').notNull(),
    entityType: text('entity_type'),
    operationType: text('operation_type').notNull(),
    forwardOperations: jsonb('forward_operations').$type<Record<string, unknown>[]>().notNull().default([]),
    reverseOperations: jsonb('reverse_operations').$type<Record<string, unknown>[]>().notNull().default([]),
    destructive: boolean('destructive').notNull().default(false),
    status: text('status').notNull().default('pending'),
    sqlStatements: jsonb('sql_statements').$type<string[]>().notNull().default([]),
    rollbackStatements: jsonb('rollback_statements').$type<string[]>().notNull().default([]),
    appliedBy: text('applied_by'),
    appliedByUserId: text('applied_by_user_id').references(() => users.id),
    approvedByUserId: text('approved_by_user_id').references(() => users.id),
    startedAt: timestamp('started_at', { withTimezone: true }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    rolledBackAt: timestamp('rolled_back_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    ...timestamps,
  },
  (table) => [
    index('schema_migrations_target_idx').on(table.organizationId, table.status, table.appliedAt),
    index('schema_migrations_applied_at_idx').on(table.appliedAt),
  ],
)

export const idempotencyKeys = orbit.table(
  'idempotency_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    key: text('key').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    requestHash: text('request_hash').notNull(),
    responseCode: integer('response_code'),
    responseBody: jsonb('response_body').$type<unknown>(),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('idempotency_unique_idx').on(table.organizationId, table.key, table.method, table.path),
  ],
)
