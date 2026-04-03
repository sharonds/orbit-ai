import { sql } from 'drizzle-orm'

import type { OrbitDatabase } from '../interface.js'
import { generatePostgresRlsSql } from '../../schema-engine/rls.js'

const POSTGRES_WAVE_1_SCHEMA_STATEMENTS = [
  `create table if not exists organizations (
    id text primary key,
    name text not null,
    slug text not null unique,
    plan text not null default 'community',
    is_active boolean not null default true,
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create table if not exists users (
    id text primary key,
    organization_id text not null references organizations(id),
    email text not null,
    name text not null,
    role text not null default 'viewer',
    avatar_url text,
    external_auth_id text,
    is_active boolean not null default true,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists users_org_email_idx on users (organization_id, email)`,
  `create index if not exists users_external_auth_idx on users (external_auth_id)`,
  `create table if not exists organization_memberships (
    id text primary key,
    organization_id text not null references organizations(id),
    user_id text not null references users(id),
    role text not null,
    invited_by_user_id text references users(id),
    joined_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists memberships_org_user_idx on organization_memberships (organization_id, user_id)`,
  `create table if not exists api_keys (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    key_hash text not null,
    key_prefix text not null,
    scopes jsonb not null default '[]'::jsonb,
    last_used_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_by_user_id text references users(id),
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists api_keys_hash_idx on api_keys (key_hash)`,
  `create unique index if not exists api_keys_prefix_idx on api_keys (key_prefix)`,
  `create table if not exists companies (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    domain text,
    industry text,
    size integer,
    website text,
    notes text,
    assigned_to_user_id text references users(id),
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists companies_org_domain_idx on companies (organization_id, domain)`,
  `create index if not exists companies_assigned_to_idx on companies (assigned_to_user_id)`,
  `create table if not exists contacts (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    email text,
    phone text,
    title text,
    source_channel text,
    status text not null default 'lead',
    assigned_to_user_id text references users(id),
    company_id text references companies(id),
    lead_score integer not null default 0,
    is_hot boolean not null default false,
    last_contacted_at timestamptz,
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists contacts_org_email_idx on contacts (organization_id, email)`,
  `create index if not exists contacts_company_idx on contacts (company_id)`,
  `create index if not exists contacts_assigned_to_idx on contacts (assigned_to_user_id)`,
  `create table if not exists pipelines (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    is_default boolean not null default false,
    description text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists pipelines_org_name_idx on pipelines (organization_id, name)`,
  `create table if not exists stages (
    id text primary key,
    organization_id text not null references organizations(id),
    pipeline_id text not null references pipelines(id),
    name text not null,
    stage_order integer not null,
    probability integer not null default 0,
    color text,
    is_won boolean not null default false,
    is_lost boolean not null default false,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists stages_pipeline_order_idx on stages (pipeline_id, stage_order)`,
  `create unique index if not exists stages_pipeline_name_idx on stages (pipeline_id, name)`,
  `create table if not exists deals (
    id text primary key,
    organization_id text not null references organizations(id),
    title text not null,
    value text,
    currency text not null default 'USD',
    stage_id text references stages(id),
    pipeline_id text references pipelines(id),
    probability integer not null default 0,
    expected_close_date timestamptz,
    contact_id text references contacts(id),
    company_id text references companies(id),
    assigned_to_user_id text references users(id),
    status text not null default 'open',
    won_at timestamptz,
    lost_at timestamptz,
    lost_reason text,
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists deals_stage_idx on deals (stage_id)`,
  `create index if not exists deals_pipeline_idx on deals (pipeline_id)`,
  `create index if not exists deals_contact_idx on deals (contact_id)`,
  `create index if not exists deals_company_idx on deals (company_id)`,
] as const

