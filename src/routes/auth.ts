import { Router } from 'express';
import { randomBytes } from 'crypto';
import { createAuthClient, serviceClient } from '../services/supabase';
import { encrypt } from '../services/encryption';
import { getMondayAuthUrl, exchangeMondayCode } from '../services/monday';
import { requireAuth } from '../middleware/auth';

const router = Router();

// GET /auth/google — initiates Google OAuth via Supabase PKCE flow
router.get('/auth/google', async (req, res) => {
  const supabase = createAuthClient(req, res);
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appUrl}/auth/callback`,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error || !data.url) {
    console.error('[auth] Google OAuth init error:', error?.message);
    res.redirect('/login?error=oauth_init_failed');
    return;
  }

  res.redirect(data.url);
});

// GET /auth/callback — Supabase redirects here after Google OAuth with ?code=
router.get('/auth/callback', async (req, res) => {
  const code = req.query.code as string | undefined;

  if (!code) {
    res.redirect('/login?error=missing_code');
    return;
  }

  const supabase = createAuthClient(req, res);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[auth] Session exchange error:', error?.message);
    res.redirect('/login?error=session_exchange_failed');
    return;
  }

  const userId = data.session.user.id;

  const { data: userData, error: userError } = await serviceClient
    .from('users')
    .select('onboarding_complete')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    // User row may not exist yet if trigger hasn't fired — redirect to onboarding
    console.warn('[auth] Could not fetch user row:', userError?.message);
    res.redirect('/onboarding?step=1');
    return;
  }

  res.redirect(userData.onboarding_complete ? '/dashboard' : '/onboarding?step=1');
});

// GET /auth/monday — starts Monday.com OAuth (requires logged-in user)
router.get('/auth/monday', requireAuth, (req, res) => {
  const state = randomBytes(16).toString('hex');

  res.cookie('monday_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000, // 10 minutes in ms
    path: '/',
  });

  res.redirect(getMondayAuthUrl(state));
});

// GET /auth/monday/callback — Monday redirects here after authorization
router.get('/auth/monday/callback', requireAuth, async (req, res) => {
  // User denied or error from Monday
  if (req.query.error) {
    res.redirect('/onboarding?step=3&error=monday_denied');
    return;
  }

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;
  const storedState = req.cookies.monday_oauth_state as string | undefined;

  if (!code || !state || !storedState || state !== storedState) {
    res.redirect('/onboarding?step=3&error=state_mismatch');
    return;
  }

  // Clear the state cookie immediately
  res.clearCookie('monday_oauth_state', { path: '/' });

  const accessToken = await exchangeMondayCode(code).catch((err: unknown) => {
    console.error('[auth] Monday code exchange error:', err);
    return null;
  });

  if (!accessToken) {
    res.redirect('/onboarding?step=3&error=monday_oauth_failed');
    return;
  }

  const encryptedToken = encrypt(accessToken);
  const userId = req.user!.id;

  const { error: upsertError } = await serviceClient
    .from('user_credentials')
    .upsert(
      { user_id: userId, service: 'monday', encrypted_token: encryptedToken },
      { onConflict: 'user_id,service' }
    );

  if (upsertError) {
    console.error('[auth] Monday credential upsert error:', upsertError.message);
    res.redirect('/onboarding?step=3&error=monday_oauth_failed');
    return;
  }

  res.redirect('/onboarding?step=4');
});

// GET /auth/logout
router.get('/auth/logout', async (req, res) => {
  const supabase = createAuthClient(req, res);
  await supabase.auth.signOut().catch(() => {}); // signOut calls removeItem on storage (clears cookie)
  res.redirect('/login');
});

export default router;
