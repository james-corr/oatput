import 'dotenv/config';

// Validate required env vars before importing services that depend on them
const REQUIRED = [
  'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'ENCRYPTION_KEY',
  'MONDAY_CLIENT_ID', 'MONDAY_CLIENT_SECRET', 'APP_URL',
];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`[oatput] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[oatput] Copy .env.example to .env and fill in the values.');
  process.exit(1);
}

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';

import healthRouter from './routes/health';
import authRouter from './routes/auth';
import onboardingRouter from './routes/onboarding';
import dashboardRouter from './routes/dashboard';
import { loginPage } from './views/login';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(healthRouter);
app.use(authRouter);
app.use(onboardingRouter);
app.use(dashboardRouter);

// Root redirect to login
app.get('/', (_req, res) => {
  res.redirect('/login');
});

app.get('/login', (_req, res) => {
  res.send(loginPage());
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[oatput] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[oatput] Server running on http://localhost:${PORT}`);
});

export default app;
