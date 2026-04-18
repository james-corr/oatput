# Output — Build Plan: All Phases

## Status & Where to Pick Up

**Last updated:** 2026-04-15
**Current status:** Phase 5 DONE ✅ — Full loop confirmed working: Granola → Slack DM → Approve → Monday.com task created with link

### Phase 1 — DONE ✅
- TypeScript project scaffolded, all dependencies installed
- Express server running with startup validation (crashes cleanly if env vars missing)
- All 4 Supabase tables live: `users`, `user_credentials`, `processed_notes`, `pending_action_items`
- Auth trigger in place: auto-inserts into `public.users` when Google OAuth creates an `auth.users` row
- `src/services/encryption.ts` — AES-256-GCM working
- `src/services/supabase.ts` — anonClient + serviceClient initialized
- `GET /health` returns `{"status":"ok","db":"connected"}` ✅
- `fly.toml` + `Dockerfile` written, deployment deferred to Phase 6
- `public/output_logo.png` in place as static asset

### Phase 2 — DONE ✅

#### What was built
- `src/types/express.d.ts` — `req.user` augmentation
- `src/services/monday.ts` — Monday OAuth URL builder, token exchange, board list GraphQL, task creation stub
- `src/services/supabase.ts` — added `createAuthClient(req, res)` with per-request PKCE cookie storage adapter
- `src/middleware/auth.ts` — `requireAuth` middleware using `getUser()` (server-validated)
- `src/views/layout.ts` — shared HTML shell: GTM-MDD8QKSD, EB Garamond, CSS vars, `sidebar()` helper
- `src/views/login.ts` — split-screen login page ✅
- `src/views/onboarding.ts` — 6-step wizard with step indicator, all step content
- `src/views/dashboard.ts` — dashboard + settings pages with sidebar
- `src/routes/auth.ts` — Google OAuth, Monday OAuth, logout (full implementation)
- `src/routes/onboarding.ts` — full 6-step GET + POST handlers
- `src/routes/dashboard.ts` — dashboard + settings routes
- `src/server.ts` — wired up all new routes, replaced login stub, added MONDAY vars to REQUIRED
- `.env.example` — updated with Phase 2 vars

#### Bugs fixed
- **`maxAge` unit bug** — `res.cookie` maxAge is milliseconds; was set in seconds. Fixed in `src/routes/auth.ts` and `src/services/supabase.ts`
- **Session cookie overflow** — Supabase session JSON exceeded 4096-byte limit. Replaced with chunked base64url encoding across `key.0`/`key.1` cookies in `src/services/supabase.ts`
- **`storageKey` override ignored** — removed; Supabase now uses default project-ref-based key (`sb-pwqftsfdnmeovowmtfou-auth-token`)
- **Monday boards GraphQL** — `board_kind` field unauthorized; removed from query. Boards query is now `{ boards(limit: 50) { id name } }`
- **Monday OAuth scopes** — `boards:read`/`boards:write` were not configured on the Monday OAuth app → boards query returned "Unauthorized field or type". Fixed by: (1) adding scopes in Monday developer center, (2) adding `&scope=boards%3Aread%20boards%3Awrite` to `getMondayAuthUrl()` in `src/services/monday.ts`
- **Silent board fetch failure** — step 4 showed empty dropdown with no message on API error. Now shows actionable error via `try/catch` + `errorMessage` prop
- **POST step 4 validation** — re-fetching boards during submit failed silently; now skips validation if fetch returns `null` instead of reporting "Board not found"
- **Google OAuth setup** — one-time GCP + Supabase config: Google Cloud Console OAuth app with redirect URI `https://pwqftsfdnmeovowmtfou.supabase.co/auth/v1/callback`; `http://localhost:3000/auth/callback` added to Supabase allowed redirect URLs
- **UI text** — step 1 Slack instructions corrected (bottom-left picture → Profile → ··· → Copy Member ID); step 2 Granola instructions corrected (Preferences → API → Generate New API Key, Personal type)

#### Confirmed working ✅
1. Sign in with Google → lands on `/onboarding?step=1`
2. Step 1: Slack ID validation (error on invalid, advance on valid)
3. Step 2: Granola key validation (error on invalid, advance on valid)
4. Step 3: "Connect Monday.com" → Monday OAuth → redirects to step 4
5. Step 4: Board dropdown populates → select board → advance to step 5
6. Step 5 → Step 6 → redirect to `/dashboard`
7. Dashboard shows "Output is running"

