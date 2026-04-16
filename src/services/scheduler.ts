import { serviceClient } from './supabase';
import { decrypt } from './encryption';
import { fetchNewNotes } from './granola';
import { extractActionItems } from './extractor';
import { sendActionItemDM } from './slack';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

// Returns user IDs for all users who have completed onboarding.
async function getActiveUsers(): Promise<string[]> {
  const { data, error } = await serviceClient
    .from('users')
    .select('id')
    .eq('onboarding_complete', true);

  if (error) {
    console.error('[scheduler] Failed to fetch active users:', error.message);
    return [];
  }

  return (data ?? []).map((row: { id: string }) => row.id);
}

// Returns the watermark timestamp for a user:
// MAX(processed_at) from processed_notes, or (now - 24h) if no rows exist.
async function getWatermark(userId: string): Promise<Date> {
  const { data, error } = await serviceClient
    .from('processed_notes')
    .select('processed_at')
    .eq('user_id', userId)
    .order('processed_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // No processed notes yet — default to 24h ago to avoid ingesting months of backlog
    const fallback = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return fallback;
  }

  return new Date(data.processed_at);
}

// Re-sends Slack DMs for pending items that never received one (Slack failure during insert).
// Runs at the top of each poll cycle as a safety sweep.
async function requeuePendingItems(userId: string, slackMemberId: string): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: items, error } = await serviceClient
    .from('pending_action_items')
    .select('id, action_item_text, meeting_title')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .is('slack_message_ts', null)
    .lt('created_at', fiveMinutesAgo)
    .gt('created_at', twentyFourHoursAgo);

  if (error) {
    console.error(`[scheduler] user ${userId}: requeue sweep failed — ${error.message}`);
    return;
  }

  if (!items?.length) return;

  console.log(`[scheduler] user ${userId}: re-queuing ${items.length} undelivered item(s)`);

  for (const item of items as { id: string; action_item_text: string; meeting_title: string | null }[]) {
    try {
      const ts = await sendActionItemDM(
        slackMemberId,
        item.id,
        item.action_item_text,
        item.meeting_title ?? 'Unknown meeting'
      );
      await serviceClient
        .from('pending_action_items')
        .update({ slack_message_ts: ts })
        .eq('id', item.id);
    } catch (err) {
      console.error(`[scheduler] user ${userId}: requeue DM failed for item ${item.id} — ${(err as Error).message}`);
    }
  }
}

// Runs one full poll cycle for a single user.
// Never throws — all errors are caught and logged.
export async function pollUser(userId: string): Promise<void> {
  // 1. Fetch and decrypt the user's Granola API key
  const { data: credRow, error: credError } = await serviceClient
    .from('user_credentials')
    .select('encrypted_token')
    .eq('user_id', userId)
    .eq('service', 'granola')
    .single();

  if (credError || !credRow) {
    console.warn(`[scheduler] user ${userId}: no Granola credential found — skipping`);
    return;
  }

  let apiKey: string;
  try {
    apiKey = decrypt(credRow.encrypted_token);
  } catch {
    console.error(`[scheduler] user ${userId}: failed to decrypt Granola key — skipping`);
    return;
  }

  // 2. Get watermark
  const watermark = await getWatermark(userId);

  // 3. Fetch IDs already processed after the watermark (for O(1) lookup)
  const { data: processedRows } = await serviceClient
    .from('processed_notes')
    .select('granola_note_id')
    .eq('user_id', userId)
    .gte('processed_at', watermark.toISOString());

  const alreadyProcessedIds = new Set<string>(
    (processedRows ?? []).map((r: { granola_note_id: string }) => r.granola_note_id)
  );

  // 3b. Fetch the user's Slack member ID for DM delivery
  const { data: userRow } = await serviceClient
    .from('users')
    .select('slack_member_id')
    .eq('id', userId)
    .single();

  const slackMemberId = userRow?.slack_member_id ?? null;
  if (!slackMemberId) {
    console.warn(`[scheduler] user ${userId}: no slack_member_id — items will be saved but not DMed`);
  }

  // 3c. Re-queue any pending items that never received a Slack DM
  if (slackMemberId) {
    await requeuePendingItems(userId, slackMemberId);
  }

  // 4. Fetch new notes from Granola
  let notes;
  try {
    notes = await fetchNewNotes(apiKey, watermark, alreadyProcessedIds);
  } catch (err) {
    console.error(`[scheduler] user ${userId}: Granola fetch failed — ${(err as Error).message}`);
    return;
  }

  if (notes.length === 0) {
    console.log(`[scheduler] user ${userId}: no new notes`);
    return;
  }

  // 5. Process each note
  for (const note of notes) {
    try {
      const actionItems = await extractActionItems(note.content);

      console.log(`[scheduler] user ${userId}: note ${note.id} → ${actionItems.length} action item(s)`);

      // Insert action items first (crash before processed_notes insert = note retried next cycle)
      if (actionItems.length > 0) {
        const rows = actionItems.map((text) => ({
          user_id: userId,
          granola_note_id: note.id,
          action_item_text: text,
          meeting_title: note.title,
        }));

        const { data: insertedRows, error: insertError } = await serviceClient
          .from('pending_action_items')
          .insert(rows)
          .select('id, action_item_text');

        if (insertError) {
          console.error(`[scheduler] user ${userId}: failed to insert action items for note ${note.id} — ${insertError.message}`);
          // Do not mark as processed — retry next cycle
          continue;
        }

        // Send Slack DMs for each inserted item
        if (slackMemberId && insertedRows) {
          for (const row of insertedRows as { id: string; action_item_text: string }[]) {
            try {
              const ts = await sendActionItemDM(slackMemberId, row.id, row.action_item_text, note.title);
              await serviceClient
                .from('pending_action_items')
                .update({ slack_message_ts: ts })
                .eq('id', row.id);
            } catch (err) {
              console.error(`[scheduler] user ${userId}: Slack DM failed for item ${row.id} — ${(err as Error).message}`);
              // Item stays pending with null slack_message_ts; Phase 5 re-queue sweep will retry
            }
          }
        }
      }

      // Mark note as processed LAST (idempotency guard via UNIQUE constraint)
      const { error: processedError } = await serviceClient
        .from('processed_notes')
        .upsert(
          { user_id: userId, granola_note_id: note.id },
          { onConflict: 'user_id,granola_note_id' }
        );

      if (processedError) {
        console.error(`[scheduler] user ${userId}: failed to mark note ${note.id} processed — ${processedError.message}`);
      }
    } catch (err) {
      console.error(`[scheduler] user ${userId}: error processing note ${note.id} — ${(err as Error).message}`);
      // Note stays unprocessed; retried next cycle
    }
  }
}

// Starts the scheduler. Called once from server.ts after app.listen().
// Stagger each user's first poll across the 15-minute window, then settle into
// a per-user independent interval.
export function startScheduler(): void {
  getActiveUsers().then((userIds) => {
    if (userIds.length === 0) {
      console.log('[scheduler] no active users — scheduler idle (will activate on next restart after users onboard)');
      return;
    }

    console.log(`[scheduler] starting — ${userIds.length} user(s) across ${POLL_INTERVAL_MS / 60_000}m window`);

    const staggerMs = userIds.length > 1 ? POLL_INTERVAL_MS / userIds.length : 0;

    userIds.forEach((userId, index) => {
      const initialDelay = index * staggerMs;

      setTimeout(() => {
        pollUser(userId);
        setInterval(() => pollUser(userId), POLL_INTERVAL_MS);
      }, initialDelay);
    });
  }).catch((err) => {
    console.error('[scheduler] failed to start:', (err as Error).message);
  });
}
