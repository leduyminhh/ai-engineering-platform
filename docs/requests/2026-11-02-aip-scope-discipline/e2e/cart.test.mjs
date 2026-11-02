import test from 'node:test';
import assert from 'node:assert/strict';
import { subtotal } from '../src/cart.mjs';

test('subtotal sums price * qty', () => {
  assert.equal(subtotal([{ sku: 'A', price: 10000, qty: 2 }, { sku: 'B', price: 5000, qty: 1 }]), 25000);
});