const POSTGRES_WAVE_2_SLICE_A_SCHEMA_STATEMENTS = [
  ...POSTGRES_WAVE_1_SCHEMA_STATEMENTS,
  `create table if not exists activities (
    id text primary key,
    organization_id text not null references organizations(id),
    type text not null,
    subject text,
    body text,
    direction text not null default 'internal',
    contact_id text references contacts(id),
    deal_id text references deals(id),
    company_id text references companies(id),
    duration_minutes integer,
    outcome text,
    occurred_at timestamptz not null,
    logged_by_user_id text references users(id),
    metadata jsonb not null default '{}'::jsonb,
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists activities_contact_idx on activities (contact_id)`,
  `create index if not exists activities_deal_idx on activities (deal_id)`,
  `create index if not exists activities_company_idx on activities (company_id)`,
  `create index if not exists activities_occurred_at_idx on activities (occurred_at)`,
  `create table if not exists tasks (
    id text primary key,
    organization_id text not null references organizations(id),
    title text not null,
    description text,
    due_date timestamptz,
    priority text not null default 'medium',
    is_completed boolean not null default false,
    completed_at timestamptz,
    contact_id text references contacts(id),
    deal_id text references deals(id),
    company_id text references companies(id),
    assigned_to_user_id text references users(id),
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists tasks_due_date_idx on tasks (due_date)`,
  `create index if not exists tasks_assigned_to_idx on tasks (assigned_to_user_id)`,
  `create table if not exists notes (
    id text primary key,
    organization_id text not null references organizations(id),
    content text not null,
    contact_id text references contacts(id),
    deal_id text references deals(id),
    company_id text references companies(id),
    created_by_user_id text references users(id),
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists notes_contact_idx on notes (contact_id)`,
  `create index if not exists notes_deal_idx on notes (deal_id)`,
] as const

const POSTGRES_WAVE_2_SLICE_B_SCHEMA_STATEMENTS = [
  ...POSTGRES_WAVE_2_SLICE_A_SCHEMA_STATEMENTS,
  `create table if not exists products (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    price text not null,
    currency text not null default 'USD',
    description text,
    is_active boolean not null default true,
    sort_order integer not null default 0,
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists products_sort_order_idx on products (sort_order)`,
  `create table if not exists payments (
    id text primary key,
    organization_id text not null references organizations(id),
    amount text not null,
    currency text not null default 'USD',
    status text not null,
    method text,
    deal_id text references deals(id),
    contact_id text references contacts(id),
    external_id text,
    paid_at timestamptz,
    metadata jsonb not null default '{}'::jsonb,
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists payments_external_id_idx on payments (organization_id, external_id)`,
  `create index if not exists payments_status_idx on payments (status)`,
  `create table if not exists contracts (
    id text primary key,
    organization_id text not null references organizations(id),
    title text not null,
    content text,
    status text not null default 'draft',
    signed_at timestamptz,
    expires_at timestamptz,
    deal_id text references deals(id),
    contact_id text references contacts(id),
    company_id text references companies(id),
    external_signature_id text,
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists contracts_status_idx on contracts (status)`,
] as const

const POSTGRES_WAVE_2_SLICE_C_SCHEMA_STATEMENTS = [
  ...POSTGRES_WAVE_2_SLICE_B_SCHEMA_STATEMENTS,
  `create table if not exists sequences (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    description text,
    trigger_event text,
    status text not null default 'draft',
    custom_fields jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
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
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists sequence_steps_order_idx on sequence_steps (sequence_id, step_order)`,
  `create table if not exists sequence_enrollments (
    id text primary key,
    organization_id text not null references organizations(id),
    sequence_id text not null references sequences(id),
    contact_id text not null references contacts(id),
    status text not null default 'active',
    current_step_order integer not null default 0,
    enrolled_at timestamptz not null,
    exited_at timestamptz,
    exit_reason text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists sequence_enrollments_active_idx on sequence_enrollments (sequence_id, contact_id, status)`,
  `create table if not exists sequence_events (
    id text primary key,
    organization_id text not null references organizations(id),
    sequence_enrollment_id text not null references sequence_enrollments(id),
    sequence_step_id text references sequence_steps(id),
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists sequence_events_enrollment_idx on sequence_events (sequence_enrollment_id)`,
] as const

