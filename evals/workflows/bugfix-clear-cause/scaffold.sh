#!/usr/bin/env bash
# Dựng service giảm giá có lỗi một dòng (chia 10 thay vì 100) kèm output test đỏ đã chạy sẵn, để agent không cần Bash; không mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src test docs

cat > src/discount.js <<'JS'
function applyDiscount(total, percent) {
  return total - Math.floor((total * percent) / 10);
}

module.exports = { applyDiscount };
JS

cat > src/checkout.js <<'JS'
const { applyDiscount } = require('./discount');

function checkoutTotal(cart, promoPercent) {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  return promoPercent ? applyDiscount(subtotal, promoPercent) : subtotal;
}

module.exports = { checkoutTotal };
JS

cat > test/discount.test.js <<'JS'
const assert = require('node:assert');
const { applyDiscount } = require('../src/discount');

assert.strictEqual(applyDiscount(200000, 15), 170000);
JS

cat > docs/test-output.txt <<'TXT'
$ node test/discount.test.js
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

-100000 !== 170000

    at Object.<anonymous> (test/discount.test.js:4:8)
exit code: 1
TXT