#### Final verification ✅
- Sign out → cookies cleared → `/dashboard` redirects to `/login` ✅
- Sign in again → lands on `/dashboard` directly (onboarding skipped) ✅
- DB state implicitly confirmed: sign-in → dashboard redirect proves `onboarding_complete = true`; Supabase UI also verified `slack_member_id`, `granola` + `monday` rows, `monday_board_id` populated ✅

### Notes
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is set in the `dev` npm script — dev-only macOS SSL fix, not needed on Fly.io
- Supabase project: `pwqftsfdnmeovowmtfou.supabase.co`
- `.env` file is local only (not committed) — contains Supabase URL, anon key, service role key, encryption key, Monday client ID/secret, APP_URL
- Auth uses PKCE flow via chunked base64url cookie storage adapter in `createAuthClient` — no `@supabase/ssr` needed
- `requireAuth` must be applied per-route (not via `router.use`) to avoid intercepting public routes like `/login`
- Monday OAuth app requires `boards:read` + `boards:write` scopes configured in Monday developer center

### Phase 3 — DONE ✅

#### What was built
- `src/services/granola.ts` — two-call pattern: `fetchNewNotes()` fetches note list (metadata only), then `fetchNoteContent()` calls `GET /v1/notes/:id` per note for full content; 15s AbortController timeout on each call; client-side watermark filtering
- `src/services/extractor.ts` — `regexScanForActionItems()` (Pass 1) + `llmExtractActionItems()` with `claude-haiku-4-5-20251001` + ephemeral prompt caching (Pass 2); graceful fallback to regex-only on LLM error
- `src/services/scheduler.ts` — `startScheduler()` with per-user staggered `setTimeout` → `setInterval` (15 min); `getWatermark()` uses `MAX(processed_at)` from DB (survives restarts); crash-safe insert order (action items first, `processed_notes` last)
- `scripts/test-extractor.ts` — standalone smoke test (`npm run test:extractor`)
- `src/server.ts` — `ANTHROPIC_API_KEY` added to `REQUIRED`; `startScheduler()` called after `app.listen()`
- `src/routes/dashboard.ts` — `GET /dev/poll/:userId` trigger route (dev-only, gated by `NODE_ENV !== 'production'`)
- `.env.example` — `ANTHROPIC_API_KEY` uncommented
- Debug logging removed from `src/middleware/auth.ts` and `src/routes/auth.ts`
- `package.json` — `@anthropic-ai/sdk` added; `test:extractor` npm script added

#### Bugs discovered and fixed during testing
- **Granola list endpoint is metadata-only** — `GET /v1/notes` returns id/title/owner/timestamps but no content. Fixed by adding `fetchNoteContent()` which calls `GET /v1/notes/:id` per note
- **Wrong content field names** — original code tried `content`/`transcript`/`notes`; actual individual note fields are `summary_markdown` and `summary_text` (user-editable notes) plus a structured `transcript` object. Fixed in `resolveNoteText()` to try `summary_markdown` → `summary_text` → transcript text extraction
- **`created_after` query param ignored by Granola** — passing `created_after` as a URL param caused Granola to return `{"notes":[],"hasMore":false,"cursor":null}`. Removed the query param; watermark filtering now done client-side on `note.created_at`
- **macOS SSL error in test script** — `NODE_TLS_REJECT_UNAUTHORIZED=0` required for Anthropic SDK calls in dev, same as the Express server. Added to `test:extractor` npm script

#### Confirmed working ✅
- `npm run test:extractor` — Claude returns 10 clean action items from sample transcript
- `curl http://localhost:3000/dev/poll/USER_ID` — polls Granola, fetches content per note, extracts action items, writes to DB
- Verified in Supabase: `processed_notes` has 10 rows; `pending_action_items` has 91 rows across 10 meetings
- Re-polling the same notes produces no duplicates (watermark + `processed_notes` unique constraint)