const POSTGRES_WAVE_2_SLICE_D_SCHEMA_STATEMENTS = [
  ...POSTGRES_WAVE_2_SLICE_C_SCHEMA_STATEMENTS,
  `create table if not exists tags (
    id text primary key,
    organization_id text not null references organizations(id),
    name text not null,
    color text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists tags_org_name_idx on tags (organization_id, name)`,
  `create table if not exists entity_tags (
    id text primary key,
    organization_id text not null references organizations(id),
    tag_id text not null references tags(id),
    entity_type text not null,
    entity_id text not null,
    created_at timestamptz not null,
    updated_at timestamptz not null
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
    rollback_data jsonb not null default '{}'::jsonb,
    started_by_user_id text references users(id),
    completed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists imports_entity_type_idx on imports (entity_type)`,
  `create table if not exists webhooks (
    id text primary key,
    organization_id text not null references organizations(id),
    url text not null,
    description text,
    events jsonb not null default '[]'::jsonb,
    secret_encrypted text not null,
    secret_last_four text not null,
    secret_created_at timestamptz not null,
    status text not null default 'active',
    last_triggered_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists webhooks_status_idx on webhooks (status)`,
  `create table if not exists webhook_deliveries (
    id text primary key,
    organization_id text not null references organizations(id),
    webhook_id text not null references webhooks(id),
    event_id text not null,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    signature text not null,
    idempotency_key text not null,
    status text not null default 'pending',
    response_status integer,
    response_body text,
    attempt_count integer not null default 0,
    next_attempt_at timestamptz,
    delivered_at timestamptz,
    last_error text,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists webhook_deliveries_event_idx on webhook_deliveries (webhook_id, event_id)`,
  `create index if not exists webhook_deliveries_next_attempt_idx on webhook_deliveries (next_attempt_at)`,
] as const

const POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS = [
  ...POSTGRES_WAVE_2_SLICE_D_SCHEMA_STATEMENTS,
  `create table if not exists custom_field_definitions (
    id text primary key,
    organization_id text not null references organizations(id),
    entity_type text not null,
    field_name text not null,
    field_type text not null,
    label text not null,
    description text,
    is_required boolean not null default false,
    is_indexed boolean not null default false,
    is_promoted boolean not null default false,
    promoted_column_name text,
    default_value jsonb,
    options jsonb not null default '[]'::jsonb,
    validation jsonb not null default '{}'::jsonb,
    created_at timestamptz not null,
    updated_at timestamptz not null
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
    before jsonb,
    after jsonb,
    request_id text,
    metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default now(),
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists audit_logs_entity_idx on audit_logs (organization_id, entity_type, entity_id)`,
  `create index if not exists audit_logs_occurred_at_idx on audit_logs (occurred_at)`,
  `create table if not exists schema_migrations (
    id text primary key,
    organization_id text not null references organizations(id),
    description text not null,
    entity_type text,
    operation_type text not null,
    sql_statements jsonb not null default '[]'::jsonb,
    rollback_statements jsonb not null default '[]'::jsonb,
    applied_by_user_id text references users(id),
    approved_by_user_id text references users(id),
    applied_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create index if not exists schema_migrations_applied_at_idx on schema_migrations (applied_at)`,
  `create table if not exists idempotency_keys (
    id text primary key,
    organization_id text not null references organizations(id),
    key text not null,
    method text not null,
    path text not null,
    request_hash text not null,
    response_code integer,
    response_body jsonb,
    locked_until timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null,
    updated_at timestamptz not null
  )`,
  `create unique index if not exists idempotency_unique_idx on idempotency_keys (organization_id, key, method, path)`,
] as const

export async function initializePostgresWave2SliceESchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_E_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializePostgresWave1Schema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_1_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializePostgresWave2SliceASchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_A_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializePostgresWave2SliceBSchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_B_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializePostgresWave2SliceCSchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_C_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

export async function initializePostgresWave2SliceDSchema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_2_SLICE_D_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}

/**
 * Applies Row-Level Security DDL (policies + helper function) for all tenant
 * tables. Must be called AFTER table DDL has been executed (tables must exist
 * before policies can reference them).
 *
 * Idempotent: uses DROP POLICY IF EXISTS before CREATE POLICY, CREATE OR
 * REPLACE FUNCTION for the helper, and ALTER TABLE ENABLE ROW LEVEL SECURITY
 * is a no-op when already enabled.
 *
 * Should only be called from migration-authority paths (same privilege level as
 * the initializePostgresXxxSchema functions).
 */
export async function applyPostgresRlsDdl(db: OrbitDatabase): Promise<void> {
  for (const statement of generatePostgresRlsSql()) {
    await db.execute(sql.raw(statement))
  }
}
