import { Router } from 'express';
import { serviceClient } from '../services/supabase';

const router = Router();

router.get('/health', async (_req, res) => {
  try {
    const { error } = await serviceClient.from('users').select('id').limit(1);
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    console.error('[output] Health check DB error:', err);
    res.status(503).json({ status: 'error', db: 'unreachable' });
  }
});

export default router;