#### Granola API — confirmed shape
- Base URL: `https://public-api.granola.ai`
- Auth: `Authorization: Bearer <apiKey>`
- `GET /v1/notes` → `{ notes: [...], hasMore: bool, cursor: null }` — metadata only (id, title, owner, created_at, updated_at, calendar_event, attendees)
- `GET /v1/notes/:id` → full note with `summary_markdown`, `summary_text`, `transcript` (structured array of segments), `attendees`, `folder_membership`
- No working `created_after` query param — filter client-side

#### Notes
- Scheduler only picks up users active at startup; new users after server start included on next restart (Phase 5/6 enhancement)
- `GET /dev/poll/:userId` absent in production (`NODE_ENV=production`)
- Watermark defaults to `now - 24h` for new users

### Phase 4 — DONE ✅

#### What was built
- `src/services/slack.ts` — `sendActionItemDM()` sends Block Kit DM with Approve/Deny buttons; `updateActionItemMessage()` calls `chat.update` to replace buttons with outcome text
- `src/routes/slack.ts` — `POST /slack/interactions`: HMAC-SHA256 Slack signature verification, duplicate-click guard (`status != 'pending'` → silent 200), approve/deny routing, Monday stub called on approve
- `src/services/scheduler.ts` — after inserting action items, fetches `slack_member_id`, calls `sendActionItemDM()` per item, stores returned `ts` in `slack_message_ts`
- `src/server.ts` — `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` added to `REQUIRED`; `express.urlencoded` verify hook captures `req.rawBody` for signature verification; `slackRouter` mounted
- `src/types/express.d.ts` — added `rawBody?: Buffer`
- `.env.example` — Slack vars added with setup instructions
- `package.json` — `@slack/web-api` added

#### Bug fixed during testing
- **Wrong channel ID for `chat.update`** — `sendActionItemDM` posts to a user ID (`U...`) but Slack routes it to a DM channel (`D...`). `chat.update` was re-using the user ID and failing silently. Fixed by reading `payload.channel.id` directly from the interaction payload and passing that to `updateActionItemMessage()` instead.

#### Slack app setup (one-time, already done)
- App created at api.slack.com with Bot Token Scopes: `chat:write`, `im:write`
- Interactivity enabled; Request URL pointed at ngrok tunnel + `/slack/interactions`
- `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET` added to `.env`

#### Confirmed working ✅
- Polling via `GET /dev/poll/:userId` sends Slack DMs for each extracted action item
- DM text is accurate: meeting title + action item text
- Clicking "✅ Add to Monday" → message updates, DB `status = approved`
- Clicking "❌ Skip" → message updates, DB `status = denied`
- Duplicate clicks silently ignored (duplicate-click guard working)

#### Notes
- ngrok tunnel URL changes each dev session — update Slack app Interactivity Request URL each time
- Monday task creation is still a stub (logs only) — completed in Phase 5

### Phase 5 — DONE ✅

#### What was built
- `supabase/migrations/20260415_add_meeting_title.sql` — adds `meeting_title TEXT` column to `pending_action_items`
- `src/services/monday.ts` — `createMondayTask()` fully implemented: `create_item` GraphQL mutation with variables, returns item URL; throws on HTTP/GraphQL errors for caller retry
- `src/services/slack.ts` — `updateActionItemMessage()` now takes `text: string` instead of `approved: boolean`, enabling approve-with-link, deny, and failure fallback messages
- `src/routes/slack.ts` — approve flow restructured: fetches Monday credentials, calls `createMondayTask()` via `withRetry()` (3× with 1s/2s/4s backoff); on success sets `status='approved'` and updates Slack with "✅ Added to Monday → [link]"; on final failure sets `status='failed'`, increments `retry_count`, sends "⚠️ Could not create Monday task — please add manually"
- `src/services/scheduler.ts` — `requeuePendingItems()` re-sends Slack DMs for pending items with no `slack_message_ts` older than 5 min; called at start of each `pollUser()` cycle; action item inserts now include `meeting_title: note.title`
- `src/views/dashboard.ts` — `dashboardPage()` now accepts `recentItems: ActionItemRow[]`; renders a full action items table with status badges (Pending/Added/Skipped/Failed), meeting title, truncated action item text, and date; empty state when no items
- `src/routes/dashboard.ts` — fetches last 20 action items for user (newest first) and passes to `dashboardPage()`
- `src/types/index.ts` — `PendingActionItem` now includes `meeting_title: string | null` and `retry_count: number`

