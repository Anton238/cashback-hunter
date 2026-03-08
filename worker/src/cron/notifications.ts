import { buildPushPayload, type PushSubscription, type PushMessage } from '@block65/webcrypto-web-push';

interface NotificationRule {
  day: number;
  banks: string[];
}

const DEFAULT_BANK_NAMES = [
  'Tbank', 'Яндекс', 'Сбербанк', 'Озон', 'Альфа', 'ВТБ', 'Зенит', 'Газпром', 'МТС', 'Уралсиб',
];

function lastDayOfMonth(date: Date): number {
  return new Date(date.getUTCFullYear(), date.getUTCMonth() + 1, 0).getUTCDate();
}

const NOTIFICATION_SCHEDULE: NotificationRule[] = [
  { day: -1, banks: DEFAULT_BANK_NAMES },
];

interface Env {
  DB: D1Database;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  FRONTEND_ORIGIN: string;
}

interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function handleCron(env: Env): Promise<void> {
  const now = new Date();
  const today = now.getUTCDate();
  const lastDay = lastDayOfMonth(now);

  const todayRules = NOTIFICATION_SCHEDULE.filter(r =>
    r.day === today || (r.day === -1 && today === lastDay),
  );
  if (todayRules.length === 0) return;

  const banksToNotify = todayRules.flatMap(r => r.banks);
  if (banksToNotify.length === 0) return;

  const result = await env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions'
  ).all<StoredSubscription>();

  if (!result.results || result.results.length === 0) return;

  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  const bankList = banksToNotify.join(', ');
  const message: PushMessage = {
    data: {
      title: 'Обновить кэшбэк',
      body: `Пора обновить: ${bankList}`,
      banks: banksToNotify,
      url: `${env.FRONTEND_ORIGIN}/add`,
    },
    options: { ttl: 60 },
  };

  const sendPromises = result.results.map(async (row) => {
    const subscription: PushSubscription = {
      endpoint: row.endpoint,
      expirationTime: null,
      keys: { p256dh: row.p256dh, auth: row.auth },
    };
    try {
      const payload = await buildPushPayload(message, subscription, vapid);
      const res = await fetch(row.endpoint, {
        method: payload.method,
        headers: payload.headers as HeadersInit,
        body: payload.body,
      });
      if (res.status === 410 || res.status === 404) {
        await env.DB.prepare(
          'DELETE FROM push_subscriptions WHERE endpoint = ?'
        ).bind(row.endpoint).run();
      }
    } catch {
      // ignore
    }
  });

  await Promise.allSettled(sendPromises);
}

export { NOTIFICATION_SCHEDULE };
