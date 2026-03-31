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

export async function initializeSqliteWave1Schema(db: OrbitDatabase): Promise<void> {
  for (const statement of SQLITE_WAVE_1_SCHEMA_STATEMENTS) {
    await db.execute(sql.raw(statement))
  }
}