#### Bugs fixed during testing
- **Re-queue sweep flooded Slack on startup** — 91 action items from Phase 3 testing had `slack_message_ts = NULL` (inserted before Slack DM sending existed). The re-queue sweep correctly found them all and tried to send 91 DMs at once, hitting Slack rate limits. Fixed by adding a 24-hour upper age bound to `requeuePendingItems()` — only re-queues items created in the last 24 hours, ignoring old test data.
- **Missing top-level `text` field in `sendActionItemDM`** — Slack Web API warns when `chat.postMessage` is called with blocks but no top-level `text` fallback (used by screen readers and push notifications). Added `text: \`Action item from ${meetingTitle}: ${itemText}\`` to the call.

#### Migration — APPLIED ✅
`meeting_title TEXT` column added to `pending_action_items` via Supabase SQL Editor.

#### Confirmed working ✅
- Full end-to-end loop: `GET /dev/poll/:userId` → Slack DM → "✅ Add to Monday" → Monday task created → Slack message updates with task link
- "❌ Skip" → message updates to "❌ Skipped", `status = denied`
- Monday tasks appearing in the configured board
- ngrok static domain (`demeaning-unit-nanny.ngrok-free.dev`) is stable across sessions — no need to update Slack Request URL each restart

#### Notes
- 91 old Phase 3 test items remain in DB with `status = 'pending'`. Bulk-deny if needed: `UPDATE pending_action_items SET status = 'denied' WHERE created_at < now() - interval '1 day'`
- Slack Interactivity Request URL: `https://demeaning-unit-nanny.ngrok-free.dev/slack/interactions`

### To resume development (Phase 6)
1. `cd /Users/jamescorr/Desktop/Projects/active_projects/Oatput`
2. Start ngrok: `ngrok http 3000` (static domain — Slack URL stays the same)
3. `npm run dev`
4. Phase 6: Production hardening + Fly.io deploy

---


## Context

App name: **Output**. Greenfield build of a multi-user web service that automates moving meeting action items from Granola → Slack approval flow → Monday.com tasks. After meetings, action items currently live in Granola and require manual effort to move into Monday.com. This app automates the routing while keeping a human in the loop via Slack Approve/Deny buttons.

**Stack:** Node.js + TypeScript, Express, Tailwind CSS (via CDN in HTML templates for server-rendered views), Supabase (Postgres + Auth), Fly.io deployment. Claude API for LLM extraction pass. Slack Web API (not Bolt), Monday.com GraphQL API, Granola REST API. Google OAuth via Supabase Auth.

**Google Tag Manager:** GTM container ID `GTM-MDD8QKSD` embedded in all HTML pages (head snippet + body noscript) for GA4 from day one.

**PRD:** `granola_monday_slack_PRD.md` (same directory)
**Logo:** `output_logo.png` (same directory)

---

## Phases Overview

| Phase | Focus | End State |
|-------|-------|-----------|
| 1 | Foundation: scaffold, DB, Supabase, Fly.io skeleton | `/health` returns `db: connected`, all 4 DB tables live |
| 2 | UI shell + Google Auth + onboarding flow | User completes 6-step setup, all credentials stored |
| 3 | Granola polling + action item extraction | Action items written to DB from real meetings |
| 4 | Slack delivery + approve/deny interactions | Users receive DMs and act on them |
| 5 | Monday.com task creation + full loop | Full happy path works end-to-end |
| 6 | Production hardening + launch readiness | Rate limiting, graceful shutdown, monitoring |

---

## Phase 1 — Foundation

### What gets built

- TypeScript project with `tsx` (dev) and `tsc` (prod build)
- Express server with `GET /health` that pings Supabase and returns `{ status: "ok", db: "connected" }`
- Supabase schema via `supabase/migrations/` — applied with `supabase db push`. The `users` table references Supabase's `auth.users(id)` via foreign key so Google Auth auto-creates the identity.
- `src/services/supabase.ts` — initializes two Supabase clients: `anonClient` (for auth flows) and `serviceClient` (for server-side DB writes using the service role key)
- `src/services/encryption.ts` — AES-256-GCM encrypt/decrypt using Node's built-in `crypto` module; must exist before any credential is written (Supabase does not encrypt application-level secrets)
- Fly.io `fly.toml` + multi-stage Dockerfile (compile TypeScript in builder stage, run compiled JS in slim Node Alpine runtime) — written but deployment deferred to Phase 6
- `.env.example` listing all required env vars
- Shared TypeScript types for all four DB entities
- Startup validation: crash with a clear message if `ENCRYPTION_KEY`, `SUPABASE_URL`, or `SUPABASE_SERVICE_ROLE_KEY` is missing

