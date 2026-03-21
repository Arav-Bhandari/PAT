// =============================================================================
// PAT (DailyBrief AI) — Shared TypeScript Types
// Derives DB row types from the Supabase schema (PRD §5).
// All type names mirror the Postgres table/column names exactly.
// =============================================================================


// =============================================================================
// SECTION 1: Postgres Enum Types
// Values must match the SQL enum definitions in 001_initial.sql exactly.
// =============================================================================

/** Maps to the `user_tier` Postgres enum. */
export type UserTier = 'free' | 'pro' | 'power' | 'student' | 'team'

/** Maps to the `delivery_status` Postgres enum (email + push channels). */
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped'

/** Maps to the `sms_delivery_status` Postgres enum. */
export type SmsDeliveryStatus = 'pending' | 'sent' | 'failed' | 'skipped' | 'not_enabled'

/** Maps to the `subscription_provider` Postgres enum. */
export type SubscriptionProvider = 'stripe' | 'paypal'

/** Maps to the `subscription_status` Postgres enum. */
export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing'

/**
 * Valid values for briefings.model_used.
 * 'claude-sonnet' is used for Power tier (PRD §2) even though §5.3 only
 * lists three values — it is present in the SQL CHECK constraint.
 */
export type ModelUsed = 'algorithm' | 'claude-haiku' | 'claude-sonnet' | 'gemini-flash'


// =============================================================================
// SECTION 2: Runtime enum arrays + type guards
// These enable runtime validation (e.g. in webhook handlers, job engine).
// =============================================================================

export const USER_TIERS: readonly UserTier[] = Object.freeze(['free', 'pro', 'power', 'student', 'team'])
export const DELIVERY_STATUSES: readonly DeliveryStatus[] = Object.freeze(['pending', 'sent', 'failed', 'skipped'])
export const SMS_DELIVERY_STATUSES: readonly SmsDeliveryStatus[] = Object.freeze(['pending', 'sent', 'failed', 'skipped', 'not_enabled'])
export const SUBSCRIPTION_PROVIDERS: readonly SubscriptionProvider[] = Object.freeze(['stripe', 'paypal'])
export const SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = Object.freeze(['active', 'past_due', 'cancelled', 'trialing'])
export const MODEL_USED_VALUES: readonly ModelUsed[] = Object.freeze(['algorithm', 'claude-haiku', 'claude-sonnet', 'gemini-flash'])

export function isUserTier(value: unknown): value is UserTier {
  return USER_TIERS.includes(value as UserTier)
}

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return DELIVERY_STATUSES.includes(value as DeliveryStatus)
}

export function isSmsDeliveryStatus(value: unknown): value is SmsDeliveryStatus {
  return SMS_DELIVERY_STATUSES.includes(value as SmsDeliveryStatus)
}

export function isSubscriptionProvider(value: unknown): value is SubscriptionProvider {
  return SUBSCRIPTION_PROVIDERS.includes(value as SubscriptionProvider)
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
}

export function isModelUsed(value: unknown): value is ModelUsed {
  return MODEL_USED_VALUES.includes(value as ModelUsed)
}


// =============================================================================
// SECTION 3: Tier limits (PRD §2)
// Server-side enforcement in lib/tier.ts reads from this object.
// 'calendars: null' means unlimited.
// =============================================================================

export const TIER_LIMITS = {
  free:    { calendars: 1,    slots: 1 },
  pro:     { calendars: 2,    slots: 2 },
  power:   { calendars: null, slots: 3 },
  student: { calendars: 2,    slots: 2 },
  team:    { calendars: null, slots: 3 },
} as const satisfies Record<UserTier, { calendars: number | null; slots: number }>


// =============================================================================
// SECTION 4: Database Row Types  (PRD §5)
// Structured in Supabase's generated-types format so these can be passed
// directly to createClient<Database>().
//
// Nullable columns: typed as `Type | null`
// Insert:  columns with DB defaults are optional; required columns are required
// Update:  all columns are optional (Supabase partial-update semantics)
// =============================================================================

// ---------------------------------------------------------------------------
// §5.5 teams
// ---------------------------------------------------------------------------

export interface TeamRow {
  id:         string
  name:       string
  owner_id:   string
  created_at: string
}

export interface TeamInsert {
  id?:        string        // default gen_random_uuid()
  name:       string
  owner_id:   string
  created_at?: string       // default now()
}

export interface TeamUpdate {
  id?:        string
  name?:      string
  owner_id?:  string
  created_at?: string
}

// ---------------------------------------------------------------------------
// §5.1 users
// ---------------------------------------------------------------------------

