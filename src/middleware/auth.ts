import type { RequestHandler } from 'express';
import { createAuthClient } from '../services/supabase';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const cookieKeys = Object.keys(req.cookies ?? {});
  console.log('[requireAuth]', req.path, '| cookies present:', cookieKeys);

  const supabase = createAuthClient(req, res);
  const { data: { user }, error } = await supabase.auth.getUser();

  console.log('[requireAuth] getUser result — user:', user?.id ?? null, '| error:', error?.message ?? null);

  if (error || !user) {
    res.redirect('/login');
    return;
  }

  req.user = { id: user.id, email: user.email! };
  next();
};
