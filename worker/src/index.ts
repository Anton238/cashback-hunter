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
  const data = await c.req.json<{ image: string; bankId?: number }>();
  if (typeof data.image !== 'string' || data.image.length > 5_000_000 || !/^data:image\/(jpeg|png|webp);base64,/.test(data.image)) return c.json({ error: 'Invalid image' }, 400);
  if (data.bankId !== undefined && (!Number.isInteger(data.bankId) || data.bankId < 1)) return c.json({ error: 'Invalid bank' }, 400);
  const banks = await c.env.DB.prepare('SELECT id, name FROM banks ORDER BY name').all<{ id: number; name: string }>();
  if (data.bankId && !banks.results.some(b => b.id === data.bankId)) return c.json({ error: 'Bank not found' }, 404);
  const categories = await c.env.DB.prepare('SELECT name FROM categories ORDER BY name LIMIT 200').all<{ name: string }>();
  const corrections = await c.env.DB.prepare(`SELECT cc.bank_id, cc.offer_name, cat.name AS category
    FROM category_corrections cc JOIN categories cat ON cat.id = cc.category_id
    ORDER BY cc.updated_at DESC LIMIT 200`).all<{ bank_id: number; offer_name: string; category: string }>();
  try {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
    try {
    const result = await c.env.AI.run('@cf/google/gemma-4-26b-a4b-it', {
      messages: [{ role: 'user', content: [{ type: 'text', text: `Определи банк по видимым признакам скриншота, затем прочитай предложения. Верни только JSON объект {"bank_id":числовой id банка или null, "items":[{"name":"название на скриншоте","percentage":5,"category":"категория","notes":"лимит и важные условия"}]}. Банк должен быть только из списка: ${JSON.stringify(banks.results)}. Не угадывай при недостатке признаков: возвращай null. Подсказки по банкам: ОТП — ярко-салатовый логотип «отпбанк», тёмные плитки с изображениями категорий; Уралсиб — адрес bonus.uralsibbank.ru, фиолетовые иконки и экран «Приятных покупок! Вы выбрали»; ВТБ — адрес online.vtb.ru, тёмный экран «Кешбэк», синие ссылки «Подробнее»; Озон — синяя плашка ozon банк и экран «Категории в ноябре»; Тбанк — жёлтая плашка T-BANK, экран «Категории в ноябре» и «Т-Путешествия»; Яндекс — логотип Y PAY и SELECT PLUSES, фиолетовые значки плюсов; Сбербанк — тёмный экран с тёмно-зелёной верхней частью, заголовки «Мои категории», «В ноябре», фраза «Повышенный кешбэк бонусами», тонкие зелёные иконки слева от строк категорий и «Частые вопросы и ответы» внизу; логотип может отсутствовать. Подсказки не гарантируют банк; ориентируйся на видимые логотипы и адреса, не на предлагаемые категории. Не придумывай данные. Отдельные магазины, доставки и сервисы относить в отдельную категорию: «Дикси Доставка» не общие «Продукты», «Поезда в Т-Путешествиях» не общий «Транспорт» и не все «Т-Путешествия». Не объединяй технику с ремонтом, ювелирные изделия с общим шоппингом. Разные тарифы одного сервиса можно относить к одной категории, но верни каждое предложение отдельно. Плюсы считай кэшбэком. Существующие категории: ${JSON.stringify(categories.results.map(x => x.name))}. Ранее исправленные соответствия, сгруппированные по bank_id: ${JSON.stringify(corrections.results)}; используй их только для соответствующего банка. Процент укажи числом без знака %. Не включай личные данные.` }, { type: 'image_url', image_url: { url: data.image } }] }], max_tokens: 2048, chat_template_kwargs: { enable_thinking: false },
    } as never) as { choices?: { message?: { content?: string } }[] };
    const raw = result.choices?.[0]?.message?.content ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new SyntaxError('Model response is not JSON');
    const parsed: unknown = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) throw new SyntaxError('Invalid model response');
    const answer = parsed as { bank_id?: unknown; items: unknown[] };
    const predictedId = Number(answer.bank_id);
    const predictedBank = answer.bank_id != null && banks.results.some(b => b.id === predictedId) ? predictedId : null;
    const effectiveBank = data.bankId ?? predictedBank;
    const correctionMap = new Map(corrections.results.filter(x => x.bank_id === effectiveBank).map(x => [x.offer_name.trim().toLocaleLowerCase('ru'), x.category]));
    const items = answer.items;
    const corrected = items.slice(0, 100).map((item: unknown) => {
      if (!item || typeof item !== 'object') return item;
      const row = item as Record<string, unknown>;
      const key = typeof row.name === 'string' ? row.name.trim().toLocaleLowerCase('ru') : '';
      const specificCategory = /дикси\s+доставка/i.test(key) ? 'Дикси Доставка' : /поезд.*т[-\s]?путешеств/i.test(key) ? 'Поезда в Т-Путешествиях' : /ювелирн.*издели/i.test(key) ? 'Ювелирные изделия' : undefined;
      const percent = typeof row.percentage === 'string' ? Number(row.percentage.replace('%', '').replace(',', '.').trim()) : row.percentage;
      return { ...row, percentage: percent, notes: typeof row.notes === 'string' ? row.notes : '', ...(correctionMap.has(key) ? { category: correctionMap.get(key) } : specificCategory ? { category: specificCategory } : {}) };
    });
    return c.json({ bankId: predictedBank, items: corrected });
    } catch (error) {
      lastError = error;
      if (error instanceof Error && /3036|rate.?limit|quota|neurons/i.test(error.message)) break;
    }
    }
    const message = lastError instanceof Error ? lastError.message : '';
    if (/3036|rate.?limit|quota|neurons/i.test(message)) return c.json({ error: 'Лимит распознавания исчерпан. Попробуйте позже.' }, 429);
    if (lastError instanceof SyntaxError) return c.json({ error: 'Модель вернула некорректный ответ. Попробуйте ещё раз.' }, 502);
    console.error('Workers AI recognition failed');
    return c.json({ error: 'Не удалось распознать изображение. Попробуйте ещё раз.' }, 502);
  } catch { return c.json({ error: 'Не удалось подготовить распознавание.' }, 502); }
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

app.get('/api/display-settings', async (c) => {
  const row = await c.env.DB.prepare('SELECT bank_ids, category_ids FROM display_settings WHERE id = 1').first<{ bank_ids: string; category_ids: string }>();
  return c.json(row ? { bankIds: JSON.parse(row.bank_ids), categoryIds: JSON.parse(row.category_ids) } : { bankIds: [], categoryIds: [] });
});

app.put('/api/display-settings', async (c) => {
  const body = await c.req.json().catch(() => null) as { bankIds?: unknown; categoryIds?: unknown } | null;
  const valid = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 500 && v.every(n => Number.isSafeInteger(n) && n > 0) && new Set(v).size === v.length;
  if (!body || !valid(body.bankIds) || !valid(body.categoryIds)) return c.json({ error: 'Некорректные настройки приоритетов' }, 400);
  await c.env.DB.prepare('INSERT INTO display_settings (id, bank_ids, category_ids) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET bank_ids = excluded.bank_ids, category_ids = excluded.category_ids')
    .bind(JSON.stringify(body.bankIds), JSON.stringify(body.categoryIds)).run();
  return c.json({ bankIds: body.bankIds, categoryIds: body.categoryIds });
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
