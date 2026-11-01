import { Hono } from 'hono';
import { cors } from 'hono/cors';
import banks from './routes/banks';
import categories from './routes/categories';
import cashback from './routes/cashback';
import push from './routes/push';
import synonyms from './routes/synonyms';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { handleCron } from './cron/notifications';

interface Env {
  DB: D1Database;
  AI: Ai;
  AI_LIMITER: { limit(input: { key: string }): Promise<{ success: boolean }> };
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT?: string;
  FRONTEND_ORIGIN: string;
}

const app = new Hono<{ Bindings: Env }>();

// Never log request bodies, screenshots or Access tokens.
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const origin = c.req.header('Origin');
  if (origin && origin !== c.env.FRONTEND_ORIGIN) return c.json({ error: 'Forbidden origin' }, 403);
  const domain = c.env.ACCESS_TEAM_DOMAIN;
  const audience = c.env.ACCESS_AUD;
  // Public mode is intentional until Access is configured. Partial configuration fails closed.
  if (!domain && !audience) return next();
  if (!domain || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) return c.json({ error: 'Access is not configured' }, 503);
  const token = c.req.header('Cf-Access-Jwt-Assertion');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const issuer = `https://${domain}`;
    await jwtVerify(token, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)), { issuer, audience, algorithms: ['RS256'] });
  } catch { return c.json({ error: 'Unauthorized' }, 401); }
  return next();
});

app.use('/api/*', async (c, next) => {
  const origin = c.env?.FRONTEND_ORIGIN ?? 'http://localhost:5173';
  return cors({
    origin: [origin, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
  })(c, next);
});

app.post('/api/recognize', async (c) => {
  const client = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const quota = await c.env.AI_LIMITER.limit({ key: client });
  if (!quota.success) return c.json({ error: 'Слишком много запросов, попробуйте через минуту.' }, 429);
  const data = await c.req.json<{ image: string; bankId: number }>();
  if (typeof data.image !== 'string' || data.image.length > 5_000_000 || !/^data:image\/(jpeg|png|webp);base64,/.test(data.image)) return c.json({ error: 'Invalid image' }, 400);
  if (!Number.isInteger(data.bankId) || data.bankId < 1) return c.json({ error: 'Invalid bank' }, 400);
  const bank = await c.env.DB.prepare('SELECT id FROM banks WHERE id = ?').bind(data.bankId).first();
  if (!bank) return c.json({ error: 'Bank not found' }, 404);
  const categories = await c.env.DB.prepare('SELECT name FROM categories ORDER BY name LIMIT 200').all<{ name: string }>();
  const corrections = await c.env.DB.prepare(`SELECT cc.offer_name, cat.name AS category
    FROM category_corrections cc JOIN categories cat ON cat.id = cc.category_id
    WHERE cc.bank_id = ? ORDER BY cc.updated_at DESC LIMIT 200`).bind(data.bankId).all<{ offer_name: string; category: string }>();
  try {
    const result = await c.env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
      messages: [{ role: 'user', content: [{ type: 'text', text: `Прочитай все предложения кэшбэка на изображении. Верни только JSON массив объектов {"name":"название на скриншоте","percentage":5,"category":"подходящая существующая категория или новая","notes":"лимит и важные условия"}. Не придумывай данные. Существующие категории: ${JSON.stringify(categories.results.map(x => x.name))}. Ранее пользователь исправил соответствия для этого банка: ${JSON.stringify(corrections.results)}. Используй эти исправления для совпадающих названий. Процент укажи числом без знака %. Не включай личные данные.` }, { type: 'image_url', image_url: { url: data.image } }] }], max_tokens: 2048, chat_template_kwargs: { enable_thinking: false },
    } as never) as { choices?: { message?: { content?: string } }[] };
    const raw = result.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return c.json({ error: 'Не удалось прочитать ответ модели. Попробуйте другое изображение или ручной ввод.' }, 422);
    const items: unknown = JSON.parse(match[0]);
    if (!Array.isArray(items)) return c.json({ error: 'Некорректный ответ модели' }, 422);
    const correctionMap = new Map(corrections.results.map(x => [x.offer_name.trim().toLocaleLowerCase('ru'), x.category]));
    const corrected = items.slice(0, 100).map((item: unknown) => {
      if (!item || typeof item !== 'object') return item;
      const row = item as Record<string, unknown>;
      const key = typeof row.name === 'string' ? row.name.trim().toLocaleLowerCase('ru') : '';
      const percent = typeof row.percentage === 'string' ? Number(row.percentage.replace('%', '').replace(',', '.').trim()) : row.percentage;
      return { ...row, percentage: percent, notes: typeof row.notes === 'string' ? row.notes : '', ...(correctionMap.has(key) ? { category: correctionMap.get(key) } : {}) };
    });
    return c.json({ items: corrected });
  } catch { return c.json({ error: 'Распознавание недоступно. Проверьте квоту Workers AI и настройки модели.' }, 502); }
});

app.post('/api/category-corrections', async (c) => {
  const body = await c.req.json<{ bankId: number; categoryId: number; offerName: string }>();
  const name = typeof body.offerName === 'string' ? body.offerName.trim() : '';
  if (!Number.isInteger(body.bankId) || !Number.isInteger(body.categoryId) || !name || name.length > 200) return c.json({ error: 'Invalid correction' }, 400);
  const bank = await c.env.DB.prepare('SELECT id FROM banks WHERE id = ?').bind(body.bankId).first();
  const category = await c.env.DB.prepare('SELECT id FROM categories WHERE id = ?').bind(body.categoryId).first();
  if (!bank || !category) return c.json({ error: 'Bank or category not found' }, 404);
  await c.env.DB.prepare(`INSERT INTO category_corrections (bank_id, offer_key, offer_name, category_id)
    VALUES (?, ?, ?, ?) ON CONFLICT(bank_id, offer_key) DO UPDATE SET
    offer_name = excluded.offer_name, category_id = excluded.category_id, updated_at = datetime('now')`)
    .bind(body.bankId, name.toLocaleLowerCase('ru'), name, body.categoryId).run();
  return c.json({ success: true });
});

app.route('/api/banks', banks);
app.route('/api/categories', categories);
app.route('/api/synonyms', synonyms);
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