### Directory structure

```
src/
├── server.ts                          # Express app entry, mounts routes
├── routes/
│   ├── health.ts                      # GET /health
│   ├── auth.ts                        # Stub (Phase 2)
│   └── onboarding.ts                  # Stub (Phase 2)
├── services/
│   ├── supabase.ts                    # anonClient + serviceClient initialization
│   └── encryption.ts                  # AES-256-GCM
└── types/
    └── index.ts                       # User, Credential, ActionItem, ProcessedNote types

supabase/
└── migrations/
    └── 20260410_initial_schema.sql    # All 4 tables + auth trigger (applied via supabase db push)

fly.toml
Dockerfile
.env.example
tsconfig.json
package.json
```

### Database schema (`supabase/migrations/20260410_initial_schema.sql`)

```sql
-- users references auth.users so Google OAuth auto-creates the identity
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  slack_member_id TEXT UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  service TEXT NOT NULL,           -- 'granola' | 'monday'
  encrypted_token TEXT NOT NULL,
  monday_workspace_id TEXT,
  monday_board_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, service)
);

CREATE TABLE IF NOT EXISTS public.processed_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granola_note_id TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, granola_note_id)
);

CREATE TABLE IF NOT EXISTS public.pending_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  granola_note_id TEXT NOT NULL,
  action_item_text TEXT NOT NULL,
  slack_message_ts TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: auto-insert into public.users when a new auth.users row is created via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Key dependencies (package.json)

```json
{
  "dependencies": {
    "express": "^4.18",
    "@supabase/supabase-js": "^2",
    "dotenv": "^16",
    "cookie-parser": "^1.4"
  },
  "devDependencies": {
    "typescript": "^5",
    "tsx": "^4",
    "@types/express": "^4",
    "@types/cookie-parser": "^1",
    "@types/node": "^20"
  }
}
```

### Environment variables (.env.example)

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service role key — never expose client-side>
ENCRYPTION_KEY=<32-byte hex string: openssl rand -hex 32>
PORT=3000
```

### Verification for Phase 1

1. `npm run dev` starts without errors
2. `GET /health` returns `{ status: "ok", db: "connected" }`
3. `encrypt(decrypt(x)) === x` confirmed manually
4. All 4 tables + trigger exist in Supabase after `supabase db push`
5. Missing `ENCRYPTION_KEY` at startup exits with a clear error message
6. `fly.toml` + `Dockerfile` written and ready; deployment deferred to Phase 6

---

## Phase 2 — UI Shell + Google Auth + 6-Step Onboarding

All pages are server-rendered HTML with Tailwind CSS (via CDN).

### Design system

Derived from `output_logo.png` — "premium oat packaging meets productivity software." Warm, organic, refined, modern-minimal. **Not** the dark teal of Trailmix.

**Typography:**
- Serif typeface similar to Georgia — classic, proportional, low contrast, regular weight (not bold)
- Wide letter-spacing (~3–4px tracking) throughout all UI text
- Warm off-white text (`#e8dfc8`) on dark backgrounds; deep brown (`#3d3320`) on light
- No slab serifs, no display faces, no sans-serif

**Color palette:**
| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#f9f5ed` | Page background (warm parchment/linen) |
| `--text` | `#3d3320` | Primary text on light backgrounds |
| `--wordmark-tan` | `#e8dfc8` | Light text on dark backgrounds |
| `--grain` | `#d4ba7a` | Grain/oat body — buttons, active states, highlights |
| `--grain-outline` | `#9a7b3a` | Grain outline/stalk — borders, dividers, input focus rings |
| `--leaf` | `#6d8c3a` | Leaf/checkmark accent — success states, approval indicators |
| `--taupe` | `#8c7d5a` | Tagline, secondary/muted text, placeholder text |

Warm neutrals only — no cool grays, no stark whites, no saturated colors. Palette feels like unbleached linen, dried grain, and morning light.

