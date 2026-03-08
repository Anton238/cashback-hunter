import { Hono } from 'hono';

interface Env {
  DB: D1Database;
}

const banks = new Hono<{ Bindings: Env }>();

banks.get('/', async (c) => {
  const result = await c.env.DB.prepare(
    'SELECT * FROM banks ORDER BY name ASC'
  ).all();
  return c.json(result.results);
});

banks.get('/:id', async (c) => {
  const id = c.req.param('id');
  const bank = await c.env.DB.prepare(
    'SELECT * FROM banks WHERE id = ?'
  ).bind(id).first();
  if (!bank) return c.json({ error: 'Bank not found' }, 404);
  return c.json(bank);
});

banks.post('/', async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) {
    return c.json({ error: 'Bank name is required' }, 400);
  }
  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO banks (name) VALUES (?) RETURNING *'
    ).bind(body.name.trim()).first();
    return c.json(result, 201);
  } catch {
    return c.json({ error: 'Bank with this name already exists' }, 409);
  }
});

banks.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<{ name?: string; updated_at?: string }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name?.trim()) {
    fields.push('name = ?');
    values.push(body.name.trim());
  }
  if (body.updated_at !== undefined) {
    fields.push('updated_at = ?');
    values.push(body.updated_at);
  }

  if (fields.length === 0) return c.json({ error: 'Nothing to update' }, 400);

  values.push(id);
  const result = await c.env.DB.prepare(
    `UPDATE banks SET ${fields.join(', ')} WHERE id = ? RETURNING *`
  ).bind(...values).first();

  if (!result) return c.json({ error: 'Bank not found' }, 404);
  return c.json(result);
});

banks.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    'DELETE FROM banks WHERE id = ? RETURNING id'
  ).bind(id).first();
  if (!result) return c.json({ error: 'Bank not found' }, 404);
  return c.json({ success: true });
});

export default banks;