export interface UserRow {
  id:                   string
  email:                string
  name:                 string
  tier:                 UserTier
  team_id:              string | null
  timezone:             string
  task_auto_write:      boolean
  /** AES-256 encrypted at application layer. Never return to client. */
  google_access_token:  string | null
  /** AES-256 encrypted at application layer. Never return to client. */
  google_refresh_token: string | null
  google_token_expiry:  string | null
  gmail_send_scope:     boolean
  stripe_customer_id:   string | null
  paypal_customer_id:   string | null
  is_banned:            boolean
  ban_reason:           string | null
  created_at:           string
  last_active_at:       string
}

export interface UserInsert {
  /** Must match auth.users(id). Typically set by the handle_new_user trigger. */
  id:                    string
  email:                 string
  name?:                 string        // default ''
  tier?:                 UserTier      // default 'free'
  team_id?:              string | null
  timezone?:             string        // default 'UTC'
  task_auto_write?:      boolean       // default false
  google_access_token?:  string | null
  google_refresh_token?: string | null
  google_token_expiry?:  string | null
  gmail_send_scope?:     boolean       // default false
  stripe_customer_id?:   string | null
  paypal_customer_id?:   string | null
  is_banned?:            boolean       // default false
  ban_reason?:           string | null
  created_at?:           string        // default now()
  last_active_at?:       string        // default now()
}

export interface UserUpdate {
  id?:                   string
  email?:                string
  name?:                 string
  tier?:                 UserTier
  team_id?:              string | null
  timezone?:             string
  task_auto_write?:      boolean
  google_access_token?:  string | null
  google_refresh_token?: string | null
  google_token_expiry?:  string | null
  gmail_send_scope?:     boolean
  stripe_customer_id?:   string | null
  paypal_customer_id?:   string | null
  is_banned?:            boolean
  ban_reason?:           string | null
  created_at?:           string
  last_active_at?:       string
}

// ---------------------------------------------------------------------------
// §5.2 briefing_slots
// ---------------------------------------------------------------------------

export interface BriefingSlotRow {
  id:            string
  user_id:       string
  slot_name:     string
  /** User's local time as HH:MM:SS string (Postgres `time` type). */
  delivery_time: string
  /** IANA timezone string, e.g. 'America/New_York'. */
  timezone:      string
  enabled:       boolean
  /** 1 = Morning (all tiers), 2 = Midday (Pro+), 3 = Evening (Power/Team). */
  tier_position: 1 | 2 | 3
  created_at:    string
}

export interface BriefingSlotInsert {
  id?:           string         // default gen_random_uuid()
  user_id:       string
  slot_name:     string
  delivery_time: string
  timezone:      string
  enabled?:      boolean        // default true
  tier_position: 1 | 2 | 3
  created_at?:   string         // default now()
}

export interface BriefingSlotUpdate {
  id?:           string
  user_id?:      string
  slot_name?:    string
  delivery_time?: string
  timezone?:     string
  enabled?:      boolean
  tier_position?: 1 | 2 | 3
  created_at?:   string
}

// ---------------------------------------------------------------------------
// §5.3 briefings
// ---------------------------------------------------------------------------

export interface BriefingRow {
  id:                    string
  user_id:               string
  slot_id:               string
  generated_at:          string
  model_used:            ModelUsed
  /** Full briefing HTML for in-app display. No raw event data. */
  content_html:          string
  /** Plain text for email / SMS. */
  content_text:          string
  greeting:              string | null
  events_count:          number
  tasks_written:         number
  delivery_email_status: DeliveryStatus
  delivery_push_status:  DeliveryStatus
  delivery_sms_status:   SmsDeliveryStatus
  /** Set when the user opens the briefing. */
  opened_at:             string | null
}

export interface BriefingInsert {
  id?:                    string          // default gen_random_uuid()
  user_id:                string
  slot_id:                string
  generated_at?:          string          // default now()
  model_used:             ModelUsed
  content_html:           string
  content_text:           string
  greeting?:              string | null
  events_count?:          number          // default 0
  tasks_written?:         number          // default 0
  delivery_email_status?: DeliveryStatus  // default 'pending'
  delivery_push_status?:  DeliveryStatus  // default 'pending'
  delivery_sms_status?:   SmsDeliveryStatus // default 'not_enabled'
  opened_at?:             string | null
}

export interface BriefingUpdate {
  id?:                    string
  user_id?:               string
  slot_id?:               string
  generated_at?:          string
  model_used?:            ModelUsed
  content_html?:          string
  content_text?:          string
  greeting?:              string | null
  events_count?:          number
  tasks_written?:         number
  delivery_email_status?: DeliveryStatus
  delivery_push_status?:  DeliveryStatus
  delivery_sms_status?:   SmsDeliveryStatus
  opened_at?:             string | null
}