**Logo:** `output_logo.png` — circular speech-bubble + oat-leaf + checkmark mark, "OUTPUT" wordmark, tagline "MEETING TO ACTION. AMPLIFIED." — sidebar header (small) and login page (large)

**Sidebar:** Fixed left nav, ~140px wide, parchment background, `--grain` accent on active link; user info in `--taupe`

**Decoration:** Organic leaf/grain SVG motifs drawn from logo mark; no geometric shapes, no cool tones

### Pages/routes

**`GET /login`** — Split-screen landing page:
- Left 60%: cream background with `output_logo.png` centered, tagline "Meeting to action. Amplified.", subtle leaf/grain SVG decoration
- Right 40%: warm off-white panel, "WELCOME BACK" label in brown, golden "Sign in with Google" button
- GTM snippet in `<head>` and `<body noscript>` of this and all other pages
- Clicking Google → Supabase Auth OAuth → redirects to `/onboarding` (or `/dashboard` if already onboarded)

**`GET /auth/callback`** — Handles Supabase OAuth redirect; exchanges code for session, sets cookie, redirects

**`GET /onboarding`** — 6-step wizard with numbered step progress indicator (golden = current/complete, tan = future):
- Step 1: **Connect Slack** — description + text input for Slack member ID (no OAuth per PRD); stored in `users`
- Step 2: **Connect Granola** — guided setup with embedded screenshot images showing where to find the API key; paste API key input; validates by pinging Granola API; stored encrypted in `user_credentials`
- Step 3: **Connect Monday.com** — OAuth redirect to Monday; callback fetches boards; board selector dropdown; stores encrypted token + `monday_board_id`
- Step 4: **Configure** — confirm board selection, show board name as confirmation
- Step 5: **Review** — summary of all connected services with green/red status indicators
- Step 6: **Done** — confirmation screen, redirect to Dashboard; sets `onboarding_complete = true`

**`GET /dashboard`** — Post-onboarding home:
- Sidebar nav (Dashboard, Settings) + user name/email + Sign out
- "Output is running" status card (stub; populated in Phase 5 with recent action items)

**`GET /settings`** — Re-configure any connected service (stub in Phase 2)

**Auth middleware** (`src/middleware/auth.ts`) — reads Supabase session cookie, injects `req.user`; redirects unauthenticated requests to `/login`

### New files

- `src/routes/auth.ts` — `/auth/callback`, `/auth/monday/callback`, `/auth/logout`
- `src/routes/onboarding.ts` — multi-step onboarding GET/POST handlers
- `src/routes/dashboard.ts` — dashboard + settings
- `src/middleware/auth.ts` — session guard
- `src/views/layout.ts` — shared HTML shell with GTM snippet (`GTM-MDD8QKSD`) in `<head>` and `<body noscript>`, Tailwind CDN, CSS variables for design tokens
- `src/views/` — HTML template strings (TS template literals, no templating engine)
- `src/services/monday.ts` — thin GraphQL client (workspace + board list; task creation stub)
- `public/output_logo.png` — logo served as static asset via `express.static('public')`

---

## Phase 3 — Granola Polling + Action Item Extraction

- `src/services/scheduler.ts` — `setInterval`-based loop, 15 min per user, staggered at startup (users distributed across the window by index)
- `src/services/granola.ts` — REST client polling `GET /v1/notes` at `public-api.granola.ai`, filtered by `created_after`; skips note IDs already in `processed_notes`
- `src/services/extractor.ts` — two-pass pipeline:
  - Pass 1: regex scanning for "Action:", "TODO:", "Follow up", "Send", "Schedule", "Review", "Create", "Update", bullet points, checkbox markers, numbered list items beginning with action verbs
  - Pass 2: Claude API (`claude-haiku-4-5-20251001` for cost) with a structured JSON output prompt; deduplicates against Pass 1 candidates
- Writes extracted items to `pending_action_items` + `processed_notes` in a single Supabase transaction
- Crash mid-write leaves note unprocessed → retried on next cycle (idempotency via `processed_notes` unique constraint)

### New env vars

```
ANTHROPIC_API_KEY=<Claude API key>
```

---

## Phase 4 — Slack Delivery + Interactions

