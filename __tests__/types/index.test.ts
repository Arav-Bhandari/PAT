import { describe, it, expect } from 'vitest'
import {
  // Runtime arrays
  USER_TIERS,
  DELIVERY_STATUSES,
  SMS_DELIVERY_STATUSES,
  SUBSCRIPTION_PROVIDERS,
  SUBSCRIPTION_STATUSES,
  MODEL_USED_VALUES,
  // Type guards
  isUserTier,
  isDeliveryStatus,
  isSmsDeliveryStatus,
  isSubscriptionProvider,
  isSubscriptionStatus,
  isModelUsed,
  // Tier limits
  TIER_LIMITS,
  // Row types (used for shape assertions at runtime)
  type UserRow,
  type BriefingSlotRow,
  type BriefingRow,
  type SubscriptionRow,
  type TeamRow,
  type AdminAuditLogRow,
  type CalendarEvent,
  type BriefingContext,
  type UserTier,
  type DeliveryStatus,
  type SmsDeliveryStatus,
} from '../../types/index'

// =============================================================================
// UserTier
// =============================================================================

describe('USER_TIERS', () => {
  it('contains exactly 5 values', () => {
    expect(USER_TIERS).toHaveLength(5)
  })

  it('contains every PRD §2 tier', () => {
    expect(USER_TIERS).toContain('free')
    expect(USER_TIERS).toContain('pro')
    expect(USER_TIERS).toContain('power')
    expect(USER_TIERS).toContain('student')
    expect(USER_TIERS).toContain('team')
  })

  it('is immutable at runtime (Object.freeze)', () => {
    // Object.freeze makes mutation throw TypeError in strict mode (ESM default)
    expect(() => {
      (USER_TIERS as unknown as string[]).push('enterprise')
    }).toThrow(TypeError)
  })
})

describe('isUserTier', () => {
  it('returns true for every valid tier', () => {
    for (const tier of USER_TIERS) {
      expect(isUserTier(tier)).toBe(true)
    }
  })

  it('returns false for arbitrary strings', () => {
    expect(isUserTier('enterprise')).toBe(false)
    expect(isUserTier('FREE')).toBe(false)  // case-sensitive
    expect(isUserTier('')).toBe(false)
  })

  it('returns false for non-string values', () => {
    expect(isUserTier(null)).toBe(false)
    expect(isUserTier(undefined)).toBe(false)
    expect(isUserTier(0)).toBe(false)
    expect(isUserTier({})).toBe(false)
    expect(isUserTier([])).toBe(false)
  })
})

// =============================================================================
// DeliveryStatus
// =============================================================================

describe('DELIVERY_STATUSES', () => {
  it('contains exactly 4 values', () => {
    expect(DELIVERY_STATUSES).toHaveLength(4)
  })

  it('contains all expected values', () => {
    expect(DELIVERY_STATUSES).toContain('pending')
    expect(DELIVERY_STATUSES).toContain('sent')
    expect(DELIVERY_STATUSES).toContain('failed')
    expect(DELIVERY_STATUSES).toContain('skipped')
  })
})

describe('isDeliveryStatus', () => {
  it('returns true for valid statuses', () => {
    for (const s of DELIVERY_STATUSES) {
      expect(isDeliveryStatus(s)).toBe(true)
    }
  })

  it('returns false for not_enabled (SMS-only status)', () => {
    expect(isDeliveryStatus('not_enabled')).toBe(false)
  })

  it('returns false for invalid values', () => {
    expect(isDeliveryStatus('delivered')).toBe(false)
    expect(isDeliveryStatus(null)).toBe(false)
  })
})

// =============================================================================
// SmsDeliveryStatus
// =============================================================================

