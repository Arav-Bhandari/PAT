**PAT (DailyBrief AI)**

Product Requirements & Architecture Document

Version 1.0 · March 2026 · Confidential

> *This document is the single source of truth for PAT. When starting a
> Claude Code session, instruct Claude to read this file in full before
> writing any code. Reference it with \@PRD.md throughout development.*

**1. Product Overview**

PAT is an AI-powered calendar briefing and task management SaaS. It
connects to a user's Google Calendar (and later Microsoft Outlook) via
OAuth, runs a scheduled analysis of upcoming events and deadlines, and
delivers a personalised daily briefing via email, in-app notification,
and/or browser push. It also writes a prioritised to-do list directly to
Google Tasks.

Core positioning: PAT sits on top of a user's existing calendar rather
than replacing it. It is the simplest, most affordable AI morning
co-pilot available.

  -----------------------------------------------------------------------
  **Key product principles**

  • Never replace the user's existing calendar --- augment it

  • Privacy-first: no raw calendar event content stored beyond what is
  needed for history

  • Graceful degradation: if AI is unavailable, the algorithm brief still
  delivers value

  • Mobile-ready from day one at the architecture level, even though
  launch is web-only

  • Tier limits enforced server-side, never just client-side

  -----------------------------------------------------------------------

**2. Tier Structure**

  ------------------------------------------------------------------------------------------------------
  **Plan**   **Price**      **Calendars**   **Briefings/day**   **AI model**   **Email       **Tasks**
                                                                               delivery**
  ---------- -------------- --------------- ------------------- -------------- ------------- -----------
  Free       \$0            1 (Google)      1                   Algorithm only Via user's    Google
                                                                               own Gmail     Tasks
                                                                               (OAuth)

  Pro        \$12/mo or     2               2                   Claude Haiku   From PAT      Google
             \$96/yr                                            (Gemini        domain        Tasks
                                                                fallback)      (Resend)

  Power      \$20/mo or     Unlimited       3                   Claude         From PAT      Google
             \$160/yr                                           Haiku/Sonnet   domain        Tasks
                                                                (Gemini        (Resend)
                                                                fallback)

  Student    \$5/mo or      2               2                   Claude Haiku   From PAT      Google
             \$40/yr                                            (Gemini        domain        Tasks
                                                                fallback)      (Resend)

  Team       \$10/user/mo   Unlimited       3                   Claude         From PAT      Google
                                                                Haiku/Sonnet   domain        Tasks +
                                                                               (Resend)      shared
  ------------------------------------------------------------------------------------------------------

**Briefing slots**

Each tier's briefing slots are user-named and user-timed. Defaults are
pre-filled but fully editable:

- Slot 1 default: "Morning brief" at 7:00 AM

- Slot 2 default (Pro+): "Midday check-in" at 12:00 PM

- Slot 3 default (Power/Team): "Evening wrap-up" at 5:00 PM

> *Tier limits are enforced in the database and job engine. A user who
> downgrades has their extra slots disabled (not deleted) so they can
> re-enable on upgrade.*

**3. Architecture Overview**

PAT is structured in six layers. Each layer is independently
upgradeable.

  -------------------------------------------------------------------------
  **Layer**   **Responsibility**       **Technology**
  ----------- ------------------------ ------------------------------------
  Client      Web UI, landing page,    Next.js 14+ (App Router) + Tailwind
              dashboard, settings,     CSS
              billing

  API         Auth, user preferences,  Next.js API routes (Edge-compatible)
              payments, briefing
              history

  Job engine  Per-user scheduled       Trigger.dev
              briefings, retries,
              fallback chain

  Delivery    Email, push              Resend + Web Push API + Twilio
              notifications, in-app    (later)
              bell, SMS (Phase 3)

  Data        Users, prefs, briefing   Supabase (Postgres + Auth) + Upstash
              history, subscriptions,  Redis
              tokens

  Infra       Hosting, CI/CD, error    Vercel + GitHub Actions + Sentry
              tracking
  -------------------------------------------------------------------------

