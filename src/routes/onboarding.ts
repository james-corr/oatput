import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { serviceClient } from '../services/supabase';
import { encrypt, decrypt } from '../services/encryption';
import { getMondayBoards } from '../services/monday';
import { onboardingPage } from '../views/onboarding';

const router = Router();

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// GET /onboarding — render the current step
router.get('/onboarding', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const requestedStep = clamp(parseInt(req.query.step as string) || 1, 1, 6);

  // Load current state from DB
  const [usersResult, credsResult] = await Promise.all([
    serviceClient.from('users').select('slack_member_id, onboarding_complete').eq('id', userId).single(),
    serviceClient.from('user_credentials').select('service, encrypted_token, monday_board_id').eq('user_id', userId),
  ]);

  const user = usersResult.data;
  const creds = credsResult.data ?? [];

  if (user?.onboarding_complete) {
    res.redirect('/dashboard');
    return;
  }

  const granolaConnected = creds.some((c) => c.service === 'granola');
  const mondayCred = creds.find((c) => c.service === 'monday');
  const mondayConnected = !!mondayCred;

  // Step access guard — find the earliest allowed step
  let minAllowedStep = 1;
  if (user?.slack_member_id) minAllowedStep = 2;
  if (user?.slack_member_id && granolaConnected) minAllowedStep = 3;
  if (user?.slack_member_id && granolaConnected && mondayConnected) minAllowedStep = 4;
  // Steps 5-6 are accessible once step 4 is reachable
  if (minAllowedStep >= 4) minAllowedStep = Math.min(requestedStep, 6);

  const step = requestedStep <= minAllowedStep ? requestedStep : minAllowedStep;

  // For step 4, fetch Monday boards
  let mondayBoards: { id: string; name: string }[] | undefined;
  let mondayBoardFetchError: string | undefined;
  if (step === 4 && mondayCred) {
    try {
      mondayBoards = await getMondayBoards(decrypt(mondayCred.encrypted_token));
    } catch (err: unknown) {
      console.error('[onboarding] Failed to fetch Monday boards:', err);
      mondayBoardFetchError = 'Could not load your Monday.com boards. Please try reconnecting Monday.com.';
      mondayBoards = [];
    }
  }

  // Board name for review step (step 5)
  let boardName: string | undefined;
  if (mondayCred?.monday_board_id) {
    if (step === 5) {
      const boards = await getMondayBoards(decrypt(mondayCred.encrypted_token)).catch(() => [] as { id: string; name: string }[]);
      boardName = boards.find((b) => b.id === mondayCred.monday_board_id)?.name ?? `Board #${mondayCred.monday_board_id}`;
    } else {
      boardName = `Board #${mondayCred.monday_board_id}`;
    }
  }

  const html = onboardingPage(step, {
    userEmail: req.user!.email,
    errorMessage: mondayBoardFetchError,
    mondayBoards,
    slackMemberId: user?.slack_member_id ?? undefined,
    granolaConnected,
    mondayConnected,
    boardName,
  });

  res.send(html);
});

