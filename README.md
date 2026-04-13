# Oatput

**Meeting to action. Amplified.**

Oatput is a multi-user web service that automatically routes action items from your meeting notes into Monday.com tasks — with a human-in-the-loop approval step via Slack.

After a meeting, action items live in [Granola](https://granola.ai) but require manual effort to move into Monday.com. Oatput eliminates that friction: it polls your Granola notes, extracts action items using a heuristic + LLM pipeline, sends each one to you as a Slack DM with Approve/Deny buttons, and creates the approved ones as tasks in Monday.com automatically.

---

## How it works

1. A background job polls Granola every 15 minutes per user
2. New completed notes are scanned for action items via a two-pass extraction pipeline (regex heuristics + Claude AI)
3. Each action item is sent to the user as a Slack DM with **Approve** and **Deny** buttons
4. On approval, a task is created on the user's configured Monday.com board and a confirmation with a link is sent back in Slack
5. On denial, the item is dismissed with no side effects

---

## Tech stack

- **Runtime:** Node.js + TypeScript, Express
- **Database & Auth:** Supabase (Postgres + Google OAuth via PKCE)
- **AI extraction:** Claude API (`claude-haiku-4-5`) for action item parsing
- **Integrations:** Granola REST API, Slack Web API, Monday.com GraphQL API
- **Frontend:** Server-rendered HTML with Tailwind CSS (via CDN)
- **Deployment:** Fly.io

---

## Features

- Multi-user: each user connects their own Granola API key and Monday.com account independently
- Credentials stored with AES-256-GCM encryption at rest
- 6-step onboarding wizard (Slack member ID → Granola API key → Monday OAuth → board selection)
- Google OAuth sign-in via Supabase Auth
- Dashboard showing action item history with status badges
- Background polling loop, staggered across users to avoid rate limit spikes

---

## Project status

Currently in **Phase 2** — auth and onboarding flow built, end-to-end testing in progress.

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation: scaffold, DB, Supabase setup | Done |
| 2 | UI shell, Google Auth, 6-step onboarding | In progress |
| 3 | Granola polling + action item extraction | Planned |
| 4 | Slack delivery + approve/deny interactions | Planned |
| 5 | Monday.com task creation + full loop | Planned |
| 6 | Production hardening + launch readiness | Planned |

---

## Getting started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project with Google OAuth configured
- A [Monday.com](https://monday.com) OAuth app
- A Slack bot token and signing secret
- An Anthropic API key (Phase 3+)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in the values in .env

# Apply database migrations
supabase db push

# Start the dev server
npm run dev
```

The server runs at `http://localhost:3000`.

### Environment variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `ENCRYPTION_KEY` | 32-byte hex string for AES-256-GCM (`openssl rand -hex 32`) |
| `MONDAY_CLIENT_ID` | Monday.com OAuth app client ID |
| `MONDAY_CLIENT_SECRET` | Monday.com OAuth app client secret |
| `APP_URL` | Public URL of the app (e.g. `https://oatput.fly.dev`) |

---

## Database schema

Four tables in Supabase:

- **`users`** — linked to Supabase Auth via `auth.users`, stores Slack member ID and onboarding state
- **`user_credentials`** — encrypted Granola and Monday.com tokens per user
- **`processed_notes`** — tracks which Granola notes have already been processed (idempotency guard)
- **`pending_action_items`** — stores extracted action items and their approval status (`pending` / `approved` / `denied`)
