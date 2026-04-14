import type { RequestHandler } from 'express';
import { createAuthClient } from '../services/supabase';

export const requireAuth: RequestHandler = async (req, res, next) => {
  const supabase = createAuthClient(req, res);
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    res.redirect('/login');
    return;
  }

  req.user = { id: user.id, email: user.email! };
  next();
};
