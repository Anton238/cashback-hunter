import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import banks from './routes/banks';
import categories from './routes/categories';
import cashback from './routes/cashback';
import push from './routes/push';
import { handleCron } from './cron/notifications';

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  FRONTEND_ORIGIN: string;
}

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());

app.use('/api/*', async (c, next) => {
  const url = new URL(c.req.url);
  console.log('[Worker]', c.req.method, url.pathname, 'Origin:', c.req.header('Origin') ?? 'none');
  const origin = c.env?.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  return cors({
    origin: [origin, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })(c, next);
});

app.route('/api/banks', banks);
app.route('/api/categories', categories);
app.route('/api/cashback', cashback);
app.route('/api/push', push);

app.get('/api/health', (c) => c.json({ ok: true }));

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(handleCron(env));
  },
};