**Mobile expansion path**

The web app is built with React (Next.js). When a mobile app is added
(Phase 2--3), React Native shares all business logic, hooks, and API
calls. The Next.js API layer becomes the shared backend for both
surfaces. No architectural changes are required --- only a new React
Native project consuming the same API.

**4. Tech Stack (Definitive)**

  ------------------------------------------------------------------------
  **Component**    **Technology**              **Upgrade path**
  ---------------- --------------------------- ---------------------------
  Frontend         Next.js 14+ App Router +    React Native for mobile
                   Tailwind CSS                (shares logic)

  Auth             NextAuth.js + Supabase Auth Add Microsoft/Apple OAuth
                                               in Phase 2

  Database         Supabase (Postgres)         Supabase Pro → dedicated DB
                                               on scale

  Cache / rate     Upstash Redis               Upgrade Upstash tier
  limit

  Job queue        Trigger.dev                 Self-hosted Trigger.dev on
                                               scale

  AI --- primary   Claude Haiku 4.5 (Anthropic Promote to Sonnet for Power
                   API)                        tier requests

  AI --- fallback  Gemini Flash (Google AI     Swap model version as
  1                API)                        needed

  AI --- fallback  Algorithm (no AI)           Always available, no
  2                                            external dependency

  Calendar APIs    Google Calendar API +       Both free, OAuth 2.0
                   Microsoft Graph API (Phase
                   2)

  Task writing     Google Tasks API            Add Microsoft To Do in
                                               Phase 2

  Email --- free   Gmail API send-as (user's   Fallback to in-app only if
  tier             own OAuth token)            scope denied

  Email --- paid   Resend (from PAT domain)    Upgrade Resend plan
  tiers

  Push             Web Push API (browser) +    Firebase Cloud Messaging
  notifications    in-app bell                 for mobile

  SMS (Phase 3)    Twilio (primary) + Vonage   Paid-tier only, per-message
                   (fallback)                  cost

  Payments ---     Stripe (card form + Apple   Stripe plan upgrade
  card             Pay/Google Pay via Payment
                   Request API)

  Payments ---     PayPal SDK (redirect flow)  Add Braintree for more
  PayPal                                       options

  Admin backend    Next.js admin routes +      Dedicated admin app if
                   Supabase RLS admin role     needed

  Hosting          Vercel                      Railway or Fly.io when
                                               Vercel limits hit

  CI/CD            GitHub Actions              ---

  Error tracking   Sentry                      ---

  Analytics        PostHog (self-hostable,     Upgrade plan
                   privacy-friendly)
  ------------------------------------------------------------------------

**5. Data Model**

**5.1 users**

  ----------------------------------------------------------------------------
  **Field**              **Type**      **Notes**
  ---------------------- ------------- ---------------------------------------
  id                     uuid PK       Supabase Auth user ID

  email                  text unique

  name                   text          Display name

  tier                   enum          free \| pro \| power \| student \| team

  team_id                uuid FK       For team plan members
                         nullable

  timezone               text          e.g. America/New_York --- auto-detected
                                       at signup

  task_auto_write        boolean       Default false --- user toggles in
                                       settings

  google_access_token    text          Encrypted at rest
                         encrypted

  google_refresh_token   text          Encrypted at rest
                         encrypted

  google_token_expiry    timestamptz   For proactive refresh

  gmail_send_scope       boolean       Whether Gmail send permission was
                                       granted

  stripe_customer_id     text nullable

  paypal_customer_id     text nullable

  is_banned              boolean       Admin-set

  ban_reason             text nullable Admin-set

  created_at             timestamptz

  last_active_at         timestamptz   Updated on login / briefing open
  ----------------------------------------------------------------------------

