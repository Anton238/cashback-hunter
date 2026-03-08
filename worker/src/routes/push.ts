import { Hono } from 'hono';
import { NOTIFICATION_SCHEDULE } from '../cron/notifications';

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
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

// Возвращает сегодняшнее расписание (для fallback-баннера на фронте)
push.get('/schedule/today', (c) => {
  const today = new Date().getUTCDate();
  const todayRules = NOTIFICATION_SCHEDULE.filter(r => r.day === today);
  const banks = todayRules.flatMap(r => r.banks);
  return c.json({ banks });
});

// Полное расписание для страницы настроек
push.get('/schedule', (c) => {
  return c.json(NOTIFICATION_SCHEDULE);
});

export default push;
