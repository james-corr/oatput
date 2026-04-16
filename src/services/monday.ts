const MONDAY_AUTH_URL = 'https://auth.monday.com/oauth2/authorize';
const MONDAY_TOKEN_URL = 'https://auth.monday.com/oauth2/token';
const MONDAY_API_URL = 'https://api.monday.com/v2';

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`[monday] Missing required env var: ${key}`);
  return val;
}

export function getMondayAuthUrl(state: string): string {
  const clientId = requireEnv('MONDAY_CLIENT_ID');
  const appUrl = requireEnv('APP_URL');
  const redirectUri = encodeURIComponent(`${appUrl}/auth/monday/callback`);
  // boards:read — list boards; boards:write — create items (Phase 5)
  const scope = encodeURIComponent('boards:read boards:write');
  return `${MONDAY_AUTH_URL}?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&response_type=code&scope=${scope}`;
}

export async function exchangeMondayCode(code: string): Promise<string> {
  const clientId = requireEnv('MONDAY_CLIENT_ID');
  const clientSecret = requireEnv('MONDAY_CLIENT_SECRET');
  const appUrl = requireEnv('APP_URL');
  const redirectUri = `${appUrl}/auth/monday/callback`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(MONDAY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[monday] Token exchange failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('[monday] Token exchange response missing access_token');
  }
  return data.access_token;
}

export async function getMondayBoards(accessToken: string): Promise<{ id: string; name: string }[]> {
  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query: '{ boards(limit: 50) { id name } }' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[monday] Boards query failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data?: { boards?: { id: string; name: string }[] };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(`[monday] GraphQL error: ${data.errors[0].message}`);
  }

  return (data.data?.boards ?? []).map((b) => ({ id: b.id, name: b.name }));
}

// Creates a Monday.com task on the user's configured board.
// Returns the item URL (e.g. https://workspace.monday.com/boards/.../pulses/...) or '' if unavailable.
// Throws on HTTP or GraphQL errors so the caller can apply retry logic.
export async function createMondayTask(
  accessToken: string,
  boardId: string,
  itemName: string
): Promise<string> {
  const boardIdInt = parseInt(boardId, 10);
  if (isNaN(boardIdInt)) {
    throw new Error(`[monday] Invalid board ID: ${boardId}`);
  }

  const query = `
    mutation CreateItem($boardId: ID!, $itemName: String!) {
      create_item(board_id: $boardId, item_name: $itemName) {
        id
        url
      }
    }
  `;

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      query,
      variables: { boardId: boardIdInt, itemName },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[monday] create_item failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data?: { create_item?: { id: string; url?: string } };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(`[monday] GraphQL error: ${data.errors[0].message}`);
  }

  if (!data.data?.create_item?.id) {
    throw new Error('[monday] create_item returned no item ID');
  }

  return data.data.create_item.url ?? '';
}
