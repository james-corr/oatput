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
    text: `Action item from ${meetingTitle}: ${itemText}`,
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

// Updates an existing action item DM to reflect the outcome.
// Replaces the buttons with the provided outcome text.
export async function updateActionItemMessage(
  channelId: string,
  messageTs: string,
  text: string
): Promise<void> {
  const result = await client.chat.update({
    channel: channelId,
    ts: messageTs,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text },
      },
    ],
    text,
  });

  if (!result.ok) {
    throw new Error(`Slack chat.update failed: ${result.error}`);
  }
}
