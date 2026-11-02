import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bankPriority, bankKey, categoryPriority, categoryKind, rateClass } from '../src/lib/presentation.ts';

test('bank ties follow the requested priority including common names', () => {
  const names = ['Уралсиб', 'ОТП', 'Сбербанк', 'Озон', 'Яндекс', 'Tbank', 'Альфа'];
  assert.deepEqual(names.sort((a, b) => bankPriority(a) - bankPriority(b)), ['Tbank', 'Яндекс', 'Озон', 'Сбербанк', 'ОТП', 'Уралсиб', 'Альфа']);
  assert.equal(bankKey('Т-Банк'), 'tbank');
  assert.equal(bankKey('Неизвестный банк'), undefined);
});
test('category ranking respects specific deliveries and trains', () => {
  const categories = ['Развлечения', 'Дикси Доставка', 'Поезда в Т-Путешествиях', 'Транспорт', 'Каршеринг', 'Аптеки', 'Такси', 'Рестораны', 'Супермаркеты'];
  assert.deepEqual(categories.sort((a, b) => categoryPriority(a) - categoryPriority(b)), ['Супермаркеты', 'Рестораны', 'Такси', 'Аптеки', 'Каршеринг', 'Транспорт', 'Поезда в Т-Путешествиях', 'Дикси Доставка', 'Развлечения']);
  assert.equal(categoryKind('Перекрёсток Доставка'), 'delivery');
});
test('percentage colors switch at five', () => {
  assert.equal(rateClass(3), 'rate-low'); assert.equal(rateClass(5), 'rate-mid'); assert.equal(rateClass(10), 'rate-high');
});
