import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

interface CashbackEntry {
  id: number;
  bank_id: number;
  category_id: number;
  percentage: number;
  month: number;
  year: number;
  photo_local_key: string | null;
  created_at: string;
  bank_name?: string;
  category_name?: string;
}

const cashback = new Hono<{ Bindings: Env }>();

// GET /api/cashback?month=3&year=2025
cashback.get('/', async (c) => {
  const month = c.req.query('month');
  const year = c.req.query('year');

  if (!month || !year) {
    return c.json({ error: 'month and year query params are required' }, 400);
  }

  const result = await c.env.DB.prepare(`
    SELECT
      ce.id, ce.bank_id, ce.category_id, ce.percentage,
      ce.month, ce.year, ce.photo_local_key, ce.created_at,
      b.name AS bank_name,
      cat.name AS category_name
    FROM cashback_entries ce
    JOIN banks b ON b.id = ce.bank_id
    JOIN categories cat ON cat.id = ce.category_id
    WHERE ce.month = ? AND ce.year = ?
    ORDER BY cat.name ASC, ce.percentage DESC
  `).bind(month, year).all<CashbackEntry>();

  return c.json(result.results);
});

cashback.post('/', async (c) => {
  const body = await c.req.json<{
    bank_id: number;
    category_id: number;
    percentage: number;
    month: number;
    year: number;
    photo_local_key?: string;
  }>();

  const { bank_id, category_id, percentage, month, year, photo_local_key } = body;

  if (!bank_id || !category_id || percentage == null || !month || !year) {
    return c.json({ error: 'bank_id, category_id, percentage, month, year are required' }, 400);
  }

  // Обновляем дату последнего обновления банка
  await c.env.DB.prepare(
    "UPDATE banks SET updated_at = datetime('now') WHERE id = ?"
  ).bind(bank_id).run();

  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO cashback_entries (bank_id, category_id, percentage, month, year, photo_local_key)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(bank_id, category_id, percentage, month, year, photo_local_key ?? null).first();
    return c.json(result, 201);
  } catch {
    // При конфликте (уже существует) — обновляем
    const result = await c.env.DB.prepare(`
      UPDATE cashback_entries
      SET percentage = ?, photo_local_key = ?
      WHERE bank_id = ? AND category_id = ? AND month = ? AND year = ?
      RETURNING *
    `).bind(percentage, photo_local_key ?? null, bank_id, category_id, month, year).first();
    return c.json(result, 200);
  }
});

cashback.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ percentage: number; photo_local_key?: string }>();

  if (body.percentage == null) {
    return c.json({ error: 'percentage is required' }, 400);
  }

  const result = await c.env.DB.prepare(`
    UPDATE cashback_entries
    SET percentage = ?, photo_local_key = ?
    WHERE id = ?
    RETURNING *
  `).bind(body.percentage, body.photo_local_key ?? null, id).first();

  if (!result) return c.json({ error: 'Entry not found' }, 404);
  return c.json(result);
});

cashback.delete('/:id', async (c) => {
  const id = c.req.param('id');

  // Получаем запись перед удалением
  const entry = await c.env.DB.prepare(
    'SELECT category_id FROM cashback_entries WHERE id = ?'
  ).bind(id).first<{ category_id: number }>();

  if (!entry) return c.json({ error: 'Entry not found' }, 404);

  await c.env.DB.prepare(
    'DELETE FROM cashback_entries WHERE id = ?'
  ).bind(id).run();

  // Удаляем категорию если у неё больше нет записей
  const remaining = await c.env.DB.prepare(
    'SELECT COUNT(*) as cnt FROM cashback_entries WHERE category_id = ?'
  ).bind(entry.category_id).first<{ cnt: number }>();

  let categoryDeleted = false;
  if (remaining && remaining.cnt === 0) {
    await c.env.DB.prepare(
      'DELETE FROM categories WHERE id = ?'
    ).bind(entry.category_id).run();
    categoryDeleted = true;
  }

  return c.json({ success: true, categoryDeleted });
});

// GET /api/cashback/by-category/:categoryId?month=3&year=2025
cashback.get('/by-category/:categoryId', async (c) => {
  const categoryId = c.req.param('categoryId');
  const month = c.req.query('month');
  const year = c.req.query('year');

  if (!month || !year) {
    return c.json({ error: 'month and year query params are required' }, 400);
  }

  const result = await c.env.DB.prepare(`
    SELECT ce.id, ce.percentage, ce.photo_local_key,
           b.id AS bank_id, b.name AS bank_name
    FROM cashback_entries ce
    JOIN banks b ON b.id = ce.bank_id
    WHERE ce.category_id = ? AND ce.month = ? AND ce.year = ?
    ORDER BY ce.percentage DESC
  `).bind(categoryId, month, year).all();

  return c.json(result.results);
});

export default cashback;
