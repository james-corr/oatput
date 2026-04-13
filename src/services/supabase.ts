import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error(
    'Missing required Supabase env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY'
  );
}

// Used for auth flows (respects Row Level Security)
export const anonClient = createClient(supabaseUrl, supabaseAnonKey);

// Used for server-side DB operations (bypasses RLS — never expose to clients)
export const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

// Browser cookie limit is ~4096 bytes. A Supabase session JSON (~3600+ chars) exceeds this
// after URL-encoding. We use base64url encoding (valid cookie chars, no re-encoding needed)
// and split values larger than CHUNK_SIZE across multiple cookies (key.0, key.1, ...).
const CHUNK_SIZE = 3600;

function encodeVal(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decodeVal(encoded: string): string {
  return Buffer.from(encoded, 'base64url').toString('utf8');
}

// Creates a per-request Supabase client backed by chunked cookie storage.
// This enables server-side PKCE OAuth without @supabase/ssr.
export function createAuthClient(req: Request, res: Response) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/',
    encode: String, // prevent cookie package from re-encoding our base64url value
  };

  const cookies = req.cookies as Record<string, string | undefined>;

  const storage = {
    getItem: (key: string): string | null => {
      // Try single-cookie key first
      const direct = cookies[key];
      if (direct !== undefined) {
        try { return decodeVal(direct); } catch { return null; }
      }
      // Try chunked (key.0, key.1, ...)
      if (cookies[`${key}.0`] === undefined) return null;
      let encoded = '';
      let i = 0;
      while (cookies[`${key}.${i}`] !== undefined) {
        encoded += cookies[`${key}.${i}`];
        i++;
      }
      try { return decodeVal(encoded); } catch { return null; }
    },

    setItem: (key: string, value: string): void => {
      const encoded = encodeVal(value);
      if (encoded.length <= CHUNK_SIZE) {
        res.cookie(key, encoded, cookieOptions);
        // Clear any stale chunk cookies from a previous larger value
        for (let i = 0; i < 5; i++) res.clearCookie(`${key}.${i}`, { path: '/' });
      } else {
        // Split across multiple cookies
        res.clearCookie(key, { path: '/' });
        let idx = 0;
        for (let offset = 0; offset < encoded.length; offset += CHUNK_SIZE) {
          res.cookie(`${key}.${idx}`, encoded.slice(offset, offset + CHUNK_SIZE), cookieOptions);
          idx++;
        }
        // Clear any stale extra chunk cookies from a previous longer value
        for (let i = idx; i < idx + 5; i++) res.clearCookie(`${key}.${i}`, { path: '/' });
      }
    },

    removeItem: (key: string): void => {
      res.clearCookie(key, { path: '/' });
      for (let i = 0; i < 10; i++) res.clearCookie(`${key}.${i}`, { path: '/' });
    },
  };

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage,
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