**5.2 briefing_slots**

  ------------------------------------------------------------------------
  **Field**          **Type**      **Notes**
  ------------------ ------------- ---------------------------------------
  id                 uuid PK

  user_id            uuid FK

  slot_name          text          User-editable, e.g. "Morning brief"

  delivery_time      time          User's local time

  timezone           text          Copied from user at creation, can
                                   diverge

  enabled            boolean       Pause without deleting

  tier_position      int           1, 2, or 3 --- enforces tier slot
                                   limits

  created_at         timestamptz
  ------------------------------------------------------------------------

**5.3 briefings**

  --------------------------------------------------------------------------
  **Field**               **Type**      **Notes**
  ----------------------- ------------- ------------------------------------
  id                      uuid PK

  user_id                 uuid FK

  slot_id                 uuid FK       Which slot triggered this

  generated_at            timestamptz

  model_used              text          claude-haiku \| gemini-flash \|
                                        algorithm

  content_html            text          Full briefing HTML for in-app
                                        display

  content_text            text          Plain text version for email / SMS

  greeting                text          The random greeting used

  events_count            int           Number of events included

  tasks_written           int           Number of tasks written to Google
                                        Tasks

  delivery_email_status   enum          pending \| sent \| failed \| skipped

  delivery_push_status    enum          pending \| sent \| failed \| skipped

  delivery_sms_status     enum          pending \| sent \| failed \| skipped
                                        \| not_enabled

  opened_at               timestamptz   For re-engagement tracking
                          nullable
  --------------------------------------------------------------------------

**5.4 subscriptions**

  -----------------------------------------------------------------------------
  **Field**                  **Type**      **Notes**
  -------------------------- ------------- ------------------------------------
  id                         uuid PK

  user_id                    uuid FK

  provider                   enum          stripe \| paypal

  provider_subscription_id   text          External ID from Stripe or PayPal

  plan                       text          pro_monthly \| pro_annual \|
                                           power_monthly \| etc.

  status                     enum          active \| past_due \| cancelled \|
                                           trialing

  current_period_end         timestamptz

  created_at                 timestamptz

  cancelled_at               timestamptz
                             nullable
  -----------------------------------------------------------------------------

**5.5 teams**

  ------------------------------------------------------------------------
  **Field**          **Type**      **Notes**
  ------------------ ------------- ---------------------------------------
  id                 uuid PK

  name               text

  owner_id           uuid FK       User who created the team

  created_at         timestamptz
  ------------------------------------------------------------------------

**5.6 admin_audit_log**

  ------------------------------------------------------------------------
  **Field**          **Type**      **Notes**
  ------------------ ------------- ---------------------------------------
  id                 uuid PK

  admin_user_id      uuid FK

  action             text          e.g. tier_override, ban_user,
                                   impersonate

  target_user_id     uuid FK
                     nullable

  details            jsonb         Before/after values or extra context

  created_at         timestamptz
  ------------------------------------------------------------------------

**6. Authentication**

Auth is handled by NextAuth.js backed by Supabase Auth. Launch
providers:

- Email + password (Supabase Auth, bcrypt hashed)

- Continue with Google (OAuth 2.0)

Microsoft and Apple Sign In are deferred to Phase 2.

**Google OAuth scopes**

At signup with Google, request the following scopes:

- openid, email, profile --- standard identity

- https://www.googleapis.com/auth/calendar.readonly --- read calendar
  events

- https://www.googleapis.com/auth/tasks --- write to Google Tasks

