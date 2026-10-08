import test from 'node:test';
import assert from 'node:assert/strict';
import { totals, makeDraft, validateDocument } from '../lib/domain.js';

test('VAT is rounded once after line item amounts, and can be excluded', () => {
  const items = [{ name: '작업', quantity: 1.5, price: 1001 }, { name: '지원', quantity: 2, price: 2000 }];
  assert.deepEqual(totals(items), { subtotal: 5502, tax: 550, total: 6052 });
  assert.deepEqual(totals(items, false), { subtotal: 5502, tax: 0, total: 5502 });
});
test('draft allocations preserve exact requested budgets including zero', () => {
  for (const budget of [0, 1, 1234567, 10000000]) for (const template of ['branding', 'website', 'marketing', 'consulting']) {
    const draft = makeDraft({ client: '고객', budget, template });
    assert.equal(totals(draft.items, false).subtotal, budget);
    assert.equal(draft.status, 'draft');
  }
  assert.equal(totals(makeDraft({ client: '고객', budget: '' }).items, false).subtotal, 10000000);
  assert.throws(() => makeDraft({ client: '고객', budget: 'invalid' }));
});
test('invalid financial data and blank required fields are rejected', () => {
  const d = makeDraft({ client: '고객' });
  for (const item of [{ name: '작업', quantity: -1, price: 1 }, { name: '작업', quantity: 0, price: 1 }, { name: '작업', quantity: 1, price: -1 }, { name: '작업', quantity: Infinity, price: 1 }, { name: '작업', quantity: 1, price: 1.1 }, { name: '', quantity: 1, price: 100 }]) assert.throws(() => validateDocument({ ...d, items: [item] }));
  assert.throws(() => validateDocument({ ...d, title: ' ' }));
  assert.throws(() => validateDocument({ ...d, status: 'sent' }));
});
