import crypto from 'crypto';
import express from 'express';
import { serviceClient } from '../services/supabase';
import { updateActionItemMessage } from '../services/slack';
import { createMondayTask } from '../services/monday';
import { decrypt } from '../services/encryption';

const router = express.Router();

function verifySlackSignature(req: express.Request, rawBody: Buffer): boolean {
  const timestamp = req.headers['x-slack-request-timestamp'] as string;
  const signature = req.headers['x-slack-signature'] as string;

  if (!timestamp || !signature) return false;

  // Reject requests older than 5 minutes (replay attack guard)
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

  const sigBase = `v0:${timestamp}:${rawBody.toString()}`;
  const hmac = crypto.createHmac('sha256', process.env.SLACK_SIGNING_SECRET!);
  hmac.update(sigBase);
  const computed = `v0=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    return false;
  }
}

// POST /slack/interactions
// Handles Slack Block Kit button clicks (approve / deny).
router.post('/slack/interactions', async (req, res) => {
  // Verify Slack signature against raw body
  const rawBody = req.rawBody;
  if (!rawBody || !verifySlackSignature(req, rawBody)) {
    res.status(401).send('Unauthorized');
    return;
  }

  // Slack sends payload as URL-encoded JSON string in `payload` field
  let payload: {
    type: string;
    actions: { action_id: string; value: string }[];
    channel: { id: string };
    message: { ts: string };
  };

  try {
    payload = JSON.parse(req.body.payload);
  } catch {
    res.status(400).send('Bad Request');
    return;
  }

  if (payload.type !== 'block_actions' || !payload.actions?.length) {
    res.status(200).send();
    return;
  }

  const action = payload.actions[0];
  const actionId = action.action_id;   // 'approve' | 'deny'
  const itemId = action.value;         // pending_action_items.id
  const messageTs = payload.message.ts;
  const channelId = payload.channel.id; // actual DM channel ID (D...), not the user ID (U...)

  if (actionId !== 'approve' && actionId !== 'deny') {
    res.status(200).send();
    return;
  }

  // Respond to Slack immediately (must reply within 3s)
  res.status(200).send();

  // Fetch the action item
  const { data: item, error: itemError } = await serviceClient
    .from('pending_action_items')
    .select('id, user_id, status, action_item_text')
    .eq('id', itemId)
    .single();

  if (itemError || !item) {
    console.error(`[slack] action item ${itemId} not found:`, itemError?.message);
    return;
  }

  // Duplicate click guard
  if (item.status !== 'pending') {
    console.log(`[slack] item ${itemId} already ${item.status} — ignoring`);
    return;
  }

  if (actionId === 'deny') {
    const { error: updateError } = await serviceClient
      .from('pending_action_items')
      .update({ status: 'denied' })
      .eq('id', itemId);

    if (updateError) {
      console.error(`[slack] failed to set status=denied for item ${itemId}:`, updateError.message);
      return;
    }

    try {
      await updateActionItemMessage(channelId, messageTs, false);
    } catch (err) {
      console.error(`[slack] chat.update failed for item ${itemId}:`, (err as Error).message);
    }

    return;
  }

  // approve
  const { error: updateError } = await serviceClient
    .from('pending_action_items')
    .update({ status: 'approved' })
    .eq('id', itemId);

  if (updateError) {
    console.error(`[slack] failed to set status=approved for item ${itemId}:`, updateError.message);
    return;
  }

  // Stub Monday task creation (Phase 5 completes this)
  try {
    const { data: credRow } = await serviceClient
      .from('user_credentials')
      .select('encrypted_token, monday_board_id')
      .eq('user_id', item.user_id)
      .eq('service', 'monday')
      .single();

    if (credRow) {
      const accessToken = decrypt(credRow.encrypted_token);
      await createMondayTask(accessToken, credRow.monday_board_id ?? '', item.action_item_text);
    }
  } catch (err) {
    console.error(`[slack] Monday task creation failed for item ${itemId}:`, (err as Error).message);
  }

  try {
    await updateActionItemMessage(channelId, messageTs, true);
  } catch (err) {
    console.error(`[slack] chat.update failed for item ${itemId}:`, (err as Error).message);
  }
});

export default router;
