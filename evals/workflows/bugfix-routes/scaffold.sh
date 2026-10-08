#!/usr/bin/env bash
# Dựng service thanh toán tối thiểu có bug 500 khi áp mã giảm giá; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src

cat > src/checkout.js <<'JS'
function applyCoupon(total, coupon) {
  if (total < coupon.rules.minTotal) {
    throw new Error('Đơn hàng chưa đủ điều kiện dùng mã');
  }
  if (coupon.percent) {
    return total - (total * coupon.percent) / 100;
  }
  return total - coupon.amount;
}

module.exports = { applyCoupon };
JS

cat > src/checkout-handler.js <<'JS'
const { applyCoupon } = require('./checkout');

function handleCheckout(req, res) {
  try {
    const total = applyCoupon(req.body.total, req.body.coupon);
    res.status(200).json({ total });
  } catch (err) {
    res.status(500).json({ error: 'internal_error' });
  }
}

module.exports = { handleCheckout };
JS
