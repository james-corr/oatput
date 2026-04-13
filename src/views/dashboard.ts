import { pageShell, sidebar } from './layout';

export interface ConnectionStatus {
  granolaConnected: boolean;
  mondayConnected: boolean;
  mondayBoardId?: string;
  slackMemberId?: string;
}

export function dashboardPage(email: string): string {
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
    ">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
        <span style="color: var(--leaf); font-size: 1.1rem;">●</span>
        <h2 style="font-size: 1.1rem; font-weight: 500; margin: 0; color: var(--leaf);">Oatput is running</h2>
      </div>
      <p style="color: var(--taupe); margin: 0 0 16px; font-size: 0.9rem;">
        Action items will arrive in Slack after your meetings. Approve to create a Monday.com task, or skip to dismiss.
      </p>
      <p style="color: var(--taupe); font-size: 0.8rem; font-style: italic; margin: 0;">
        Recent action items will appear here in a future update.
      </p>
    </div>
  </div>
</div>`;

  return pageShell('Oatput — Dashboard', body);
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

  return pageShell('Oatput — Settings', body);
}