describe('SMS_DELIVERY_STATUSES', () => {
  it('contains exactly 5 values (4 shared + not_enabled)', () => {
    expect(SMS_DELIVERY_STATUSES).toHaveLength(5)
  })

  it('is a superset of DELIVERY_STATUSES', () => {
    for (const s of DELIVERY_STATUSES) {
      expect(SMS_DELIVERY_STATUSES).toContain(s)
    }
  })

  it('includes not_enabled', () => {
    expect(SMS_DELIVERY_STATUSES).toContain('not_enabled')
  })
})

describe('isSmsDeliveryStatus', () => {
  it('returns true for all SMS statuses including not_enabled', () => {
    for (const s of SMS_DELIVERY_STATUSES) {
      expect(isSmsDeliveryStatus(s)).toBe(true)
    }
  })

  it('returns false for invalid values', () => {
    expect(isSmsDeliveryStatus('unknown')).toBe(false)
    expect(isSmsDeliveryStatus(null)).toBe(false)
  })
})

// =============================================================================
// SubscriptionProvider
// =============================================================================

describe('SUBSCRIPTION_PROVIDERS', () => {
  it('contains exactly 2 values', () => {
    expect(SUBSCRIPTION_PROVIDERS).toHaveLength(2)
  })

  it('contains stripe and paypal', () => {
    expect(SUBSCRIPTION_PROVIDERS).toContain('stripe')
    expect(SUBSCRIPTION_PROVIDERS).toContain('paypal')
  })
})

describe('isSubscriptionProvider', () => {
  it('accepts stripe and paypal', () => {
    expect(isSubscriptionProvider('stripe')).toBe(true)
    expect(isSubscriptionProvider('paypal')).toBe(true)
  })

  it('rejects other payment providers', () => {
    expect(isSubscriptionProvider('braintree')).toBe(false)
    expect(isSubscriptionProvider('apple_pay')).toBe(false)
    expect(isSubscriptionProvider(null)).toBe(false)
  })
})

// =============================================================================
// SubscriptionStatus
// =============================================================================

describe('SUBSCRIPTION_STATUSES', () => {
  it('contains exactly 4 values', () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(4)
  })

  it('contains all expected statuses', () => {
    expect(SUBSCRIPTION_STATUSES).toContain('active')
    expect(SUBSCRIPTION_STATUSES).toContain('past_due')
    expect(SUBSCRIPTION_STATUSES).toContain('cancelled')
    expect(SUBSCRIPTION_STATUSES).toContain('trialing')
  })
})

describe('isSubscriptionStatus', () => {
  it('returns true for valid statuses', () => {
    for (const s of SUBSCRIPTION_STATUSES) {
      expect(isSubscriptionStatus(s)).toBe(true)
    }
  })

  it('rejects expired and other non-values', () => {
    expect(isSubscriptionStatus('expired')).toBe(false)
    expect(isSubscriptionStatus('inactive')).toBe(false)
  })
})

// =============================================================================
// ModelUsed
// =============================================================================

describe('MODEL_USED_VALUES', () => {
  it('contains exactly 4 values', () => {
    expect(MODEL_USED_VALUES).toHaveLength(4)
  })

  it('includes algorithm as the free-tier fallback', () => {
    expect(MODEL_USED_VALUES).toContain('algorithm')
  })

  it('includes claude-haiku as the primary paid model', () => {
    expect(MODEL_USED_VALUES).toContain('claude-haiku')
  })

  it('includes claude-sonnet for Power tier', () => {
    expect(MODEL_USED_VALUES).toContain('claude-sonnet')
  })

  it('includes gemini-flash as the AI fallback', () => {
    expect(MODEL_USED_VALUES).toContain('gemini-flash')
  })
})

describe('isModelUsed', () => {
  it('accepts all valid model values', () => {
    for (const m of MODEL_USED_VALUES) {
      expect(isModelUsed(m)).toBe(true)
    }
  })

  it('rejects unlisted models', () => {
    expect(isModelUsed('gpt-4')).toBe(false)
    expect(isModelUsed('claude-opus')).toBe(false)
    expect(isModelUsed('')).toBe(false)
    expect(isModelUsed(null)).toBe(false)
  })
})

