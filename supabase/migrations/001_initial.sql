-- =============================================================================
-- PAT (DailyBrief AI) · Initial Schema Migration
-- Tables:  users, briefing_slots, briefings, subscriptions, teams,
--          admin_audit_log  (PRD §5.1 – §5.6)
-- Extras:  enums, admin role, RLS policies, trigger, indexes
-- =============================================================================


-- =============================================================================
-- ENUMS
-- =============================================================================

-- PRD §2 / §5.1: subscription tier
create type user_tier as enum (
  'free',
  'pro',
  'power',
  'student',
  'team'
);

-- PRD §5.3: delivery status for email and push channels
create type delivery_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped'
);

-- PRD §5.3: SMS has an additional 'not_enabled' state
create type sms_delivery_status as enum (
  'pending',
  'sent',
  'failed',
  'skipped',
  'not_enabled'
);

-- PRD §5.4
create type subscription_provider as enum (
  'stripe',
  'paypal'
);

-- PRD §5.4
create type subscription_status as enum (
  'active',
  'past_due',
  'cancelled',
  'trialing'
);


-- =============================================================================
-- ADMIN ROLE  (PRD §11.1)
-- pat_admin has BYPASSRLS so it is exempt from all RLS policies below.
-- In practice, Next.js /admin/* routes reach the database through the
-- Supabase service-role client, which carries the same BYPASSRLS privilege.
-- Admin users are provisioned directly in the database — no app signup path.
-- =============================================================================

create role pat_admin bypassrls nologin;


-- =============================================================================
-- TABLE: teams  (PRD §5.5)
-- Defined before users because users.team_id references it.
-- =============================================================================

create table teams (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  owner_id   uuid        not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now()
);


-- =============================================================================
-- TABLE: users  (PRD §5.1)
-- One row per Supabase Auth user, created automatically by the trigger below.
-- google_access_token and google_refresh_token are AES-256 encrypted at the
-- application layer (lib/google/token.ts) before any INSERT or UPDATE.
-- They must never be returned to the client.
-- =============================================================================

create table users (
  id                   uuid        primary key references auth.users (id) on delete cascade,
  email                text        not null unique,
  name                 text        not null default '',
  tier                 user_tier   not null default 'free',
  team_id              uuid        references teams (id) on delete set null,

  -- IANA timezone string (e.g. 'America/New_York'). Never a UTC offset.
  timezone             text        not null default 'UTC'
                                   check (timezone in (select name from pg_timezone_names)),

  task_auto_write      boolean     not null default false,
  google_access_token  text,                              -- encrypted at rest
  google_refresh_token text,                              -- encrypted at rest
  google_token_expiry  timestamptz,
  gmail_send_scope     boolean     not null default false,
  stripe_customer_id   text,
  paypal_customer_id   text,
  is_banned            boolean     not null default false, -- admin-set
  ban_reason           text,                              -- admin-set
  created_at           timestamptz not null default now(),
  last_active_at       timestamptz not null default now() -- updated on login / briefing open
);


-- =============================================================================
-- TABLE: briefing_slots  (PRD §5.2)
-- Each row is a named scheduled briefing time for one user.
-- tier_position values: 1 = all tiers, 2 = Pro+, 3 = Power/Team.
-- unique(user_id, tier_position) enforces the per-tier slot cap.
-- When a user downgrades, extra slots are set enabled = false, not deleted.
-- =============================================================================

create table briefing_slots (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references users (id) on delete cascade,
  slot_name     text        not null,
  delivery_time time        not null,

  -- Copied from users.timezone at creation; can diverge if user later changes
  -- their timezone. Validated to be a known IANA timezone name.
  timezone      text        not null
                            check (timezone in (select name from pg_timezone_names)),

  enabled       boolean     not null default true,
  tier_position int         not null check (tier_position between 1 and 3),
  created_at    timestamptz not null default now(),

  unique (user_id, tier_position)
);


-- =============================================================================
-- TABLE: briefings  (PRD §5.3)
-- Stores only the AI/algorithm-generated summary.
-- Raw calendar event content is NEVER persisted here (PRD §12).
-- =============================================================================

create table briefings (
  id                    uuid                primary key default gen_random_uuid(),
  user_id               uuid                not null references users (id) on delete cascade,
  slot_id               uuid                not null references briefing_slots (id) on delete restrict,
  generated_at          timestamptz         not null default now(),

  -- algorithm = free-tier deterministic brief
  -- claude-sonnet is used for Power tier (PRD §2); not listed in §5.3 but
  -- required to represent all valid model values correctly.
  model_used            text                not null
                                            check (model_used in (
                                              'algorithm',
                                              'claude-haiku',
                                              'claude-sonnet',
                                              'gemini-flash'
                                            )),

  content_html          text                not null, -- full briefing HTML for in-app display
  content_text          text                not null, -- plain text for email / SMS
  greeting              text,                         -- the random greeting used
  events_count          int                 not null default 0,
  tasks_written         int                 not null default 0,
  delivery_email_status delivery_status     not null default 'pending',
  delivery_push_status  delivery_status     not null default 'pending',
  delivery_sms_status   sms_delivery_status not null default 'not_enabled',
  opened_at             timestamptz                   -- for re-engagement tracking
);


-- =============================================================================
-- TABLE: subscriptions  (PRD §5.4)
-- Written exclusively by Stripe / PayPal webhook handlers running as service
-- role. Never trust client-sent tier values (PRD §9.3).
-- =============================================================================

create table subscriptions (
  id                       uuid                  primary key default gen_random_uuid(),
  user_id                  uuid                  not null references users (id) on delete cascade,
  provider                 subscription_provider not null,
  provider_subscription_id text                  not null unique,
  plan                     text                  not null, -- e.g. pro_monthly | pro_annual | power_monthly
  status                   subscription_status   not null,
  current_period_end       timestamptz           not null,
  created_at               timestamptz           not null default now(),
  cancelled_at             timestamptz
);


-- =============================================================================
-- TABLE: admin_audit_log  (PRD §5.6)
-- Append-only. No authenticated-role UPDATE or DELETE policies exist.
-- Every admin mutation must write a row here before returning (PRD §14.2).
-- =============================================================================

create table admin_audit_log (
  id             uuid        primary key default gen_random_uuid(),
  admin_user_id  uuid        not null references users (id) on delete restrict,
  action         text        not null, -- e.g. tier_override | ban_user | impersonate
  target_user_id uuid        references users (id) on delete set null,
  details        jsonb       not null default '{}', -- before/after values or extra context
  created_at     timestamptz not null default now()
);


-- =============================================================================
-- TRIGGER: handle_new_user
-- Fires after every INSERT on auth.users (every new signup).
-- Creates the public.users profile row. Tier defaults to 'free'.
-- Timezone is taken from signup metadata when available; falls back to 'UTC'.
-- =============================================================================

create or replace function handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tz text;
begin
  -- Use the timezone passed in OAuth/signup metadata if it is a valid IANA name
  tz := coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC');
  if tz not in (select name from pg_timezone_names) then
    tz := 'UTC';
  end if;

  insert into public.users (id, email, name, timezone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    tz
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user ();


-- =============================================================================
-- ROW LEVEL SECURITY
--
-- Policy model:
--   authenticated role  →  users can only access their own rows
--   pat_admin / service_role  →  BYPASSRLS; no explicit policies needed
--
-- Tables where the client never writes directly (briefings, subscriptions,
-- admin_audit_log) have no INSERT/UPDATE/DELETE policies for authenticated.
-- Those writes are performed by the job engine or webhook handler via the
-- Supabase service-role client.
-- =============================================================================

alter table users            enable row level security;
alter table briefing_slots   enable row level security;
alter table briefings        enable row level security;
alter table subscriptions    enable row level security;
alter table teams            enable row level security;
alter table admin_audit_log  enable row level security;


-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------

create policy "users: select own row"
  on users
  for select
  to authenticated
  using (id = auth.uid());

-- Users may update their own row but may not elevate their own tier, unban
-- themselves, or modify admin-controlled fields. The WITH CHECK subquery
-- reads the current committed tier and asserts the new value is unchanged.
create policy "users: update own row"
  on users
  for update
  to authenticated
  using (id = auth.uid())
  with check (
    id        = auth.uid()
    and tier  = (select tier from users where id = auth.uid())
    and is_banned = false
  );


-- -----------------------------------------------------------------------------
-- briefing_slots
-- -----------------------------------------------------------------------------

create policy "slots: select own"
  on briefing_slots
  for select
  to authenticated
  using (user_id = auth.uid());

-- Tier slot-limit enforcement (max 1 / 2 / 3 slots per tier) is checked
-- server-side in lib/tier.ts before the INSERT reaches the database.
create policy "slots: insert own"
  on briefing_slots
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "slots: update own"
  on briefing_slots
  for update
  to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "slots: delete own"
  on briefing_slots
  for delete
  to authenticated
  using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- briefings  (read-only for authenticated; job engine writes via service role)
-- -----------------------------------------------------------------------------

create policy "briefings: select own"
  on briefings
  for select
  to authenticated
  using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- subscriptions  (read-only for authenticated; webhook handler writes via service role)
-- -----------------------------------------------------------------------------

create policy "subscriptions: select own"
  on subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- teams
-- -----------------------------------------------------------------------------

create policy "teams: select as owner or member"
  on teams
  for select
  to authenticated
  using (
    owner_id = auth.uid()
    or id = (select team_id from users where id = auth.uid())
  );

create policy "teams: insert as owner"
  on teams
  for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "teams: update as owner"
  on teams
  for update
  to authenticated
  using  (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- -----------------------------------------------------------------------------
-- admin_audit_log
-- No policies for the authenticated role.
-- Accessible only via pat_admin / service-role client (BYPASSRLS).
-- -----------------------------------------------------------------------------


-- =============================================================================
-- INDEXES
-- =============================================================================

-- Dashboard + briefing history: most frequent read query
create index idx_briefings_user_generated
  on briefings (user_id, generated_at desc);

-- Job engine: load all enabled slots for scheduling
create index idx_briefing_slots_enabled
  on briefing_slots (enabled, delivery_time)
  where enabled = true;

-- Slot lookup by owner
create index idx_briefing_slots_user
  on briefing_slots (user_id);

-- Admin: filter / count users by tier
create index idx_users_tier
  on users (tier);

-- Admin: surface banned accounts quickly
create index idx_users_banned
  on users (is_banned)
  where is_banned = true;

-- Webhook handler: match incoming Stripe / PayPal events
create index idx_subscriptions_provider_id
  on subscriptions (provider_subscription_id);

-- Admin user detail page: fetch audit log for a specific user
create index idx_audit_log_target_user
  on admin_audit_log (target_user_id, created_at desc);

-- Billing: look up Stripe / PayPal customer records
create index idx_users_stripe_customer
  on users (stripe_customer_id)
  where stripe_customer_id is not null;

create index idx_users_paypal_customer
  on users (paypal_customer_id)
  where paypal_customer_id is not null;

-- Delivery logs: find failed / pending briefings for re-trigger
create index idx_briefings_email_status
  on briefings (delivery_email_status)
  where delivery_email_status in ('failed', 'pending');

create index idx_briefings_push_status
  on briefings (delivery_push_status)
  where delivery_push_status in ('failed', 'pending');
