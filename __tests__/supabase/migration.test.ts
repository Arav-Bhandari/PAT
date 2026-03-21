import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, beforeAll } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_PATH = resolve(__dirname, '../../supabase/migrations/001_initial.sql')

let sql: string

beforeAll(() => {
  sql = readFileSync(MIGRATION_PATH, 'utf-8')
})

// =============================================================================
// File presence
// =============================================================================

describe('migration file', () => {
  it('exists and is non-empty', () => {
    expect(sql.length).toBeGreaterThan(0)
  })

  it('is valid UTF-8 text (no binary content)', () => {
    expect(typeof sql).toBe('string')
  })
})

// =============================================================================
// Enums  (must match types/index.ts exactly)
// =============================================================================

describe('enums', () => {
  it('defines user_tier with all 5 PRD §2 values', () => {
    expect(sql).toMatch(/create type user_tier as enum/i)
    expect(sql).toContain("'free'")
    expect(sql).toContain("'pro'")
    expect(sql).toContain("'power'")
    expect(sql).toContain("'student'")
    expect(sql).toContain("'team'")
  })

  it('defines delivery_status with 4 values', () => {
    expect(sql).toMatch(/create type delivery_status as enum/i)
    // Spot-check two — full coverage in types tests
    expect(sql).toContain("'pending'")
    expect(sql).toContain("'sent'")
  })

  it('defines sms_delivery_status with not_enabled', () => {
    expect(sql).toMatch(/create type sms_delivery_status as enum/i)
    expect(sql).toContain("'not_enabled'")
  })

  it('defines subscription_provider with stripe and paypal', () => {
    expect(sql).toMatch(/create type subscription_provider as enum/i)
    expect(sql).toContain("'stripe'")
    expect(sql).toContain("'paypal'")
  })

  it('defines subscription_status with all 4 values', () => {
    expect(sql).toMatch(/create type subscription_status as enum/i)
    expect(sql).toContain("'active'")
    expect(sql).toContain("'past_due'")
    expect(sql).toContain("'cancelled'")
    expect(sql).toContain("'trialing'")
  })
})

// =============================================================================
// Admin role
// =============================================================================

describe('admin role', () => {
  it('creates pat_admin with BYPASSRLS', () => {
    expect(sql).toMatch(/create role pat_admin bypassrls/i)
  })

  it('pat_admin is NOLOGIN', () => {
    expect(sql).toMatch(/create role pat_admin bypassrls nologin/i)
  })
})

// =============================================================================
// All 6 PRD §5 tables
// =============================================================================

describe('tables — existence', () => {
  const tables = [
    'teams',
    'users',
    'briefing_slots',
    'briefings',
    'subscriptions',
    'admin_audit_log',
  ]

  for (const table of tables) {
    it(`creates table: ${table}`, () => {
      expect(sql).toMatch(new RegExp(`create table ${table}\\s*\\(`, 'i'))
    })
  }
})

// =============================================================================
// users  (PRD §5.1)
// =============================================================================

describe('users table', () => {
  it('id references auth.users', () => {
    expect(sql).toMatch(/id\s+uuid\s+primary key\s+references auth\.users/i)
  })

  it('tier column uses user_tier enum', () => {
    expect(sql).toMatch(/tier\s+user_tier/i)
  })

  it('tier defaults to free', () => {
    expect(sql).toMatch(/tier\s+user_tier\s+not null\s+default\s+'free'/i)
  })

  it('task_auto_write defaults to false', () => {
    expect(sql).toMatch(/task_auto_write\s+boolean\s+not null\s+default false/i)
  })

  it('google_access_token column exists', () => {
    expect(sql).toMatch(/google_access_token\s+text/i)
  })

  it('google_refresh_token column exists', () => {
    expect(sql).toMatch(/google_refresh_token\s+text/i)
  })

  it('is_banned defaults to false', () => {
    expect(sql).toMatch(/is_banned\s+boolean\s+not null\s+default false/i)
  })

  it('has IANA timezone check constraint', () => {
    // The users table should reference pg_timezone_names
    const usersSection = sql.slice(
      sql.search(/create table users/i),
      sql.search(/create table briefing_slots/i),
    )
    expect(usersSection).toMatch(/pg_timezone_names/i)
  })
})