The Gmail send scope (https://www.googleapis.com/auth/gmail.send) is
deferred --- a decision on when to request it (at signup vs. lazily) is
pending. Until resolved, free-tier email delivery falls back to in-app
notification only if the scope is not present.

**Token handling**

OAuth tokens are encrypted at rest in Supabase using AES-256. A
background Trigger.dev job proactively refreshes Google tokens 10
minutes before expiry. If a refresh fails, the affected user's next
briefing job falls back gracefully and sends a re-authorisation prompt
via in-app notification.

> *This is the most common silent failure in calendar apps. Token
> refresh must be built and tested before any other feature.*

**7. Briefing Engine**

**7.1 Job trigger**

Each briefing slot creates a Trigger.dev scheduled job. When a user
updates their slot time or timezone, the job is rescheduled. The job
stores the user's IANA timezone and converts to UTC for scheduling.
Trigger.dev handles retries (3 attempts, exponential backoff).

**7.2 Execution flow**

For each job run:

- 1\. Fetch user record and verify tier + slot is enabled

- 2\. Refresh OAuth token if within 10 minutes of expiry

- 3\. Fetch calendar events for the next 24 hours via Google Calendar
  API

- 4\. Check user tier to determine AI availability

- 5\. Generate briefing (see AI chain below)

- 6\. Write tasks to Google Tasks (if auto-write enabled, or queue for
  confirmation)

- 7\. Store briefing record in the briefings table

- 8\. Deliver via all enabled channels (email, push, in-app)

- 9\. Update delivery status fields on the briefing record

**7.3 AI fallback chain**

  -----------------------------------------------------------------------
  **AI model priority**

  • 1. Claude Haiku 4.5 --- primary for all paid tiers

  • 2. Gemini Flash --- fallback if Claude API returns an error or
  timeout (\>10s)

  • 3. Algorithm brief --- final fallback for all tiers, always available

  -----------------------------------------------------------------------

The AI layer is abstracted behind a single generateBrief(context, tier)
function. Swapping models requires changing one config value.

**7.4 Free tier algorithm**

When AI is unavailable or the user is on the free tier, the algorithm
brief runs:

- Select a random greeting from a hardcoded list of 20--30 options
  (stored in the database, editable via admin)

- Fetch today's events from Google Calendar

- Sort events by start time, then flag any with due dates by deadline
  proximity

- Detect conflicts: any two events whose time ranges overlap are flagged
  with a warning

- Output: greeting + sorted event list + conflict warnings + task list

> *The greeting list is managed via the admin backend. Admins can add,
> edit, or remove greetings without a code deployment.*

**7.5 Prompt structure (paid tiers)**

Approximate token budget per briefing: \~1,000 input + \~400 output =
\~1,400 tokens total.

- System prompt (\~200 tokens): briefing format instructions, tone,
  output structure

- Calendar events (\~500 tokens): today's events, titles, times,
  descriptions

- Task backlog (\~300 tokens): existing Google Tasks for context

Anthropic prompt caching is used on the system prompt to reduce costs by
up to 90% on repeated calls.

**8. Delivery Layer**

  ----------------------------------------------------------------------------------
  **Channel**   **Free tier**   **Paid tiers**          **Technology**   **Phase**
  ------------- --------------- ----------------------- ---------------- -----------
  Email         Via user's own  From PAT domain         Gmail API /      1
                Gmail (OAuth    (brief@dailybrief.ai)   Resend
                send-as)

  In-app bell   Yes             Yes                     Supabase         1
                                                        real-time +
                                                        notification
                                                        feed

  Browser push  Yes             Yes                     Web Push API     1
                                                        (VAPID)

  SMS / text    No              Paid-tier only (opt-in) Twilio           3
                                                        (primary),
                                                        Vonage
                                                        (fallback)

  Mobile push   No              Yes                     Firebase Cloud   2--3
                                                        Messaging
  ----------------------------------------------------------------------------------

**SMS expansion (Phase 3)**

SMS delivery uses Twilio as the primary provider with Vonage as a hot
fallback. Both are abstracted behind a sendSms(userId, message)
function. SMS is opt-in, available on Pro+ tiers only, and costs are
passed through to the user as part of their plan (not billed per-message
to them). Twilio's free tier is sufficient for testing; a paid Twilio
account is needed for production.

**9. Payments**

**9.1 Providers**

  --------------------------------------------------------------------------
  **Provider**   **Use case**           **Integration**
  -------------- ---------------------- ------------------------------------
  Stripe         Credit/debit card,     Stripe Elements (card form) +
                 Apple Pay, Google Pay  Payment Request API for wallets

  PayPal         PayPal balance and     PayPal JS SDK, redirect flow
                 linked accounts
  --------------------------------------------------------------------------

**9.2 Checkout form fields**

The standard checkout form collects the following, rendered via Stripe
Elements (PCI-compliant, card data never touches PAT servers):

- Full name

- Email address

- Billing address (line 1, line 2, city, state/province, postal code,
  country)

- Card number

- Expiry date (MM/YY)

- CVV / security code

- Apple Pay / Google Pay buttons rendered above the form when the
  browser supports them

- PayPal button as a secondary option below the form

**9.3 Subscription lifecycle**

Stripe and PayPal both send webhook events. A Trigger.dev webhook
handler:

- On payment success: updates the subscriptions table, sets user tier,
  enables briefing slots

- On payment failure / past_due: sends user an in-app notification, does
  not immediately downgrade

- On cancellation: schedules downgrade to free at period end, disables
  extra slots

- On refund: immediately downgrades tier

> *All billing state lives in Supabase. Stripe/PayPal are the source of
> truth for payment events only. Never trust client-sent tier claims.*

**10. User-Facing Pages & Flows**

  -----------------------------------------------------------------------
  **Page / flow**     **Description**
  ------------------- ---------------------------------------------------
  Landing page        Marketing page: hero, features, pricing table,
                      testimonials, CTA. Static (Next.js SSG).

  Sign up             Email+password form or Continue with Google. Google
                      OAuth requests Calendar + Tasks scopes immediately.

  Log in              Email+password or Continue with Google.

  Dashboard           Today's briefing, past briefing history, task
                      summary, quick settings.

  Settings ---        Add/rename/reschedule slots up to tier limit.
  briefing slots      Toggle auto-write for tasks.

  Settings ---        Toggle email, push, SMS (if enabled). Manage Gmail
  notifications       send scope.

  Settings ---        Name, email, timezone, delete account.
  account

  Billing             Current plan, next billing date, upgrade/downgrade,
                      payment method, invoices.

  Checkout            Standard billing form (see Section 9.2). Stripe
                      Elements + PayPal.

  Briefing history    Paginated list of past briefings. Click to read
                      full brief. Filter by slot.

  Onboarding flow     3 steps post-signup: connect calendar → set
                      briefing time → preview first brief.
  -----------------------------------------------------------------------

**11. Admin Backend**

**11.1 Access control**

Admin routes live at /admin/\* and are protected by a Supabase Row Level
Security role (admin). Admin users are created directly in the database
--- there is no self-serve admin signup. All admin actions are logged to
the admin_audit_log table.

**11.2 Admin capabilities**

  -----------------------------------------------------------------------
  **Section**         **Capabilities**
  ------------------- ---------------------------------------------------
  User management     Search/filter all users, view profile, edit
                      name/email, view tier and subscription status

  Tier overrides      Manually set a user's tier (overrides subscription
                      state), with mandatory reason note

  Account moderation  Flag account (warning), ban account with reason,
                      unban account

  Impersonation       Log in as any user for debugging/support (all
                      impersonation sessions logged to audit log)

  Revenue dashboard   MRR, ARR, active subscribers by tier, churn rate,
                      new signups, trial conversions

  Delivery logs       View briefing delivery status per user, filter by
                      failed/pending, re-trigger a delivery

  Greeting management Add, edit, delete entries in the greeting list used
                      by the free tier algorithm

  Subscription        View all subscriptions, cancel on behalf of user,
  management          apply manual credit/refund via Stripe API
  -----------------------------------------------------------------------

