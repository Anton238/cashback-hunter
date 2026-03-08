import { Hono } from 'hono';
import { NOTIFICATION_SCHEDULE, sendTestPush } from '../cron/notifications';

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT?: string;
  FRONTEND_ORIGIN: string;
}

function lastDayOfMonth(date: Date): number {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
}

function resolveSchedule(): { day: number }[] {
  const now = new Date();
  const lastDay = lastDayOfMonth(now);
  return NOTIFICATION_SCHEDULE.map(({ day }) => ({
    day: day === -1 ? lastDay : day,
  }));
}

const push = new Hono<{ Bindings: Env }>();

push.get('/vapid-public-key', (c) => {
  return c.json({ key: c.env.VAPID_PUBLIC_KEY });
});

push.post('/subscribe', async (c) => {
  const body = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'Invalid subscription object' }, 400);
  }

  await c.env.DB.prepare(`
    INSERT INTO push_subscriptions (endpoint, p256dh, auth)
    VALUES (?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth
  `).bind(body.endpoint, body.keys.p256dh, body.keys.auth).run();

  return c.json({ success: true }, 201);
});

push.delete('/subscribe', async (c) => {
  const body = await c.req.json<{ endpoint: string }>();
  if (!body.endpoint) return c.json({ error: 'endpoint is required' }, 400);

  await c.env.DB.prepare(
    'DELETE FROM push_subscriptions WHERE endpoint = ?'
  ).bind(body.endpoint).run();

  return c.json({ success: true });
});

push.get('/schedule/today', (c) => {
  const now = new Date();
  const today = now.getUTCDate();
  const lastDay = lastDayOfMonth(now);
  const todayRules = NOTIFICATION_SCHEDULE.filter(r =>
    r.day === today || (r.day === -1 && today === lastDay),
  );
  return c.json({ reminder: todayRules.length > 0 });
});

push.get('/schedule', (c) => {
  return c.json(resolveSchedule());
});

push.post('/test', async (c) => {
  const body = await c.req.json<{ endpoint: string }>();
  if (!body?.endpoint) return c.json({ error: 'endpoint is required' }, 400);
  const row = await c.env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = ?'
  ).bind(body.endpoint).first<{ endpoint: string; p256dh: string; auth: string }>();
  if (!row) return c.json({ error: 'Subscription not found' }, 404);
  try {
    await sendTestPush(c.env, row);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default push;
