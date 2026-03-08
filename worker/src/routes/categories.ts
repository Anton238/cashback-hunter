import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

const categories = new Hono<{ Bindings: Env }>();

categories.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM categories ORDER BY name ASC'
  ).all();
  return c.json(result.results);
});

categories.post('/', async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: 'Category name is required' }, 400);
  }
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO categories (name) VALUES (?) RETURNING *'
    ).bind(body.name.trim()).first();
    return c.json(result, 201);
  } catch {
    // Возвращаем существующую категорию при конфликте
    const existing = await c.env.DB.prepare(
      'SELECT * FROM categories WHERE name = ?'
    ).bind(body.name.trim()).first();
    return c.json(existing, 200);
  }
});

categories.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: 'Category name is required' }, 400);
  }
  const result = await c.env.DB.prepare(
    'UPDATE categories SET name = ? WHERE id = ? RETURNING *'
  ).bind(body.name.trim(), id).first();
  if (!result) return c.json({ error: 'Category not found' }, 404);
  return c.json(result);
});

categories.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'DELETE FROM categories WHERE id = ? RETURNING id'
  ).bind(id).first();
  if (!result) return c.json({ error: 'Category not found' }, 404);
  return c.json({ success: true });
});

export default categories;
