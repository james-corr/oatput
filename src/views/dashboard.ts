import { pageShell, sidebar } from './layout';

export interface ConnectionStatus {
  granolaConnected: boolean;
  mondayConnected: boolean;
  mondayBoardId?: string;
  slackMemberId?: string;
}

export interface ActionItemRow {
  id: string;
  action_item_text: string;
  meeting_title: string | null;
  status: 'pending' | 'approved' | 'denied' | 'failed';
  created_at: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: ActionItemRow['status']): string {
  const styles: Record<ActionItemRow['status'], string> = {
    pending:  'color: var(--taupe); border-color: var(--taupe);',
    approved: 'color: var(--leaf); border-color: var(--leaf);',
    denied:   'color: #8c7d5a; border-color: #8c7d5a;',
    failed:   'color: #b85c38; border-color: #b85c38;',
  };
  const labels: Record<ActionItemRow['status'], string> = {
    pending:  'Pending',
    approved: 'Added',
    denied:   'Skipped',
    failed:   'Failed',
  };
  return `<span style="display: inline-block; padding: 2px 10px; border-radius: 100px; font-size: 0.75rem; letter-spacing: 0.06em; border: 1px solid; ${styles[status]}">${labels[status]}</span>`;
}

export function dashboardPage(email: string, recentItems: ActionItemRow[]): string {
  const tableRows = recentItems.map((item, i) => {
    const rowBg = i % 2 === 1 ? 'background-color: rgba(212,186,122,0.05);' : '';
    const meeting = escapeHtml(item.meeting_title ?? 'Unknown meeting');
    const rawText = item.action_item_text.length > 80
      ? item.action_item_text.slice(0, 77) + '…'
      : item.action_item_text;
    const text = escapeHtml(rawText);
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    return `<tr style="${rowBg}">
      <td style="padding: 12px 16px; color: var(--text); white-space: nowrap; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${meeting}</td>
      <td style="padding: 12px 16px; color: var(--text);">${text}</td>
      <td style="padding: 12px 16px; white-space: nowrap;">${statusBadge(item.status)}</td>
      <td style="padding: 12px 16px; color: var(--taupe); white-space: nowrap; font-size: 0.8rem;">${date}</td>
    </tr>`;
  }).join('');

  const tableOrEmpty = recentItems.length === 0
    ? `<p style="color: var(--taupe); font-size: 0.9rem; font-style: italic; margin: 0;">No action items yet — they'll appear here after your first meeting is processed.</p>`
    : `<div style="background-color: #fffdf8; border: 1px solid var(--grain-outline); border-radius: 6px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
          <thead>
            <tr style="border-bottom: 1px solid var(--grain-outline);">
              <th style="text-align: left; padding: 12px 16px; color: var(--taupe); font-weight: 500; letter-spacing: 0.08em; white-space: nowrap;">Meeting</th>
              <th style="text-align: left; padding: 12px 16px; color: var(--taupe); font-weight: 500; letter-spacing: 0.08em;">Action Item</th>
              <th style="text-align: left; padding: 12px 16px; color: var(--taupe); font-weight: 500; letter-spacing: 0.08em;">Status</th>
              <th style="text-align: left; padding: 12px 16px; color: var(--taupe); font-weight: 500; letter-spacing: 0.08em;">Date</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>`;

  const body = `
<div style="display: flex; min-height: 100vh;">
  ${sidebar(email, 'dashboard')}

  <!-- Main content — offset by sidebar width -->
  <div style="margin-left: 160px; flex: 1; padding: 40px 48px;">
    <h1 style="font-size: 1.6rem; font-weight: 400; margin: 0 0 32px; color: var(--text); letter-spacing: 0.15em;">Dashboard</h1>

    <!-- Status card -->
    <div style="
      background-color: #fffdf8;
      border: 1px solid var(--grain-outline);
      border-radius: 6px;
      padding: 28px 32px;
      max-width: 520px;
      margin-bottom: 32px;
    ">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <span style="color: var(--leaf); font-size: 1.1rem;">●</span>
        <h2 style="font-size: 1.1rem; font-weight: 500; margin: 0; color: var(--leaf);">Output is running</h2>
      </div>
      <p style="color: var(--taupe); margin: 0; font-size: 0.9rem;">
        Action items will arrive in Slack after your meetings. Approve to create a Monday.com task, or skip to dismiss.
      </p>
    </div>

    <!-- Recent action items -->
    <h2 style="font-size: 1.1rem; font-weight: 400; margin: 0 0 16px; color: var(--text); letter-spacing: 0.12em;">Recent Action Items</h2>
    ${tableOrEmpty}
  </div>
</div>`;

  return pageShell('Output — Dashboard', body);
}

export function settingsPage(email: string, connections: ConnectionStatus): string {
  const connectionCard = (opts: {
    title: string;
    connected: boolean;
    detail?: string;
    reconnectStep: number;
  }) => {
    const icon = opts.connected ? '✓' : '✗';
    const iconColor = opts.connected ? 'var(--leaf)' : '#c0392b';
    const status = opts.connected ? 'Connected' : 'Not connected';
    const statusColor = opts.connected ? 'var(--leaf)' : '#c0392b';

    return `<div style="
      background-color: #fffdf8;
      border: 1px solid var(--grain-outline);
      border-radius: 6px;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      gap: 16px;
    ">
      <span style="color: ${iconColor}; font-size: 1.2rem; width: 24px; text-align: center;">${icon}</span>
      <div style="flex: 1;">
        <p style="font-size: 0.95rem; font-weight: 500; margin: 0 0 2px; color: var(--text);">${opts.title}</p>
        <p style="font-size: 0.8rem; margin: 0; color: ${statusColor};">${status}${opts.detail ? ` — ${opts.detail}` : ''}</p>
      </div>
      <a href="/onboarding?step=${opts.reconnectStep}" style="
        background-color: transparent;
        color: var(--grain-outline);
        border: 1px solid var(--grain-outline);
        padding: 6px 16px;
        border-radius: 4px;
        text-decoration: none;
        font-size: 0.8rem;
        letter-spacing: 0.08em;
        white-space: nowrap;
      ">Reconnect</a>
    </div>`;
  };

  const body = `
<div style="display: flex; min-height: 100vh;">
  ${sidebar(email, 'settings')}

  <div style="margin-left: 160px; flex: 1; padding: 40px 48px;">
    <h1 style="font-size: 1.6rem; font-weight: 400; margin: 0 0 32px; color: var(--text); letter-spacing: 0.15em;">Settings</h1>

    <div style="display: flex; flex-direction: column; gap: 12px; max-width: 520px;">
      ${connectionCard({
        title: 'Slack',
        connected: !!connections.slackMemberId,
        detail: connections.slackMemberId ?? undefined,
        reconnectStep: 1,
      })}
      ${connectionCard({
        title: 'Granola',
        connected: connections.granolaConnected,
        detail: connections.granolaConnected ? 'API key on file' : undefined,
        reconnectStep: 2,
      })}
      ${connectionCard({
        title: 'Monday.com',
        connected: connections.mondayConnected,
        detail: connections.mondayBoardId ?? undefined,
        reconnectStep: 3,
      })}
    </div>
  </div>
</div>`;

  return pageShell('Output — Settings', body);
}