**11.3 Admin tech**

The admin backend is built as a protected section of the same Next.js
app (/admin/\*). It uses:

- Supabase RLS admin role --- admin API routes bypass standard
  user-level RLS

- Server-side rendering only --- no admin data is sent to the client
  until auth is confirmed

- Every mutation route requires a second Supabase session check (no
  relying solely on middleware)

- All destructive actions (ban, tier override, impersonate) require a
  confirmation step in the UI

**12. Privacy & Compliance**

- Calendar event content is fetched at briefing time, summarised, and
  stored only as the generated briefing HTML/text in the briefings
  table. Raw event data is never persisted.

- OAuth tokens are encrypted at rest using AES-256 via Supabase Vault.

- Users can delete their account and all associated data from Settings
  --- Account. This triggers a Trigger.dev job that: deletes all
  briefing records, revokes Google OAuth tokens, deletes all Supabase
  rows, and cancels any active Stripe/PayPal subscriptions.

- GDPR data export: users can request a JSON export of all their stored
  data (briefing history, preferences, slot config). Available from
  Settings --- Account.

- SOC 2 Type II compliance is a Phase 3 goal.

**13. Build Phases**

  -------------------------------------------------------------------------
  **Phase**   **Timeline**   **Scope**
  ----------- -------------- ----------------------------------------------
  Phase 1:    Months 1--4    Landing page, email+password + Google auth,
  MVP                        free tier algorithm brief, Google Calendar +
                             Tasks, Stripe checkout, in-app + push
                             notifications, admin backend, briefing history

  Phase 2:    Months 5--12   Microsoft Outlook + Apple auth, paid AI tiers
  Growth                     (Claude + Gemini fallback), Pro and Power
                             plans, PayPal, mobile app (React Native),
                             referral program, SEO content engine

  Phase 3:    Months 13--24  Team plan + shared briefings, SMS delivery
  Scale                      (Twilio), Notion/Slack integrations, weekly AI
                             review (Power tier), international timezone
                             edge cases, SOC 2, Apple/Google Pay
                             refinements

  Phase 4:    Months 25--36  Enterprise features, Zapier/API marketplace,
  Expansion                  multi-language, advanced analytics, native AI
                             assistant inside briefings
  -------------------------------------------------------------------------

