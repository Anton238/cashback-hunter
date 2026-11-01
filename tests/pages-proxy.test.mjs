import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/[[path]].ts';
test('passes the request, including its Access assertion, to the bound API', async () => {
  const original = new Request('https://cashback.example/api/banks', { headers: { 'Cf-Access-Jwt-Assertion': 'test-token' } });
  let forwarded;
  const response = await onRequest({request: original, env: {CASHBACK_API: {fetch: async request => { forwarded = request; return new Response('ok'); }}}});
  assert.equal(forwarded, original);
  assert.equal(forwarded.headers.get('Cf-Access-Jwt-Assertion'), 'test-token');
  assert.equal(await response.text(), 'ok');
});
