import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';

export interface AuthEnv { DB: D1Database; ADMIN_PASSWORD?: string }
const COOKIE = 'cashback_session';
const lifetime = 30 * 86400;
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), x => x.toString(16).padStart(2, '0')).join('');

export const requireSession: MiddlewareHandler<{ Bindings: AuthEnv }> = async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (c.req.method === 'OPTIONS' || ['/api/health', '/api/auth/login'].includes(c.req.path)) return next();
  if (!c.env.ADMIN_PASSWORD) return c.json({ error: 'Вход временно недоступен' }, 503);
  const token = getCookie(c, COOKIE);
  if (!token || token.length > 200) return c.json({ error: 'Введи код доступа' }, 401);
  const session = await c.env.DB.prepare('SELECT token_hash FROM auth_sessions WHERE token_hash=? AND expires_at>? AND password_hash=?')
    .bind(await hash(token), Date.now(), await hash(c.env.ADMIN_PASSWORD)).first();
  if (!session) return c.json({ error: 'Введи код доступа' }, 401);
  return next();
};

export const auth = new Hono<{ Bindings: AuthEnv }>();
auth.post('/login', async c => {
  if (!c.env.ADMIN_PASSWORD) return c.json({ error: 'Вход временно недоступен' }, 503);
  const now = Date.now(), key = await hash(c.req.header('CF-Connecting-IP') ?? 'local');
  await c.env.DB.prepare('DELETE FROM auth_attempts WHERE expires_at<?').bind(now).run();
  const attempt = await c.env.DB.prepare('INSERT INTO auth_attempts(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1 RETURNING attempts')
    .bind(key, now + 15 * 60000).first<{ attempts: number }>();
  if (!attempt || attempt.attempts > 10) { c.header('Retry-After', '900'); return c.json({ error: 'Слишком много попыток. Подожди 15 минут.' }, 429); }
  const data = await c.req.json().catch(() => null);
  const value = typeof data?.password === 'string' && data.password.length <= 100 ? data.password : '';
  const actual = await hash(value), expected = await hash(c.env.ADMIN_PASSWORD);
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  if (difference) return c.json({ error: 'Неверный код' }, 401);
  const token = crypto.randomUUID() + crypto.randomUUID();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO auth_sessions VALUES(?,?,?)').bind(await hash(token), now + lifetime * 1000, expected),
    c.env.DB.prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(now),
    c.env.DB.prepare('DELETE FROM auth_attempts WHERE key=?').bind(key),
  ]);
  setCookie(c, COOKIE, token, { httpOnly: true, secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict', path: '/', maxAge: lifetime });
  return c.json({ authenticated: true });
});
auth.get('/session', c => c.json({ authenticated: true }));
auth.post('/logout', async c => {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await hash(token)).run();
  deleteCookie(c, COOKIE, { path: '/', secure: new URL(c.req.url).protocol === 'https:', sameSite: 'Strict' });
  return c.json({ ok: true });
});
