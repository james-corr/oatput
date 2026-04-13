import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { serviceClient } from '../services/supabase';
import { decrypt } from '../services/encryption';
import { getMondayBoards } from '../services/monday';
import { dashboardPage, settingsPage } from '../views/dashboard';

const router = Router();

// GET /dashboard
router.get('/dashboard', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const { data: user, error } = await serviceClient
    .from('users')
    .select('onboarding_complete')
    .eq('id', userId)
    .single();

  if (error || !user) {
    res.redirect('/login');
    return;
  }

  if (!user.onboarding_complete) {
    res.redirect('/onboarding?step=1');
    return;
  }

  res.send(dashboardPage(req.user!.email));
});

// GET /settings
router.get('/settings', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const [usersResult, credsResult] = await Promise.all([
    serviceClient.from('users').select('slack_member_id').eq('id', userId).single(),
    serviceClient.from('user_credentials').select('service, encrypted_token, monday_board_id').eq('user_id', userId),
  ]);

  const user = usersResult.data;
  const creds = credsResult.data ?? [];

  const granolaConnected = creds.some((c) => c.service === 'granola');
  const mondayCred = creds.find((c) => c.service === 'monday');
  const mondayConnected = !!mondayCred;

  // Try to get Monday board ID for display
  let mondayBoardId: string | undefined;
  if (mondayCred?.monday_board_id) {
    mondayBoardId = mondayCred.monday_board_id;
  }

  res.send(settingsPage(req.user!.email, {
    granolaConnected,
    mondayConnected,
    mondayBoardId,
    slackMemberId: user?.slack_member_id ?? undefined,
  }));
});

export default router;
