import { Hono } from 'hono';
import { NOTIFICATION_SCHEDULE } from '../cron/notifications';

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
}

function lastDayOfMonth(date: Date): number {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
}

function resolveSchedule(): { day: number; banks: string[] }[] {
  const now = new Date();
  const lastDay = lastDayOfMonth(now);
  return NOTIFICATION_SCHEDULE.map(({ day, banks }) => ({
    day: day === -1 ? lastDay : day,
    banks,
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
  const banks = todayRules.flatMap(r => r.banks);
  return c.json({ banks });
});

push.get('/schedule', (c) => {
  return c.json(resolveSchedule());
});

export default push;
