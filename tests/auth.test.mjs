import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { Hono } from '../worker/node_modules/hono/dist/index.js';
import { auth, requireSession } from '../worker/src/auth.ts';
const require = createRequire(new URL('../worker/package.json', import.meta.url));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');

test('code gate protects API, rate limits guesses, expires sessions, revokes logout and password changes', async () => {
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: 'export default {fetch(){return new Response("ok")}}', compatibilityDate: '2024-09-23', d1Databases: { DB: 'auth' } }));
  try {
    const DB = await mf.getD1Database('DB');
    for (const sql of readFileSync(new URL('../worker/migrations/0006_access_code.sql', import.meta.url), 'utf8').split(';').filter(x => x.trim())) await DB.prepare(sql).run();
    const env = { DB, ADMIN_PASSWORD: '7319' };
    const app = new Hono();
    app.use('/api/*', requireSession);
    app.route('/api/auth', auth);
    app.get('/api/banks', c => c.json(['private bank']));
    const request = (path, method = 'GET', cookie, body) => app.request('https://cashback.test/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }, env);
    assert.equal((await request('/banks')).status, 401);
    assert.equal((await request('/auth/session')).status, 401);
    assert.equal((await request('/auth/login', 'POST', null, { password: 'wrong' })).status, 401);
    const signIn = async () => {
      const response = await request('/auth/login', 'POST', null, { password: env.ADMIN_PASSWORD });
      assert.equal(response.status, 200);
      const header = response.headers.get('Set-Cookie');
      assert.match(header, /HttpOnly/i); assert.match(header, /Secure/i); assert.match(header, /SameSite=Strict/i);
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      return header.split(';')[0];
    };
    let cookie = await signIn();
    const accepted = await request('/banks', 'GET', cookie);
    assert.equal(accepted.status, 200); assert.equal(accepted.headers.get('Cache-Control'), 'no-store');
    assert.equal((await request('/banks', 'GET', cookie + 'tampered')).status, 401);
    assert.equal((await request('/auth/logout', 'POST', cookie)).status, 200);
    assert.equal((await request('/banks', 'GET', cookie)).status, 401);
    cookie = await signIn();
    env.ADMIN_PASSWORD = '8420';
    assert.equal((await request('/banks', 'GET', cookie)).status, 401);
    cookie = await signIn();
    await DB.prepare('UPDATE auth_sessions SET expires_at=0').run();
    assert.equal((await request('/banks', 'GET', cookie)).status, 401);
    for (let n = 0; n < 10; n++) assert.equal((await request('/auth/login', 'POST', null, { password: 'wrong' })).status, 401);
    const limited = await request('/auth/login', 'POST', null, { password: env.ADMIN_PASSWORD });
    assert.equal(limited.status, 429);
    await DB.prepare('UPDATE auth_attempts SET expires_at=0').run();
    await signIn();
    env.ADMIN_PASSWORD = '';
    assert.equal((await request('/banks', 'GET', cookie)).status, 503);
  } finally { await mf.dispose(); }
});