**14. Instructions for Claude Code**

  -----------------------------------------------------------------------
  **How to use this document with Claude Code**

  • Place this file (PRD.md or PRD.docx converted to markdown) in the
  root of your project.

  • Start every Claude Code session with: "Read PRD.md in full, then
  confirm your understanding before writing any code."

  • After it confirms, ask for a file structure and implementation plan.
  Review before any code is written.

  • Work one phase at a time. Do not ask Claude Code to build Phase 2
  features during Phase 1.

  • Reference this doc mid-session with \@PRD.md when context may have
  drifted.

  • Update this document as product decisions change. It is the source of
  truth.

  -----------------------------------------------------------------------

**14.1 Recommended Phase 1 build order**

- 1\. Supabase project setup + schema migration (all tables in Section
  5)

- 2\. NextAuth.js config: email+password + Google OAuth with
  Calendar/Tasks scopes

- 3\. Landing page (static, Next.js SSG)

- 4\. Onboarding flow: connect calendar → set briefing time → preview

- 5\. Trigger.dev job: free tier algorithm brief + Google Tasks write +
  in-app delivery

- 6\. Dashboard + briefing history pages

- 7\. Settings pages (slots, notifications, account)

- 8\. Stripe checkout + webhook handler + subscription lifecycle

- 9\. Admin backend (/admin/\*)

- 10\. Resend email integration (paid tier) + Web Push (all tiers)

**14.2 Key constraints to enforce**

- Never store raw calendar event content --- only the generated briefing
  summary

- Tier limits enforced server-side in API routes and job engine, never
  only client-side

- All admin mutations must be logged to admin_audit_log

- OAuth tokens must never be logged or returned to the client

- All /admin/\* routes must re-verify admin role server-side on every
  request

- Timezones must be stored as IANA strings (e.g. America/New_York),
  never UTC offsets

PAT (DailyBrief AI) · Architecture PRD v1.0 · Confidential · March 2026