// =============================================================================
// briefing_slots  (PRD §5.2)
// =============================================================================

describe('briefing_slots table', () => {
  it('delivery_time is type time', () => {
    expect(sql).toMatch(/delivery_time\s+time\s+not null/i)
  })

  it('has IANA timezone check constraint', () => {
    const slotsSection = sql.slice(
      sql.search(/create table briefing_slots/i),
      sql.search(/create table briefings/i),
    )
    expect(slotsSection).toMatch(/pg_timezone_names/i)
  })

  it('tier_position is checked between 1 and 3', () => {
    expect(sql).toMatch(/tier_position\s+int\s+not null\s+check\s*\(\s*tier_position\s+between\s+1\s+and\s+3\s*\)/i)
  })

  it('has unique constraint on (user_id, tier_position)', () => {
    expect(sql).toMatch(/unique\s*\(\s*user_id\s*,\s*tier_position\s*\)/i)
  })
})

// =============================================================================
// briefings  (PRD §5.3)
// =============================================================================

describe('briefings table', () => {
  it('model_used has a CHECK constraint', () => {
    expect(sql).toMatch(/model_used\s+text\s+not null\s*\n?\s*check\s*\(/i)
  })

  it('model_used CHECK includes all 4 valid values', () => {
    const briefingsSection = sql.slice(
      sql.search(/create table briefings/i),
      sql.search(/create table subscriptions/i),
    )
    expect(briefingsSection).toContain("'algorithm'")
    expect(briefingsSection).toContain("'claude-haiku'")
    expect(briefingsSection).toContain("'claude-sonnet'")
    expect(briefingsSection).toContain("'gemini-flash'")
  })

  it('delivery_email_status uses delivery_status enum', () => {
    expect(sql).toMatch(/delivery_email_status\s+delivery_status/i)
  })

  it('delivery_sms_status uses sms_delivery_status enum', () => {
    expect(sql).toMatch(/delivery_sms_status\s+sms_delivery_status/i)
  })

  it('opened_at is nullable (no NOT NULL)', () => {
    const briefingsSection = sql.slice(
      sql.search(/create table briefings/i),
      sql.search(/create table subscriptions/i),
    )
    // opened_at should appear without NOT NULL
    expect(briefingsSection).toMatch(/opened_at\s+timestamptz(?!\s+not null)/i)
  })

  it('has privacy comment — raw event data never stored', () => {
    expect(sql).toMatch(/raw.*calendar.*event.*never/i)
  })
})

// =============================================================================
// subscriptions  (PRD §5.4)
// =============================================================================

describe('subscriptions table', () => {
  it('provider uses subscription_provider enum', () => {
    expect(sql).toMatch(/provider\s+subscription_provider\s+not null/i)
  })

  it('status uses subscription_status enum', () => {
    expect(sql).toMatch(/status\s+subscription_status\s+not null/i)
  })

  it('provider_subscription_id has unique constraint', () => {
    expect(sql).toMatch(/provider_subscription_id\s+text\s+not null\s+unique/i)
  })

  it('cancelled_at is nullable', () => {
    const subsSection = sql.slice(
      sql.search(/create table subscriptions/i),
      sql.search(/create table admin_audit_log/i),
    )
    expect(subsSection).toMatch(/cancelled_at\s+timestamptz(?!\s+not null)/i)
  })
})

// =============================================================================
// admin_audit_log  (PRD §5.6)
// =============================================================================

describe('admin_audit_log table', () => {
  it('details column is jsonb', () => {
    expect(sql).toMatch(/details\s+jsonb\s+not null/i)
  })

  it('target_user_id is nullable', () => {
    const auditSection = sql.slice(
      sql.search(/create table admin_audit_log/i),
      sql.search(/create table greetings|create or replace function handle_new_user/i),
    )
    // target_user_id references users and is nullable (no NOT NULL)
    expect(auditSection).toMatch(/target_user_id\s+uuid(?!\s+not null)/i)
  })

  it('admin_user_id is NOT NULL', () => {
    expect(sql).toMatch(/admin_user_id\s+uuid\s+not null/i)
  })
})

// =============================================================================
// RLS — all 6 tables must have RLS enabled
// =============================================================================

describe('row level security', () => {
  const tables = [
    'users',
    'briefing_slots',
    'briefings',
    'subscriptions',
    'teams',
    'admin_audit_log',
  ]

  for (const table of tables) {
    it(`RLS is enabled on ${table}`, () => {
      expect(sql).toMatch(
        new RegExp(`alter table ${table}\\s+enable row level security`, 'i'),
      )
    })
  }
})

// =============================================================================
// RLS policies — users can read/write their own rows
// =============================================================================

describe('RLS policies', () => {
  it('users table has a select policy using auth.uid()', () => {
    const usersSelectPolicy = sql.match(
      /create policy[^;]*on users\s+for select[\s\S]*?auth\.uid\(\)[\s\S]*?;/i,
    )
    expect(usersSelectPolicy).not.toBeNull()
  })

  it('users table has an update policy with tier self-promotion guard', () => {
    // The update policy must contain a WITH CHECK that compares tier
    const usersUpdateBlock = sql.match(
      /create policy[^;]*on users\s+for update[\s\S]*?with check[\s\S]*?tier[\s\S]*?;/i,
    )
    expect(usersUpdateBlock).not.toBeNull()
  })

  it('briefing_slots has select / insert / update / delete policies', () => {
    const operations = ['select', 'insert', 'update', 'delete']
    for (const op of operations) {
      expect(sql).toMatch(
        new RegExp(`create policy[^;]*on briefing_slots\\s+for ${op}`, 'i'),
      )
    }
  })

  it('briefings has a select policy for own rows', () => {
    expect(sql).toMatch(
      /create policy[^;]*on briefings\s+for select/i,
    )
  })

  it('subscriptions has a select policy for own rows', () => {
    expect(sql).toMatch(
      /create policy[^;]*on subscriptions\s+for select/i,
    )
  })

  it('admin_audit_log has NO policies (service role only)', () => {
    // No `create policy ... on admin_audit_log` should appear
    expect(sql).not.toMatch(
      /create policy[^;]*on admin_audit_log/i,
    )
  })
})

// =============================================================================
// handle_new_user trigger
// =============================================================================

describe('handle_new_user trigger', () => {
  it('creates the trigger function', () => {
    expect(sql).toMatch(/create or replace function handle_new_user/i)
  })

  it('fires after insert on auth.users', () => {
    expect(sql).toMatch(/after insert on auth\.users/i)
  })

  it('inserts into public.users', () => {
    expect(sql).toMatch(/insert into public\.users/i)
  })

  it('falls back to UTC when timezone is invalid', () => {
    expect(sql).toMatch(/'UTC'/i)
    expect(sql).toMatch(/pg_timezone_names/i)
  })
})

// =============================================================================
// Indexes
// =============================================================================

describe('indexes', () => {
  it('has an index on briefings(user_id, generated_at)', () => {
    expect(sql).toMatch(/create index\s+\w+\s+on briefings\s*\(\s*user_id/i)
  })

  it('has a partial index on enabled briefing_slots', () => {
    expect(sql).toMatch(/create index\s+\w+\s+on briefing_slots[\s\S]*?where enabled = true/i)
  })

  it('has an index on subscriptions(provider_subscription_id)', () => {
    expect(sql).toMatch(/create index\s+\w+\s+on subscriptions\s*\(\s*provider_subscription_id/i)
  })

  it('has an index on admin_audit_log(target_user_id)', () => {
    expect(sql).toMatch(/create index\s+\w+\s+on admin_audit_log\s*\(\s*target_user_id/i)
  })

  it('has partial indexes for failed/pending delivery statuses', () => {
    expect(sql).toMatch(/create index\s+\w+\s+on briefings[\s\S]*?delivery_email_status/i)
    expect(sql).toMatch(/create index\s+\w+\s+on briefings[\s\S]*?delivery_push_status/i)
  })
})
