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

// Creates a per-request Supabase client backed by cookie storage.
// This enables server-side PKCE OAuth without @supabase/ssr.
// The storage adapter maps all Supabase auth keys (session, PKCE verifier, etc.) to cookies.
export function createAuthClient(req: Request, res: Response) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  };

  const storage = {
    getItem: (key: string): string | null => {
      const cookies = req.cookies as Record<string, string | undefined>;
      const val = cookies[key] ?? null;
      if (!val) return null;
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    },
    setItem: (key: string, value: string): void => {
      res.cookie(key, encodeURIComponent(value), cookieOptions);
    },
    removeItem: (key: string): void => {
      res.clearCookie(key, { path: '/' });
    },
  };

  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      storage,
      storageKey: 'sb-auth-token',
      flowType: 'pkce',
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
