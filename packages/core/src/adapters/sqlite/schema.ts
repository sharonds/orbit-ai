import { sql } from 'drizzle-orm'

import type { OrbitDatabase } from '../interface.js'

const SQLITE_WAVE_1_SCHEMA_STATEMENTS = [
  `create table if not exists organizations (
    id text primary key,
    name text not null,
    slug text not null unique,
    plan text not null default 'community',
    is_active integer not null default 1,
    settings text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create table if not exists users (
    id text primary key,
    organization_id text not null,
    email text not null,
    name text not null,
    role text not null default 'viewer',
    avatar_url text,
    external_auth_id text,
    is_active integer not null default 1,
    metadata text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists users_org_email_idx on users (organization_id, email)`,
  `create table if not exists organization_memberships (
    id text primary key,
    organization_id text not null,
    user_id text not null,
    role text not null,
    invited_by_user_id text,
    joined_at text,
    created_at text not null,
    updated_at text not null
  )`,
  `create table if not exists api_keys (
    id text primary key,
    organization_id text not null,
    name text not null,
    key_hash text not null,
    key_prefix text not null,
    scopes text not null default '[]',
    last_used_at text,
    expires_at text,
    revoked_at text,
    created_by_user_id text,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists api_keys_hash_idx on api_keys (key_hash)`,
  `create unique index if not exists api_keys_prefix_idx on api_keys (key_prefix)`,
  `create table if not exists companies (
    id text primary key,
    organization_id text not null,
    name text not null,
    domain text,
    industry text,
    size integer,
    website text,
    notes text,
    assigned_to_user_id text,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create table if not exists contacts (
    id text primary key,
    organization_id text not null,
    name text not null,
    email text,
    phone text,
    title text,
    source_channel text,
    status text not null default 'lead',
    assigned_to_user_id text,
    company_id text,
    lead_score integer not null default 0,
    is_hot integer not null default 0,
    last_contacted_at text,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create table if not exists pipelines (
    id text primary key,
    organization_id text not null,
    name text not null,
    is_default integer not null default 0,
    description text,
    created_at text not null,
    updated_at text not null
  )`,
  // L8 partial unique index — SQLite stores booleans as integers so the
  // WHERE clause uses `is_default = 1` rather than `is_default = true`.
  `create unique index if not exists pipelines_org_default_unique_idx on pipelines (organization_id) where is_default = 1`,
  `create table if not exists stages (
    id text primary key,
    organization_id text not null,
    pipeline_id text not null,
    name text not null,
    stage_order integer not null,
    probability integer not null default 0,
    color text,
    is_won integer not null default 0,
    is_lost integer not null default 0,
    created_at text not null,
    updated_at text not null
  )`,
  `create table if not exists deals (
    id text primary key,
    organization_id text not null,
    title text not null,
    value text,
    currency text not null default 'USD',
    stage_id text,
    pipeline_id text,
    probability integer not null default 0,
    expected_close_date text,
    contact_id text,
    company_id text,
    assigned_to_user_id text,
    status text not null default 'open',
    won_at text,
    lost_at text,
    lost_reason text,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
] as const

const SQLITE_WAVE_2_SLICE_A_SCHEMA_STATEMENTS = [
  ...SQLITE_WAVE_1_SCHEMA_STATEMENTS,
  `create table if not exists activities (
    id text primary key,
    organization_id text not null,
    type text not null,
    subject text,
    body text,
    direction text not null default 'internal',
    contact_id text,
    deal_id text,
    company_id text,
    duration_minutes integer,
    outcome text,
    occurred_at text not null,
    logged_by_user_id text,
    metadata text not null default '{}',
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists activities_contact_idx on activities (contact_id)`,
  `create index if not exists activities_deal_idx on activities (deal_id)`,
  `create index if not exists activities_company_idx on activities (company_id)`,
  `create index if not exists activities_occurred_at_idx on activities (occurred_at)`,
  `create table if not exists tasks (
    id text primary key,
    organization_id text not null,
    title text not null,
    description text,
    due_date text,
    priority text not null default 'medium',
    is_completed integer not null default 0,
    completed_at text,
    contact_id text,
    deal_id text,
    company_id text,
    assigned_to_user_id text,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists tasks_due_date_idx on tasks (due_date)`,
  `create index if not exists tasks_assigned_to_idx on tasks (assigned_to_user_id)`,
  `create table if not exists notes (
    id text primary key,
    organization_id text not null,
    content text not null,
    contact_id text,
    deal_id text,
    company_id text,
    created_by_user_id text,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists notes_contact_idx on notes (contact_id)`,
  `create index if not exists notes_deal_idx on notes (deal_id)`,
] as const

const SQLITE_WAVE_2_SLICE_B_SCHEMA_STATEMENTS = [
  ...SQLITE_WAVE_2_SLICE_A_SCHEMA_STATEMENTS,
  `create table if not exists products (
    id text primary key,
    organization_id text not null,
    name text not null,
    price text not null,
    currency text not null default 'USD',
    description text,
    is_active integer not null default 1,
    sort_order integer not null default 0,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists products_sort_order_idx on products (sort_order)`,
  `create table if not exists payments (
    id text primary key,
    organization_id text not null,
    amount text not null,
    currency text not null default 'USD',
    status text not null,
    method text,
    deal_id text,
    contact_id text,
    external_id text,
    paid_at text,
    metadata text not null default '{}',
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists payments_external_id_idx on payments (organization_id, external_id)`,
  `create index if not exists payments_status_idx on payments (status)`,
  `create table if not exists contracts (
    id text primary key,
    organization_id text not null,
    title text not null,
    content text,
    status text not null default 'draft',
    signed_at text,
    expires_at text,
    deal_id text,
    contact_id text,
    company_id text,
    external_signature_id text,
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists contracts_status_idx on contracts (status)`,
] as const

const SQLITE_WAVE_2_SLICE_C_SCHEMA_STATEMENTS = [
  ...SQLITE_WAVE_2_SLICE_B_SCHEMA_STATEMENTS,
  `create table if not exists sequences (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    description text,
    trigger_event text,
    status text not null default 'draft',
    custom_fields text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists sequences_org_name_idx on sequences (organization_id, name)`,
  `create table if not exists sequence_steps (
    id text primary key,
    organization_id text not null references organizations(id),
    sequence_id text not null references sequences(id),
    step_order integer not null,
    action_type text not null,
    delay_minutes integer not null default 0,
    template_subject text,
    template_body text,
    task_title text,
    task_description text,
    metadata text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists sequence_steps_order_idx on sequence_steps (sequence_id, step_order)`,
  `create table if not exists sequence_enrollments (
    id text primary key,
    organization_id text not null references organizations(id),
    sequence_id text not null references sequences(id),
    contact_id text not null references contacts(id),
    status text not null default 'active',
    current_step_order integer not null default 0,
    enrolled_at text not null,
    exited_at text,
    exit_reason text,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists sequence_enrollments_active_idx on sequence_enrollments (sequence_id, contact_id, status)`,
  `create table if not exists sequence_events (
    id text primary key,
    organization_id text not null references organizations(id),
    sequence_enrollment_id text not null references sequence_enrollments(id),
    sequence_step_id text references sequence_steps(id),
    event_type text not null,
    payload text not null default '{}',
    occurred_at text not null,
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists sequence_events_enrollment_idx on sequence_events (sequence_enrollment_id)`,
] as const

const SQLITE_WAVE_2_SLICE_D_SCHEMA_STATEMENTS = [
  ...SQLITE_WAVE_2_SLICE_C_SCHEMA_STATEMENTS,
  `create table if not exists tags (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    color text,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists tags_org_name_idx on tags (organization_id, name)`,
  `create table if not exists entity_tags (
    id text primary key,
    organization_id text not null references organizations(id),
    tag_id text not null references tags(id),
    entity_type text not null,
    entity_id text not null,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists entity_tags_unique_idx on entity_tags (organization_id, tag_id, entity_type, entity_id)`,
  `create index if not exists entity_tags_lookup_idx on entity_tags (organization_id, entity_type, entity_id)`,
  `create table if not exists imports (
    id text primary key,
    organization_id text not null references organizations(id),
    entity_type text not null,
    file_name text not null,
    total_rows integer not null default 0,
    created_rows integer not null default 0,
    updated_rows integer not null default 0,
    skipped_rows integer not null default 0,
    failed_rows integer not null default 0,
    status text not null default 'pending',
    rollback_data text not null default '{}',
    started_by_user_id text references users(id),
    completed_at text,
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists imports_entity_type_idx on imports (entity_type)`,
  `create table if not exists webhooks (
    id text primary key,
    organization_id text not null references organizations(id),
    url text not null,
    description text,
    events text not null default '[]',
    secret_encrypted text not null,
    secret_last_four text not null,
    secret_created_at text not null,
    status text not null default 'active',
    last_triggered_at text,
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists webhooks_status_idx on webhooks (status)`,
  `create table if not exists webhook_deliveries (
    id text primary key,
    organization_id text not null references organizations(id),
    webhook_id text not null references webhooks(id),
    event_id text not null,
    event_type text not null,
    payload text not null default '{}',
    signature text not null,
    idempotency_key text not null,
    status text not null default 'pending',
    response_status integer,
    response_body text,
    attempt_count integer not null default 0,
    next_attempt_at text,
    delivered_at text,
    last_error text,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists webhook_deliveries_event_idx on webhook_deliveries (webhook_id, event_id)`,
  `create index if not exists webhook_deliveries_next_attempt_idx on webhook_deliveries (next_attempt_at)`,
] as const

const SQLITE_WAVE_2_SLICE_E_SCHEMA_STATEMENTS = [
  ...SQLITE_WAVE_2_SLICE_D_SCHEMA_STATEMENTS,
  `create table if not exists custom_field_definitions (
    id text primary key,
    organization_id text not null references organizations(id),
    entity_type text not null,
    field_name text not null,
    field_type text not null,
    label text not null,
    description text,
    is_required integer not null default 0,
    is_indexed integer not null default 0,
    is_promoted integer not null default 0,
    promoted_column_name text,
    default_value text,
    options text not null default '[]',
    validation text not null default '{}',
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists custom_fields_unique_idx on custom_field_definitions (organization_id, entity_type, field_name)`,
  `create table if not exists audit_logs (
    id text primary key,
    organization_id text not null references organizations(id),
    actor_user_id text references users(id),
    actor_api_key_id text references api_keys(id),
    entity_type text not null,
    entity_id text not null,
    action text not null,
    before text,
    after text,
    request_id text,
    metadata text not null default '{}',
    occurred_at text not null default (datetime('now')),
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists audit_logs_entity_idx on audit_logs (organization_id, entity_type, entity_id)`,
  `create index if not exists audit_logs_occurred_at_idx on audit_logs (occurred_at)`,
  `create table if not exists schema_migrations (
    id text primary key,
    organization_id text not null references organizations(id),
    checksum text not null,
    adapter text not null,
    description text not null,
    entity_type text,
    operation_type text not null,
    forward_operations text not null default '[]',
    reverse_operations text not null default '[]',
    destructive integer not null default 0,
    status text not null default 'pending',
    sql_statements text not null default '[]',
    rollback_statements text not null default '[]',
    applied_by text,
    applied_by_user_id text references users(id),
    approved_by_user_id text references users(id),
    started_at text,
    applied_at text,
    rolled_back_at text,
    failed_at text,
    error_code text,
    error_message text,
    created_at text not null,
    updated_at text not null
  )`,
  `create index if not exists schema_migrations_target_idx on schema_migrations (organization_id, status, applied_at)`,
  `create index if not exists schema_migrations_applied_at_idx on schema_migrations (applied_at)`,
  `create table if not exists idempotency_keys (
    id text primary key,
    organization_id text not null references organizations(id),
    key text not null,
    method text not null,
    path text not null,
    request_hash text not null,
    response_code integer,
    response_body text,
    locked_until text,
    completed_at text,
    created_at text not null,
    updated_at text not null
  )`,
  `create unique index if not exists idempotency_unique_idx on idempotency_keys (organization_id, key, method, path)`,
] as const

export async function initializeSqliteWave2SliceESchema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_2_SLICE_E_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializeSqliteWave1Schema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_1_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializeSqliteWave2SliceASchema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_2_SLICE_A_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializeSqliteWave2SliceBSchema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_2_SLICE_B_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializeSqliteWave2SliceCSchema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_2_SLICE_C_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializeSqliteWave2SliceDSchema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_2_SLICE_D_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

/**
 * Runs all Orbit schema init functions against an OrbitDatabase in the
 * correct order (wave 1 → wave 2 slices A-E). This is the default migration
 * implementation used by SqliteStorageAdapter when no custom `migrate` is
 * provided. Calling it repeatedly is safe because every init function uses
 * `create table if not exists`.
 */
export async function initializeAllSqliteSchemas(db: OrbitDatabase): Promise<void> {
  await initializeSqliteWave1Schema(db)
  await initializeSqliteWave2SliceASchema(db)
  await initializeSqliteWave2SliceBSchema(db)
  await initializeSqliteWave2SliceCSchema(db)
  await initializeSqliteWave2SliceDSchema(db)
  await initializeSqliteWave2SliceESchema(db)
}