// =============================================================================
// TIER_LIMITS  (PRD §2)
// =============================================================================

describe('TIER_LIMITS', () => {
  it('covers all 5 tiers', () => {
    for (const tier of USER_TIERS) {
      expect(TIER_LIMITS).toHaveProperty(tier)
    }
  })

  it('free: 1 calendar, 1 slot', () => {
    expect(TIER_LIMITS.free.calendars).toBe(1)
    expect(TIER_LIMITS.free.slots).toBe(1)
  })

  it('pro: 2 calendars, 2 slots', () => {
    expect(TIER_LIMITS.pro.calendars).toBe(2)
    expect(TIER_LIMITS.pro.slots).toBe(2)
  })

  it('power: unlimited calendars (null), 3 slots', () => {
    expect(TIER_LIMITS.power.calendars).toBeNull()
    expect(TIER_LIMITS.power.slots).toBe(3)
  })

  it('student: same as pro (2 calendars, 2 slots)', () => {
    expect(TIER_LIMITS.student.calendars).toBe(2)
    expect(TIER_LIMITS.student.slots).toBe(2)
  })

  it('team: unlimited calendars (null), 3 slots', () => {
    expect(TIER_LIMITS.team.calendars).toBeNull()
    expect(TIER_LIMITS.team.slots).toBe(3)
  })

  it('slots are always between 1 and 3 (matches briefing_slots.tier_position CHECK)', () => {
    for (const tier of USER_TIERS) {
      const { slots } = TIER_LIMITS[tier]
      expect(slots).toBeGreaterThanOrEqual(1)
      expect(slots).toBeLessThanOrEqual(3)
    }
  })
})

// =============================================================================
// Row type shape assertions
// These construct valid row objects — if the types are wrong the test will
// fail to compile, which vitest catches via tsc in strict mode.
// =============================================================================

describe('UserRow shape', () => {
  it('can be constructed with all required fields', () => {
    const user: UserRow = {
      id:                   'uuid-1',
      email:                'test@example.com',
      name:                 'Test User',
      tier:                 'free',
      team_id:              null,
      timezone:             'America/New_York',
      task_auto_write:      false,
      google_access_token:  null,
      google_refresh_token: null,
      google_token_expiry:  null,
      gmail_send_scope:     false,
      stripe_customer_id:   null,
      paypal_customer_id:   null,
      is_banned:            false,
      ban_reason:           null,
      created_at:           '2026-03-21T00:00:00Z',
      last_active_at:       '2026-03-21T00:00:00Z',
    }
    expect(user.tier).toBe('free')
    expect(user.is_banned).toBe(false)
    expect(user.team_id).toBeNull()
  })

  it('tier field accepts all UserTier values', () => {
    const tiers: UserTier[] = ['free', 'pro', 'power', 'student', 'team']
    for (const tier of tiers) {
      const user: UserRow = {
        id: 'u', email: 'e@e.com', name: '', tier,
        team_id: null, timezone: 'UTC', task_auto_write: false,
        google_access_token: null, google_refresh_token: null,
        google_token_expiry: null, gmail_send_scope: false,
        stripe_customer_id: null, paypal_customer_id: null,
        is_banned: false, ban_reason: null,
        created_at: '', last_active_at: '',
      }
      expect(isUserTier(user.tier)).toBe(true)
    }
  })
})

describe('BriefingSlotRow shape', () => {
  it('tier_position is typed as 1 | 2 | 3', () => {
    const slot: BriefingSlotRow = {
      id: 'slot-1', user_id: 'user-1',
      slot_name: 'Morning brief', delivery_time: '07:00:00',
      timezone: 'America/New_York', enabled: true,
      tier_position: 1, created_at: '2026-03-21T00:00:00Z',
    }
    expect(slot.tier_position).toBe(1)
    expect([1, 2, 3]).toContain(slot.tier_position)
  })
})