// ---------------------------------------------------------------------------
// §5.4 subscriptions
// ---------------------------------------------------------------------------

export interface SubscriptionRow {
  id:                       string
  user_id:                  string
  provider:                 SubscriptionProvider
  /** Stripe sub_xxx or PayPal equivalent. */
  provider_subscription_id: string
  /** e.g. 'pro_monthly' | 'pro_annual' | 'power_monthly' | 'power_annual' */
  plan:                     string
  status:                   SubscriptionStatus
  current_period_end:       string
  created_at:               string
  cancelled_at:             string | null
}

export interface SubscriptionInsert {
  id?:                       string    // default gen_random_uuid()
  user_id:                   string
  provider:                  SubscriptionProvider
  provider_subscription_id:  string
  plan:                      string
  status:                    SubscriptionStatus
  current_period_end:        string
  created_at?:               string   // default now()
  cancelled_at?:             string | null
}

export interface SubscriptionUpdate {
  id?:                       string
  user_id?:                  string
  provider?:                 SubscriptionProvider
  provider_subscription_id?: string
  plan?:                     string
  status?:                   SubscriptionStatus
  current_period_end?:       string
  created_at?:               string
  cancelled_at?:             string | null
}

// ---------------------------------------------------------------------------
// §5.6 admin_audit_log
// ---------------------------------------------------------------------------

export interface AdminAuditLogRow {
  id:             string
  admin_user_id:  string
  /** e.g. 'tier_override' | 'ban_user' | 'unban_user' | 'impersonate' */
  action:         string
  target_user_id: string | null
  /** Before/after values or extra context. */
  details:        Record<string, unknown>
  created_at:     string
}

export interface AdminAuditLogInsert {
  id?:             string    // default gen_random_uuid()
  admin_user_id:   string
  action:          string
  target_user_id?: string | null
  details?:        Record<string, unknown>  // default {}
  created_at?:     string    // default now()
}

// No Update type — admin_audit_log is append-only (no UPDATE policies exist).


// =============================================================================
// SECTION 5: Supabase Database type
// Pass this to createClient<Database>() in lib/supabase/*.ts.
// =============================================================================

export interface Database {
  public: {
    Tables: {
      teams: {
        Row:    TeamRow
        Insert: TeamInsert
        Update: TeamUpdate
      }
      users: {
        Row:    UserRow
        Insert: UserInsert
        Update: UserUpdate
      }
      briefing_slots: {
        Row:    BriefingSlotRow
        Insert: BriefingSlotInsert
        Update: BriefingSlotUpdate
      }
      briefings: {
        Row:    BriefingRow
        Insert: BriefingInsert
        Update: BriefingUpdate
      }
      subscriptions: {
        Row:    SubscriptionRow
        Insert: SubscriptionInsert
        Update: SubscriptionUpdate
      }
      admin_audit_log: {
        Row:    AdminAuditLogRow
        Insert: AdminAuditLogInsert
        Update: never  // append-only
      }
    }
    Enums: {
      user_tier:             UserTier
      delivery_status:       DeliveryStatus
      sms_delivery_status:   SmsDeliveryStatus
      subscription_provider: SubscriptionProvider
      subscription_status:   SubscriptionStatus
    }
    Views:          Record<string, never>
    Functions:      Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience helpers — mirrors Supabase's own generated helper types.
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type DbEnum<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]


// =============================================================================
// SECTION 6: Application-layer types
// These are never stored in the database — they are transient context objects
// used by the briefing engine and Google API layer.
// =============================================================================

/**
 * A single event fetched from Google Calendar API.
 * Raw event data is NEVER persisted to the database (PRD §12).
 */
export interface CalendarEvent {
  /** Google Calendar event ID. */
  id:           string
  title:        string
  /** ISO 8601 datetime string (or date string for all-day events). */
  start:        string
  /** ISO 8601 datetime string (or date string for all-day events). */
  end:          string
  description?: string
  location?:    string
  allDay:       boolean
  /** The calendar this event belongs to (e.g. 'primary'). */
  calendarId:   string
}

/**
 * The context object assembled by the job engine and passed to
 * generateBrief(context, tier) in lib/briefing/engine.ts.
 * Token budget: ~1,000 input tokens (PRD §7.5).
 */
export interface BriefingContext {
  userId:        string
  slotId:        string
  tier:          UserTier
  /** Events for the next 24 hours, fetched from Google Calendar API. */
  events:        CalendarEvent[]
  /** Titles of existing Google Tasks — for context only, not persisted. */
  existingTasks: string[]
  /** IANA timezone string of the user. */
  timezone:      string
  /** The date being briefed, in YYYY-MM-DD format. */
  date:          string
}