// POST /onboarding — handle step submissions
router.post('/onboarding', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const step = clamp(parseInt(req.query.step as string) || 1, 1, 6);

  if (step === 1) {
    const slackMemberId = (req.body.slack_member_id as string ?? '').trim().toUpperCase();

    if (!/^U[A-Z0-9]{10}$/.test(slackMemberId)) {
      const html = onboardingPage(1, {
        userEmail: req.user!.email,
        errorMessage: 'Invalid Slack member ID. It must start with U followed by exactly 10 uppercase letters or numbers (e.g. U01234ABCDE).',
      });
      res.send(html);
      return;
    }

    const { error } = await serviceClient
      .from('users')
      .update({ slack_member_id: slackMemberId })
      .eq('id', userId);

    if (error) {
      console.error('[onboarding] Step 1 update error:', error.message);
      res.redirect('/onboarding?step=1');
      return;
    }

    res.redirect('/onboarding?step=2');
    return;
  }

  if (step === 2) {
    const apiKey = (req.body.granola_api_key as string ?? '').trim();

    if (!apiKey) {
      const html = onboardingPage(2, {
        userEmail: req.user!.email,
        errorMessage: 'Please enter your Granola API key.',
      });
      res.send(html);
      return;
    }

    // Validate the key against the Granola API
    const valid = await fetch('https://public-api.granola.ai/v1/notes?limit=1', {
      headers: { Authorization: `Bearer ${apiKey}` },
    }).then((r) => r.ok).catch(() => false);

    if (!valid) {
      const html = onboardingPage(2, {
        userEmail: req.user!.email,
        errorMessage: 'Invalid API key. Please check your Granola API key and try again.',
      });
      res.send(html);
      return;
    }

    const encryptedToken = encrypt(apiKey);
    const { error } = await serviceClient
      .from('user_credentials')
      .upsert(
        { user_id: userId, service: 'granola', encrypted_token: encryptedToken },
        { onConflict: 'user_id,service' }
      );

    if (error) {
      console.error('[onboarding] Step 2 upsert error:', error.message);
      res.redirect('/onboarding?step=2');
      return;
    }

    res.redirect('/onboarding?step=3');
    return;
  }

  if (step === 3) {
    // Step 3 has no POST form — Monday connect is a GET redirect to /auth/monday
    res.redirect('/onboarding?step=3');
    return;
  }

  if (step === 4) {
    const mondayBoardId = (req.body.monday_board_id as string ?? '').trim();

    if (!mondayBoardId) {
      const mondayCredResult = await serviceClient
        .from('user_credentials')
        .select('encrypted_token')
        .eq('user_id', userId)
        .eq('service', 'monday')
        .single();
      const boards = mondayCredResult.data
        ? await getMondayBoards(decrypt(mondayCredResult.data.encrypted_token)).catch(() => [] as { id: string; name: string }[])
        : [];
      const html = onboardingPage(4, {
        userEmail: req.user!.email,
        errorMessage: 'Please select a board.',
        mondayBoards: boards,
      });
      res.send(html);
      return;
    }

    // Verify the board ID belongs to the user
    const mondayCredResult = await serviceClient
      .from('user_credentials')
      .select('encrypted_token')
      .eq('user_id', userId)
      .eq('service', 'monday')
      .single();

    if (!mondayCredResult.data) {
      res.redirect('/onboarding?step=3');
      return;
    }

    // Validate board exists in user's list; if fetch fails, trust the submitted ID
    const boards = await getMondayBoards(decrypt(mondayCredResult.data.encrypted_token)).catch(() => null);
    if (boards !== null) {
      const boardExists = boards.some((b) => b.id === mondayBoardId);
      if (!boardExists) {
        const html = onboardingPage(4, {
          userEmail: req.user!.email,
          errorMessage: 'Board not found. Please select a board from the list.',
          mondayBoards: boards,
        });
        res.send(html);
        return;
      }
    }

    const { error } = await serviceClient
      .from('user_credentials')
      .update({ monday_board_id: mondayBoardId })
      .eq('user_id', userId)
      .eq('service', 'monday');

    if (error) {
      console.error('[onboarding] Step 4 update error:', error.message);
      res.redirect('/onboarding?step=4');
      return;
    }

    res.redirect('/onboarding?step=5');
    return;
  }

  if (step === 5) {
    // Step 5 is just confirmation — no data to save
    res.redirect('/onboarding?step=6');
    return;
  }

  if (step === 6) {
    const { error } = await serviceClient
      .from('users')
      .update({ onboarding_complete: true })
      .eq('id', userId);

    if (error) {
      console.error('[onboarding] Step 6 update error:', error.message);
      res.redirect('/onboarding?step=6');
      return;
    }

    res.redirect('/dashboard');
    return;
  }

  // Fallback
  res.redirect('/onboarding?step=1');
});

export default router;