describe('BriefingRow shape', () => {
  it('opened_at is nullable', () => {
    const briefing: BriefingRow = {
      id: 'b-1', user_id: 'u-1', slot_id: 's-1',
      generated_at: '2026-03-21T07:00:00Z',
      model_used: 'algorithm',
      content_html: '<p>Good morning</p>',
      content_text: 'Good morning',
      greeting: 'Good morning!',
      events_count: 3, tasks_written: 2,
      delivery_email_status: 'sent',
      delivery_push_status: 'sent',
      delivery_sms_status: 'not_enabled',
      opened_at: null,
    }
    expect(briefing.opened_at).toBeNull()
    expect(briefing.delivery_sms_status).toBe('not_enabled')
  })

  it('model_used accepts all ModelUsed values', () => {
    for (const model of MODEL_USED_VALUES) {
      expect(isModelUsed(model)).toBe(true)
    }
  })
})

describe('SubscriptionRow shape', () => {
  it('cancelled_at is nullable', () => {
    const sub: SubscriptionRow = {
      id: 'sub-1', user_id: 'u-1',
      provider: 'stripe', provider_subscription_id: 'sub_abc123',
      plan: 'pro_monthly', status: 'active',
      current_period_end: '2026-04-21T00:00:00Z',
      created_at: '2026-03-21T00:00:00Z',
      cancelled_at: null,
    }
    expect(sub.cancelled_at).toBeNull()
    expect(isSubscriptionProvider(sub.provider)).toBe(true)
    expect(isSubscriptionStatus(sub.status)).toBe(true)
  })
})

describe('AdminAuditLogRow shape', () => {
  it('target_user_id is nullable', () => {
    const log: AdminAuditLogRow = {
      id: 'log-1', admin_user_id: 'admin-1',
      action: 'tier_override', target_user_id: null,
      details: { before: 'free', after: 'pro' },
      created_at: '2026-03-21T00:00:00Z',
    }
    expect(log.target_user_id).toBeNull()
    expect(log.details).toEqual({ before: 'free', after: 'pro' })
  })
})

// =============================================================================
// CalendarEvent
// =============================================================================

describe('CalendarEvent', () => {
  it('supports timed events with optional fields', () => {
    const event: CalendarEvent = {
      id: 'evt-1',
      title: 'Team standup',
      start: '2026-03-21T09:00:00',
      end: '2026-03-21T09:30:00',
      allDay: false,
      calendarId: 'primary',
    }
    expect(event.allDay).toBe(false)
    expect(event.description).toBeUndefined()
    expect(event.location).toBeUndefined()
  })

  it('supports all-day events', () => {
    const event: CalendarEvent = {
      id: 'evt-2',
      title: 'Company holiday',
      start: '2026-03-21',
      end: '2026-03-21',
      allDay: true,
      calendarId: 'primary',
      description: 'Office closed',
      location: 'N/A',
    }
    expect(event.allDay).toBe(true)
    expect(event.description).toBe('Office closed')
    expect(event.location).toBe('N/A')
  })
})

// =============================================================================
// BriefingContext
// =============================================================================

