import { test } from 'node:test';
import assert from 'node:assert/strict';
import { optimize } from '../src/lib/optimizer.ts';
const offer = (id, bankId, category, percentage) => ({ id, bankId, category, percentage, notes:'', name:'', selected:true });
test('reassigns a flexible bank to cover more categories', () => {
  const rows = [offer('a',1,'food',10),offer('b',2,'food',9),offer('c',1,'taxi',8)];
  assert.deepEqual(optimize(rows,{1:1,2:1}),new Set(['b','c']));
});
test('maximizes percentage among equally complete allocations and fills remaining slots', () => {
  const rows = [offer('a',1,'food',10),offer('b',2,'food',9),offer('c',1,'taxi',8),offer('d',2,'taxi',3)];
  assert.deepEqual(optimize(rows,{1:1,2:1}),new Set(['b','c']));
  assert.equal(optimize(rows,{1:2,2:2}).size,4);
});
test('honors a zero bank limit', () => {
  assert.deepEqual(optimize([offer('a',1,'food',10)],{1:0}),new Set());
});
