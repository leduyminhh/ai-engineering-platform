#!/usr/bin/env bash
# Dựng repo giỏ hàng nhỏ đã có cách tính tổng, VAT làm tròn và phí ship; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src test

cat > src/cart.mjs <<'JS'
/** items: [{ sku, price, qty }] — price là số nguyên VND. */
export function subtotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

/** VAT 10% trên tạm tính, làm tròn về đồng gần nhất. */
export function vat(amount) {
  return Math.round(amount * 0.1);
}

/** Miễn phí ship từ 500.000đ trở lên, ngược lại 30.000đ (kể cả giỏ rỗng). */
export function shippingFee(amount) {
  return amount >= 500000 ? 0 : 30000;
}

/** Tổng phải trả = tạm tính + VAT + phí ship. */
export function total(items) {
  const s = subtotal(items);
  return s + vat(s) + shippingFee(s);
}
JS

cat > test/cart.test.mjs <<'JS'
import test from 'node:test';
import assert from 'node:assert/strict';
import { subtotal, total } from '../src/cart.mjs';

test('subtotal sums price * qty', () => {
  assert.equal(subtotal([{ sku: 'A', price: 10000, qty: 2 }, { sku: 'B', price: 5000, qty: 1 }]), 25000);
});

test('total adds VAT and shipping', () => {
  assert.equal(total([{ sku: 'A', price: 100000, qty: 1 }]), 100000 + 10000 + 30000);
});
JS
