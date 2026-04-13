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
  return `${MONDAY_AUTH_URL}?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&response_type=code`;
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
    body: JSON.stringify({ query: '{ boards(limit: 50) { id name board_kind } }' }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[monday] Boards query failed (${response.status}): ${text}`);
  }

  const data = (await response.json()) as {
    data?: { boards?: { id: string; name: string; board_kind?: string }[] };
    errors?: { message: string }[];
  };

  if (data.errors?.length) {
    throw new Error(`[monday] GraphQL error: ${data.errors[0].message}`);
  }

  const boards = data.data?.boards ?? [];
  // Filter out sub-item boards which are internal noise
  return boards
    .filter((b) => b.board_kind !== 'sub_items_board')
    .map((b) => ({ id: b.id, name: b.name }));
}

// Stub — full implementation in Phase 5
export async function createMondayTask(
  _accessToken: string,
  _boardId: string,
  _itemName: string
): Promise<string> {
  console.log('[monday] createMondayTask stub — Phase 5');
  return '';
}
