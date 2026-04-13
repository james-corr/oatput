# Oatput — Build Plan: All Phases

## Status & Where to Pick Up

**Last updated:** 2026-04-10
**Current status:** Phase 2 in progress 🔄 — login page rendering, auth flow not yet tested end-to-end

### Phase 1 — DONE ✅
- TypeScript project scaffolded, all dependencies installed
- Express server running with startup validation (crashes cleanly if env vars missing)
- All 4 Supabase tables live: `users`, `user_credentials`, `processed_notes`, `pending_action_items`
- Auth trigger in place: auto-inserts into `public.users` when Google OAuth creates an `auth.users` row
- `src/services/encryption.ts` — AES-256-GCM working
- `src/services/supabase.ts` — anonClient + serviceClient initialized
- `GET /health` returns `{"status":"ok","db":"connected"}` ✅
- `fly.toml` + `Dockerfile` written, deployment deferred to Phase 6
- `public/oatPut_logo.png` in place as static asset

### Phase 2 — In Progress 🔄

#### What was built this session
- `src/types/express.d.ts` — `req.user` augmentation
- `src/services/monday.ts` — Monday OAuth URL builder, token exchange, board list GraphQL, task creation stub
- `src/services/supabase.ts` — added `createAuthClient(req, res)` with per-request PKCE cookie storage adapter
- `src/middleware/auth.ts` — `requireAuth` middleware using `getUser()` (server-validated)
- `src/views/layout.ts` — shared HTML shell: GTM-MDD8QKSD, EB Garamond, CSS vars, `sidebar()` helper
- `src/views/login.ts` — split-screen login page ✅ confirmed rendering
- `src/views/onboarding.ts` — 6-step wizard with step indicator, all step content
- `src/views/dashboard.ts` — dashboard + settings pages with sidebar
- `src/routes/auth.ts` — Google OAuth, Monday OAuth, logout (full implementation)
- `src/routes/onboarding.ts` — full 6-step GET + POST handlers
- `src/routes/dashboard.ts` — dashboard + settings routes
- `src/server.ts` — wired up all new routes, replaced login stub, added MONDAY vars to REQUIRED
- `.env.example` — updated with Phase 2 vars
- Fixed redirect loop bug: `router.use(requireAuth)` was intercepting `/login` — moved to per-route middleware

#### What still needs testing (pick up here next session)
1. Click "Sign in with Google" → verify Google OAuth flow completes and lands on `/onboarding?step=1`
2. Step 1: Submit invalid Slack ID → error shown. Submit valid ID (e.g. `U01234ABCDE`) → advance to step 2
3. Step 2: Submit invalid Granola key → error. Submit valid key → advance to step 3
4. Step 3: Click "Connect Monday.com" → Monday OAuth → land on step 4 with board dropdown
5. Step 4: Select board → advance to step 5 with all green ✓
6. Step 5 → Step 6 → redirect to `/dashboard`
7. Verify DB: `users.onboarding_complete = true`, `slack_member_id` set, `user_credentials` has both rows
8. Sign out → cookie cleared → `/dashboard` redirects to `/login`
9. Sign in again → lands on `/dashboard` (not onboarding)

### To resume development
1. `cd /Users/jamescorr/Desktop/Projects/active_projects/Oatput`
2. `npm run dev` (runs on localhost:3000)
3. Verify login page: `http://localhost:3000/login`
4. Continue testing the auth + onboarding flow above

### Notes
- `NODE_TLS_REJECT_UNAUTHORIZED=0` is set in the `dev` npm script — this fixes a macOS SSL cert issue and is dev-only (not needed in production on Fly.io)
- Supabase project: `pwqftsfdnmeovowmtfou.supabase.co`
- `.env` file is local only (not committed) — contains Supabase URL, anon key, service role key, encryption key, Monday client ID/secret, APP_URL
- Auth uses PKCE flow via custom cookie storage adapter in `createAuthClient` — no `@supabase/ssr` needed
- `requireAuth` must be applied per-route (not via `router.use`) to avoid intercepting public routes like `/login`

---


## Context

App name: **Oatput**. Greenfield build of a multi-user web service that automates moving meeting action items from Granola → Slack approval flow → Monday.com tasks. After meetings, action items currently live in Granola and require manual effort to move into Monday.com. This app automates the routing while keeping a human in the loop via Slack Approve/Deny buttons.

**Stack:** Node.js + TypeScript, Express, Tailwind CSS (via CDN in HTML templates for server-rendered views), Supabase (Postgres + Auth), Fly.io deployment. Claude API for LLM extraction pass. Slack Web API (not Bolt), Monday.com GraphQL API, Granola REST API. Google OAuth via Supabase Auth.

**Google Tag Manager:** GTM container ID `GTM-MDD8QKSD` embedded in all HTML pages (head snippet + body noscript) for GA4 from day one.

**PRD:** `granola_monday_slack_PRD.md` (same directory)
**Logo:** `oatPut_logo.png` (same directory)

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

Derived from `oatPut_logo.png` — "premium oat packaging meets productivity software." Warm, organic, refined, modern-minimal. **Not** the dark teal of Trailmix.

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

**Logo:** `oatPut_logo.png` — circular speech-bubble + oat-leaf + checkmark mark, "OATPUT" wordmark, tagline "MEETING TO ACTION. AMPLIFIED." — sidebar header (small) and login page (large)

**Sidebar:** Fixed left nav, ~140px wide, parchment background, `--grain` accent on active link; user info in `--taupe`

**Decoration:** Organic leaf/grain SVG motifs drawn from logo mark; no geometric shapes, no cool tones

### Pages/routes

**`GET /login`** — Split-screen landing page:
- Left 60%: cream background with `oatPut_logo.png` centered, tagline "Meeting to action. Amplified.", subtle leaf/grain SVG decoration
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
- "Oatput is running" status card (stub; populated in Phase 5 with recent action items)

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
- `public/oatPut_logo.png` — logo served as static asset via `express.static('public')`

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

## Launch Criteria (from PRD)

- A user can complete setup and connect all three services
- After a meeting, action items appear in Slack within ~15 minutes
- Approve creates the task in Monday and confirms with a link in the same Slack thread
- Deny dismisses cleanly with no side effects
- At least one real user has run the full flow end-to-end on a real meeting
