import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

const synonyms = new Hono<{ Bindings: Env }>();

synonyms.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT cs.id, cs.category_id, cs.synonym, cat.name AS category_name
     FROM category_synonyms cs
     JOIN categories cat ON cat.id = cs.category_id
     ORDER BY cat.name ASC, cs.synonym ASC`
  ).all();
  return c.json(result.results);
});

synonyms.post('/', async (c) => {
  const body = await c.req.json<{ category_id: number; synonym: string }>();
  const synonym = body.synonym?.trim();
  if (!body.category_id || !synonym) {
    return c.json({ error: 'category_id and synonym are required' }, 400);
  }
  const category = await c.env.DB.prepare(
    'SELECT id FROM categories WHERE id = ?'
  ).bind(body.category_id).first();
  if (!category) {
    return c.json({ error: 'Category not found' }, 404);
  }
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO category_synonyms (category_id, synonym) VALUES (?, ?) RETURNING *'
    ).bind(body.category_id, synonym).first();
    const withName = await c.env.DB.prepare(
      'SELECT cs.id, cs.category_id, cs.synonym, cat.name AS category_name FROM category_synonyms cs JOIN categories cat ON cat.id = cs.category_id WHERE cs.id = ?'
    ).bind((result as { id: number }).id).first();
    return c.json(withName ?? result, 201);
  } catch {
    const existing = await c.env.DB.prepare(
      `SELECT cs.id, cs.category_id, cs.synonym, cat.name AS category_name
       FROM category_synonyms cs JOIN categories cat ON cat.id = cs.category_id
       WHERE cs.category_id = ? AND LOWER(cs.synonym) = LOWER(?)`
    ).bind(body.category_id, synonym).first();
    return c.json(existing, 200);
  }
});

synonyms.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'DELETE FROM category_synonyms WHERE id = ? RETURNING id'
  ).bind(id).first();
  if (!result) return c.json({ error: 'Synonym not found' }, 404);
  return c.json({ success: true });
});

export default synonyms;
