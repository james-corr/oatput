import { WebClient } from '@slack/web-api';

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// Sends an action item as a Slack DM with Approve/Deny buttons.
// Returns the Slack message ts (used to update the message later).
export async function sendActionItemDM(
  slackMemberId: string,
  itemId: string,
  itemText: string,
  meetingTitle: string
): Promise<string> {
  const result = await client.chat.postMessage({
    channel: slackMemberId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Action item from ${meetingTitle}*\n${itemText}`,
        },
      },
      {
        type: 'actions',
        block_id: `item_${itemId}`,
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '✅ Add to Monday' },
            style: 'primary',
            action_id: 'approve',
            value: itemId,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '❌ Skip' },
            action_id: 'deny',
            value: itemId,
          },
        ],
      },
    ],
  });

  if (!result.ok || !result.ts) {
    throw new Error(`Slack postMessage failed: ${result.error ?? 'no ts returned'}`);
  }

  return result.ts;
}

// Updates an existing action item DM to reflect the approved/denied outcome.
// Replaces the buttons with a plain confirmation line.
export async function updateActionItemMessage(
  slackMemberId: string,
  messageTs: string,
  approved: boolean
): Promise<void> {
  const text = approved ? '✅ Added to Monday' : '❌ Skipped';

  const result = await client.chat.update({
    channel: slackMemberId,
    ts: messageTs,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: text },
      },
    ],
    text,
  });

  if (!result.ok) {
    throw new Error(`Slack chat.update failed: ${result.error}`);
  }
}
