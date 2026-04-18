import 'dotenv/config';

// Validate required env vars before importing services that depend on them
const REQUIRED = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ENCRYPTION_KEY',
  'MONDAY_CLIENT_ID', 'MONDAY_CLIENT_SECRET', 'APP_URL', 'ANTHROPIC_API_KEY',
  'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET',
];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[output] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[output] Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import dashboardRouter from './routes/dashboard';
import slackRouter from './routes/slack';
import { loginPage } from './views/login';
import { startScheduler } from './services/scheduler';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(express.urlencoded({
  extended: true,
  verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => { req.rawBody = buf; },
}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(healthRouter);
app.use(authRouter);
app.use(onboardingRouter);
app.use(dashboardRouter);
app.use(slackRouter);

// Root redirect to login
app.get('/', (_req, res) => {
  res.redirect('/login');
});

app.get('/login', (_req, res) => {
  res.send(loginPage());
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[output] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[output] Server running on http://localhost:${PORT}`);
  startScheduler();
});

export default app;
