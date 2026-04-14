import { pageShell } from './layout';

export interface OnboardingPageData {
  userEmail: string;
  errorMessage?: string;
  mondayBoards?: { id: string; name: string }[];
  slackMemberId?: string;
  granolaConnected?: boolean;
  mondayConnected?: boolean;
  boardName?: string;
}

const STEP_LABELS = ['Slack', 'Granola', 'Monday', 'Configure', 'Review', 'Done'];

function stepIndicator(currentStep: number): string {
  const circles = STEP_LABELS.map((label, i) => {
    const n = i + 1;
    const isPast = n < currentStep;
    const isCurrent = n === currentStep;
    const isFuture = n > currentStep;

    const circleBg = isPast || isCurrent
      ? 'background-color: var(--grain); color: var(--text); border: 2px solid var(--grain-outline);'
      : 'background-color: transparent; color: var(--taupe); border: 2px solid var(--taupe);';

    const labelColor = isCurrent ? 'color: var(--text);' : 'color: var(--taupe);';

    return `<div style="display: flex; flex-direction: column; align-items: center; gap: 6px; min-width: 52px;">
      <div style="
        width: 32px; height: 32px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.85rem; font-weight: 500;
        ${circleBg}
      ">${n}</div>
      <span style="font-size: 0.7rem; letter-spacing: 0.1em; ${labelColor}">${label}</span>
    </div>`;
  });

  const connectors = STEP_LABELS.slice(0, -1).map((_, i) => {
    const n = i + 1;
    const color = n < currentStep ? 'var(--grain-outline)' : 'var(--taupe)';
    return `<div style="flex: 1; height: 2px; background-color: ${color}; margin-top: -16px; opacity: 0.5;"></div>`;
  });

  // Interleave circles and connectors
  const items: string[] = [];
  circles.forEach((c, i) => {
    items.push(c);
    if (connectors[i]) items.push(connectors[i]);
  });

  return `<div style="display: flex; align-items: flex-start; gap: 0; margin-bottom: 40px;">
    ${items.join('\n')}
  </div>`;
}

function errorBox(message: string): string {
  return `<div style="
    background-color: #fdf3ec;
    border: 1px solid var(--grain-outline);
    border-radius: 4px;
    padding: 10px 14px;
    margin-bottom: 16px;
    color: var(--grain-outline);
    font-size: 0.9rem;
  ">${message}</div>`;
}

function formInput(opts: {
  name: string;
  type?: string;
  placeholder?: string;
  pattern?: string;
  required?: boolean;
  value?: string;
}): string {
  return `<input
    type="${opts.type ?? 'text'}"
    name="${opts.name}"
    ${opts.placeholder ? `placeholder="${opts.placeholder}"` : ''}
    ${opts.pattern ? `pattern="${opts.pattern}"` : ''}
    ${opts.required !== false ? 'required' : ''}
    ${opts.value ? `value="${opts.value}"` : ''}
    style="
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--grain-outline);
      border-radius: 4px;
      background-color: #fffdf8;
      color: var(--text);
      font-size: 0.95rem;
      margin-bottom: 16px;
    "
  >`;
}

function submitButton(label: string): string {
  return `<button type="submit" style="
    background-color: var(--grain);
    color: var(--text);
    border: 1px solid var(--grain-outline);
    padding: 10px 28px;
    border-radius: 4px;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    letter-spacing: 0.1em;
  ">${label}</button>`;
}