- `src/services/slack.ts` — wraps `@slack/web-api` for `chat.postMessage` and `chat.update`
- Block Kit message format:
  - Section block: "**Action item from [Meeting Title]**\n*[action item text]*"
  - Actions block: "✅ Add to Monday" button + "❌ Skip" button; button `value` = `pending_action_items.id`
- Store returned `ts` into `pending_action_items.slack_message_ts`
- `POST /slack/interactions` — verifies Slack signing secret; routes button clicks
  - On Deny: set `status = denied`, `chat.update` to "❌ Skipped"
  - On Approve: set `status = approved`, stub Monday call (logs action item, confirmed in Phase 5)
- Duplicate click guard: if `status != pending`, return 200 silently

### New env vars

```
SLACK_BOT_TOKEN=xoxb-...
SLACK_SIGNING_SECRET=...
```

---

## Phase 5 — Monday.com Task Creation + Full Loop

- Complete `create_item` GraphQL mutation in `src/services/monday.ts`
- On approve: create task on user's configured board, `chat.update` Slack message to "✅ Added to Monday → [link to task]"
- On Monday failure: retry up to 3× with exponential backoff; on final failure mark `status = failed`, send fallback Slack message ("Could not create Monday task — please add manually")
- Add migration: `retry_count INTEGER DEFAULT 0`; add `failed` as valid status value
- Scheduler sweep: re-queue `pending` items with no `slack_message_ts` older than 5 min (handles Slack send crashes)
- Dashboard fleshed out: recent action items table with status badges (pending / approved / denied / failed), meeting title, timestamp

### New env vars

```
MONDAY_CLIENT_ID=...
MONDAY_CLIENT_SECRET=...
```

---

## Phase 6 — Production Hardening

- Rate limit handling for all three APIs: Granola (per-user spacing in scheduler), Slack (`retry_after` header respected), Monday (exponential backoff on 429)
- `SIGTERM` graceful shutdown — drain in-flight API calls before exiting; scheduler marks current cycle complete
- `fly.toml`: `min_machines_running = 1` (keeps polling loop alive), health check pointed at `/health`
- `GET /admin/status` (protected by `ADMIN_TOKEN`): per-user last-poll timestamp, pending item counts, error counts
- Startup secrets audit: warn (not crash) if any env var name contains "KEY" or "SECRET" but resolves to an empty string
- Full README: Fly.io deploy steps, Supabase project setup, Google OAuth app registration, Slack app manifest, Monday OAuth app registration, all required env vars

### New env vars

```
ADMIN_TOKEN=<random string for /admin/status protection>
```

---

## Future Updates / Quality of Life

Improvements to revisit after launch — not blocking, but noted for future sprints.

| # | Area | Description |
|---|------|-------------|
| 1 | Slack UX | After approving or skipping an action item, remove the buttons entirely from the Slack message — leave only the status text ("✅ Added to Monday" or "❌ Skipped"). Currently the updated message replaces button labels but the button UI may still render depending on Slack client version. |
| 2 | Extractor — regex pass | Two improvements to `src/services/extractor.ts` Pass 1: (a) Add missing keyword triggers: `"Action needed"`, `"Action:"`, `"Action plan"`, `"Next steps:"`. (b) Add section-context detection: when a line matches a heading pattern (`/^(next steps|action items|action plan)\s*$/i`) treat every subsequent non-empty bullet or `Name: text` line as an action item until the next heading or two consecutive blank lines are encountered. This handles transcripts where individual lines contain no keywords but their parent heading signals they are all action items — e.g. a "Next Steps" block where each line is `Person: task`. The LLM pass (Pass 2) already catches most of these, but capturing them in Pass 1 reduces LLM token usage and improves reliability when the API is unavailable. |
| 3 | Expand task output destinations | Major upgrade to include the ablitiy to send action items to other destiations like Asana or Todoist
| 4 | Expand task listening sources | Very large major upgrade, bigger than integrating with more output destinations, to include the ability to use a different call transcription tool like Gong, Avoma, Gemini (?) etc. 
---

## Launch Criteria (from PRD)

- A user can complete setup and connect all three services
- After a meeting, action items appear in Slack within ~15 minutes
- Approve creates the task in Monday and confirms with a link in the same Slack thread
- Deny dismisses cleanly with no side effects
- At least one real user has run the full flow end-to-end on a real meeting