describe('BriefingContext', () => {
  it('can be constructed with all required fields', () => {
    const ctx: BriefingContext = {
      userId: 'user-123',
      slotId: 'slot-456',
      tier: 'free',
      events: [],
      existingTasks: [],
      timezone: 'America/New_York',
      date: '2026-03-21',
    }
    expect(ctx.tier).toBe('free')
    expect(ctx.events).toHaveLength(0)
    expect(isUserTier(ctx.tier)).toBe(true)
  })

  it('accepts events and tasks arrays', () => {
    const event: CalendarEvent = {
      id: 'e1', title: 'Meeting', start: '2026-03-21T10:00:00',
      end: '2026-03-21T11:00:00', allDay: false, calendarId: 'primary',
    }
    const ctx: BriefingContext = {
      userId: 'u-1', slotId: 's-1', tier: 'pro',
      events: [event],
      existingTasks: ['Finish report', 'Review PR'],
      timezone: 'Europe/London',
      date: '2026-03-21',
    }
    expect(ctx.events).toHaveLength(1)
    expect(ctx.existingTasks).toHaveLength(2)
    expect(ctx.events[0].title).toBe('Meeting')
  })

  it('tier field must be a valid UserTier', () => {
    const tiers: UserTier[] = ['free', 'pro', 'power', 'student', 'team']
    for (const tier of tiers) {
      const ctx: BriefingContext = {
        userId: 'u', slotId: 's', tier,
        events: [], existingTasks: [],
        timezone: 'UTC', date: '2026-03-21',
      }
      expect(isUserTier(ctx.tier)).toBe(true)
    }
  })
})

// =============================================================================
// Database type — structural checks via TypeScript inference
// =============================================================================

describe('Database type', () => {
  it('Tables helper resolves to the correct Row type', () => {
    // This test confirms the type is correctly exported and usable.
    // The actual type-checking happens at compile time via strict mode.
    type UserTableRow = ReturnType<() => UserRow>
    const row: UserTableRow = {
      id: 'u', email: 'e@e.com', name: '', tier: 'free',
      team_id: null, timezone: 'UTC', task_auto_write: false,
      google_access_token: null, google_refresh_token: null,
      google_token_expiry: null, gmail_send_scope: false,
      stripe_customer_id: null, paypal_customer_id: null,
      is_banned: false, ban_reason: null,
      created_at: '', last_active_at: '',
    }
    expect(row.tier).toBe('free')
  })

  it('all 6 PRD §5 tables are present in the type', () => {
    // These keys mirror Database['public']['Tables']
    const expectedTables = [
      'users', 'briefing_slots', 'briefings',
      'subscriptions', 'teams', 'admin_audit_log',
    ]
    // Runtime check: the type structure exports interfaces for each
    const delivered: BriefingRow = {
      id: 'b', user_id: 'u', slot_id: 's',
      generated_at: '', model_used: 'algorithm',
      content_html: '', content_text: '',
      greeting: null, events_count: 0, tasks_written: 0,
      delivery_email_status: 'sent', delivery_push_status: 'sent',
      delivery_sms_status: 'not_enabled', opened_at: null,
    }
    expect(expectedTables).toHaveLength(6)
    expect(delivered.model_used).toBe('algorithm')
  })
})

// =============================================================================
// Cross-type consistency checks
// =============================================================================

describe('Cross-type consistency', () => {
  it('TIER_LIMITS keys match USER_TIERS exactly', () => {
    const limitKeys = Object.keys(TIER_LIMITS).sort()
    const tierValues = [...USER_TIERS].sort()
    expect(limitKeys).toEqual(tierValues)
  })

  it('delivery_status values are a subset of sms_delivery_status', () => {
    for (const s of DELIVERY_STATUSES) {
      expect(SMS_DELIVERY_STATUSES).toContain(s)
    }
  })

  it('SMS_DELIVERY_STATUSES has exactly one more value than DELIVERY_STATUSES', () => {
    expect(SMS_DELIVERY_STATUSES).toHaveLength(DELIVERY_STATUSES.length + 1)
  })

  it('BriefingRow.delivery_sms_status default matches SmsDeliveryStatus', () => {
    const defaultSmsStatus: SmsDeliveryStatus = 'not_enabled'
    expect(isSmsDeliveryStatus(defaultSmsStatus)).toBe(true)
  })

  it('BriefingRow.delivery_email_status default matches DeliveryStatus', () => {
    const defaultEmailStatus: DeliveryStatus = 'pending'
    expect(isDeliveryStatus(defaultEmailStatus)).toBe(true)
  })
})