function stepContent(step: number, data: OnboardingPageData): string {
  const err = data.errorMessage ? errorBox(data.errorMessage) : '';

  switch (step) {
    case 1:
      return `
        <h2 style="font-size: 1.4rem; font-weight: 400; margin: 0 0 8px; color: var(--text);">Connect Slack</h2>
        <p style="color: var(--taupe); margin: 0 0 24px; font-size: 0.95rem;">
          Enter your Slack member ID so we know where to send your action items.<br>
          Find it in Slack: click your picture/name at the bottom left → <em>Profile</em> → click the ellipsis (···) → <em>Copy Member ID</em>.<br>
          It begins with <strong>U</strong> followed by 10 uppercase letters or numbers.
        </p>
        ${err}
        <form method="POST" action="/onboarding?step=1">
          ${formInput({ name: 'slack_member_id', placeholder: 'U01234ABCDE', pattern: 'U[A-Z0-9]{10}' })}
          ${submitButton('Continue →')}
        </form>`;

    case 2:
      return `
        <h2 style="font-size: 1.4rem; font-weight: 400; margin: 0 0 8px; color: var(--text);">Connect Granola</h2>
        <p style="color: var(--taupe); margin: 0 0 8px; font-size: 0.95rem;">
          Open Granola → <em>Preferences</em> → <em>API</em> → <em>Generate New API Key</em>.<br>
          Select the <strong>Personal</strong> key type, then paste it below.
        </p>
        ${err}
        <form method="POST" action="/onboarding?step=2">
          ${formInput({ name: 'granola_api_key', type: 'password', placeholder: 'Paste your Granola API key' })}
          ${submitButton('Validate & Continue →')}
        </form>`;

    case 3:
      return `
        <h2 style="font-size: 1.4rem; font-weight: 400; margin: 0 0 8px; color: var(--text);">Connect Monday.com</h2>
        <p style="color: var(--taupe); margin: 0 0 24px; font-size: 0.95rem;">
          Authorize Oatput to create tasks in your Monday.com workspace.
          You'll be redirected to Monday.com and back.
        </p>
        ${err}
        <a href="/auth/monday" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background-color: var(--grain);
          color: var(--text);
          border: 1px solid var(--grain-outline);
          padding: 12px 28px;
          border-radius: 4px;
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 500;
          letter-spacing: 0.1em;
        ">Connect Monday.com →</a>`;

    case 4: {
      const boards = data.mondayBoards ?? [];
      const options = boards.map(
        (b) => `<option value="${b.id}">${b.name}</option>`
      ).join('\n');
      return `
        <h2 style="font-size: 1.4rem; font-weight: 400; margin: 0 0 8px; color: var(--text);">Choose Your Board</h2>
        <p style="color: var(--taupe); margin: 0 0 24px; font-size: 0.95rem;">
          Select the Monday.com board where approved action items should be created.
        </p>
        ${err}
        <form method="POST" action="/onboarding?step=4">
          <select name="monday_board_id" required style="
            width: 100%;
            padding: 10px 14px;
            border: 1px solid var(--grain-outline);
            border-radius: 4px;
            background-color: #fffdf8;
            color: var(--text);
            font-size: 0.95rem;
            margin-bottom: 16px;
            appearance: none;
          ">
            <option value="" disabled selected>Select a board…</option>
            ${options}
          </select>
          ${submitButton('Save & Continue →')}
        </form>`;
    }

    case 5: {
      const check = (ok: boolean | undefined, label: string, value?: string) => {
        const icon = ok ? '✓' : '✗';
        const color = ok ? 'var(--leaf)' : '#c0392b';
        const detail = value ? `<span style="color: var(--taupe); font-size: 0.85rem; margin-left: 8px;">${value}</span>` : '';
        return `<div style="
          display: flex;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid rgba(154,123,58,0.15);
        ">
          <span style="color: ${color}; font-size: 1.1rem; margin-right: 12px; width: 20px; text-align: center;">${icon}</span>
          <span style="flex: 1; font-size: 0.95rem;">${label}</span>
          ${detail}
        </div>`;
      };

      const allGood = !!data.slackMemberId && !!data.granolaConnected && !!data.mondayConnected;

      return `
        <h2 style="font-size: 1.4rem; font-weight: 400; margin: 0 0 8px; color: var(--text);">Review Your Setup</h2>
        <p style="color: var(--taupe); margin: 0 0 24px; font-size: 0.95rem;">
          Everything looks good? Confirm and Oatput will start running.
        </p>
        ${err}
        <div style="margin-bottom: 28px;">
          ${check(!!data.slackMemberId, 'Slack', data.slackMemberId)}
          ${check(data.granolaConnected, 'Granola', data.granolaConnected ? 'API key on file' : undefined)}
          ${check(data.mondayConnected, 'Monday.com', data.boardName ?? undefined)}
        </div>
        ${!allGood ? `<p style="color: var(--grain-outline); font-size: 0.85rem; margin-bottom: 16px;">Please complete all steps before continuing.</p>` : ''}
        <form method="POST" action="/onboarding?step=5">
          <button type="submit" ${!allGood ? 'disabled' : ''} style="
            background-color: ${allGood ? 'var(--grain)' : '#e0d5c0'};
            color: ${allGood ? 'var(--text)' : 'var(--taupe)'};
            border: 1px solid ${allGood ? 'var(--grain-outline)' : '#ccc'};
            padding: 10px 28px;
            border-radius: 4px;
            font-size: 0.95rem;
            font-weight: 500;
            cursor: ${allGood ? 'pointer' : 'not-allowed'};
            letter-spacing: 0.1em;
          ">Looks good →</button>
        </form>`;
    }

    case 6:
      return `
        <h2 style="font-size: 1.4rem; font-weight: 400; margin: 0 0 8px; color: var(--text);">You're all set</h2>
        <p style="color: var(--taupe); margin: 0 0 8px; font-size: 0.95rem;">
          Oatput is now running. After your next meeting in Granola, action items will arrive in your Slack within ~15 minutes for approval.
        </p>
        <p style="color: var(--taupe); margin: 0 0 28px; font-size: 0.9rem; font-style: italic;">
          Approve → Monday.com task is created instantly.<br>
          Deny → dismissed cleanly with no side effects.
        </p>
        <form method="POST" action="/onboarding?step=6">
          ${submitButton('Go to Dashboard →')}
        </form>`;

    default:
      return `<p>Unknown step.</p>`;
  }
}

export function onboardingPage(step: number, data: OnboardingPageData): string {
  const body = `
<div style="min-height: 100vh; background-color: var(--bg); display: flex; align-items: flex-start; justify-content: center; padding: 48px 24px;">
  <div style="width: 100%; max-width: 600px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <img src="/oatPut_logo.png" alt="Oatput" style="width: 100px; margin-bottom: 12px;">
      <p style="color: var(--taupe); font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin: 0;">Setup</p>
    </div>

    ${stepIndicator(step)}

    <!-- Step content card -->
    <div style="
      background-color: #fffdf8;
      border: 1px solid var(--grain-outline);
      border-radius: 6px;
      padding: 32px;
    ">
      ${stepContent(step, data)}
    </div>

  </div>
</div>`;

  return pageShell('Oatput — Setup', body);
}
