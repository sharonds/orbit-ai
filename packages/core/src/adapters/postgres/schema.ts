import { sql } from 'drizzle-orm'

import type { OrbitDatabase } from '../interface.js'

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

export async function initializePostgresWave1Schema(db: OrbitDatabase): Promise<void> {
  for (const statement of POSTGRES_WAVE_1_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}
