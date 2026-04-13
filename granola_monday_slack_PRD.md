# PRD: Granola → Slack → Monday Action Item Router

## Overview

A lightweight multi-user web service, deployed on Fly.io, that polls Granola for completed meeting notes, extracts action items via a two-pass heuristic + LLM pipeline, routes them to each user via Slack DM for individual approval, and creates approved items as tasks in Monday.com (with the goal of expanding this to Asana.com and Todoist). 

---

## Problem statement

After meetings, action items live in Granola but require manual effort to move into Monday.com. This creates friction and drop-off. This app automates the routing while keeping the human in the loop via a lightweight approve/deny flow in Slack.

---

## Users

Multi-user. Each user connects their own Granola API key and Monday.com account independently. Slack uses a shared bot token — one bot, one workspace, the bot DMs each user directly. Users only ever see their own action items.

---

## Core workflow

1. Background job polls Granola every 15 minutes per user (staggered across users to avoid rate limit spikes)
2. New completed notes are detected by comparing against the last processed note ID stored per user
3. Action items are extracted from the note via a two-pass pipeline (see below)
4. One Slack DM is sent per action item, with Approve and Deny buttons
5. On approval, a task is created in Monday.com on the user's pre-configured board
6. A confirmation message with a link to the Monday task is sent back in the same Slack thread
7. On denial, the item is dismissed with no side effects

---

## Action item extraction pipeline

Extraction runs once per newly completed note, in two passes:

**Pass 1 — Heuristic parsing**
Scan the note summary and full notes for action item candidates using pattern matching:
- Bullet points or numbered list items
- Lines beginning with action-oriented verbs (e.g. "Follow up", "Send", "Schedule", "Review", "Create", "Update")
- Lines prefixed with "Action:", "TODO:", "Next step:", or checkbox markers

**Pass 2 — LLM layer**
The heuristic candidates, along with the full note summary, are passed to an LLM (single call per note) with a prompt instructing it to return a clean, deduplicated, structured list of action items. This handles edge cases the heuristic misses and removes noise the heuristic may have surfaced.

LLM cost is low since this runs once per completed meeting, not once per poll.

---

## Onboarding & setup

Each user completes a one-time setup flow through a simple web UI:

1. **Granola** — user enters their personal Granola API key (generated from Settings → Workspaces → API tab; requires Enterprise plan)
2. **Monday.com** — OAuth flow, then:
   - User selects a Workspace
   - User selects the Board where action items should land
   - Tasks are created as new items in the board's default group
3. **Slack** — no per-user OAuth required; the shared bot token is pre-configured. Users provide their Slack member ID so the bot knows who to DM.

Credentials are stored per-user and encrypted at rest.

---

## Slack message format

One message per action item:

> **Action item from [Meeting Title]**
> *Create the Q2 budget proposal*
> [✅ Add to Monday] [❌ Skip]

On approval, the message updates in-place to:

> ✅ Added to Monday → [link to task]

On denial, the message updates to:

> ❌ Skipped

---

## Technical architecture

**Stack:** Node.js or Python, deployed on Fly.io as a single app.

**Granola integration**
- REST polling via `GET /v1/notes` at `public-api.granola.ai`, filtered by `created_after` timestamp
- Per-user `last_processed_note_id` stored in the database to detect new notes
- Poll interval: every 15 minutes per user, staggered at startup to distribute API load

**Slack integration**
- Slack Bot with `chat:write` and `im:write` scopes using a shared bot token
- Interactive message buttons (Block Kit) for Approve / Deny
- Incoming webhook handler to receive and process button interaction payloads

**Monday.com integration**
- Monday GraphQL API
- On approval, call `create_item` mutation with the task name on the user's pre-configured board
- Return the created item's URL for the Slack confirmation message

**Database**
Postgres (Fly.io managed) with the following tables:

| Table | Key columns |
|---|---|
| `users` | id, email, slack_member_id, created_at |
| `user_credentials` | user_id, service, encrypted_token, monday_workspace_id, monday_board_id |
| `processed_notes` | user_id, granola_note_id, processed_at |
| `pending_action_items` | id, user_id, granola_note_id, action_item_text, slack_message_ts, status |

`status` on `pending_action_items` is one of: `pending`, `approved`, `denied`.

---

## Non-functional requirements

- Credentials encrypted at rest; never logged
- Staggered polling to be a good API citizen across all three services
- Idempotency on note processing is a known edge case deferred to v2 — the approve/deny flow acts as a human gate against accidental duplicates
- App should recover gracefully from API failures (Granola, Slack, or Monday downtime) without dropping items — failed polls retry on the next cycle

---

## Out of scope for v1

- Due dates, assignees, or any task metadata beyond name
- Editing action items before approving
- Batch approve/deny (one message per item is intentional)
- Duplicate/idempotency detection
- Re-processing notes manually
- Admin dashboard or reporting
- Multi-workspace Slack support

---

## Launch criteria

MVP is done when:

- A user can complete setup and connect all three services
- After a meeting, action items appear in Slack within ~15 minutes
- Approve creates the task in Monday and confirms with a link in the same thread
- Deny dismisses cleanly with no side effects
- At least one real user has run the full flow end-to-end on a real meeting
