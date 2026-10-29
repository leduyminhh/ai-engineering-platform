#!/usr/bin/env bash
# Dựng một module nhỏ và một test đỏ; chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src test

cat > src/total.js <<'JS'
function total(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

module.exports = { total };
JS

cat > test/total.test.js <<'JS'
const test = require('node:test');
const assert = require('node:assert');
const { total } = require('../src/total');

test('bỏ qua dòng hàng bị hủy', () => {
  assert.strictEqual(total([{ price: 10, qty: 2 }, { price: 5, qty: 1, cancelled: true }]), 20);
});
JS
