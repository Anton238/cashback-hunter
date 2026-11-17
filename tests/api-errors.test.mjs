import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../worker/package.json', import.meta.url));
const { build } = require('esbuild');

test('API handles timeout and offline failures, never caches private data, and locks on expired sessions', async () => {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL('../src/lib/api.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'browser', define: { 'import.meta.env': '{"DEV":false}' } });
  const { apiBanks, apiAuth } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  let locked = 0, options;
  const oldWindow = globalThis.window;
  globalThis.window = { dispatchEvent(event) { if (event.type === 'cashback:locked') locked++; } };
  const network = mock.method(globalThis, 'fetch', async (_url, init) => {
    options = init;
    throw new DOMException('timeout', 'TimeoutError');
  });
  try {
    await assert.rejects(apiBanks.list(), /Сервер не отвечает/);
    assert.equal(options.credentials, 'include');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    network.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(apiBanks.list(), /Не удалось связаться с сервером/);
    network.mock.mockImplementation(async () => Response.json({ error: 'Введи код доступа' }, { status: 401 }));
    await assert.rejects(apiBanks.list(), /Введи код доступа/);
    assert.equal(locked, 1);
    await assert.rejects(apiAuth.session(), /Введи код доступа/);
    assert.equal(locked, 1, 'session probe must not emit a recursive lock event');
  } finally {
    network.mock.restore();
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});
