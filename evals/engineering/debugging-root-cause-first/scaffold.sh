#!/usr/bin/env bash
# Dựng luồng đơn hàng nhỏ: lỗi hiện ở report.js nhưng nguồn nằm ở orders.js (cờ hủy bị gán sai tên); chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src

cat > src/orders.js <<'JS'
function loadOrders(rows) {
  return rows.map((row) => ({
    id: row.id,
    amount: row.amount,
    canceled: row.status === 'cancelled',
  }));
}

module.exports = { loadOrders };
JS

cat > src/report.js <<'JS'
const { loadOrders } = require('./orders');

function revenue(rows) {
  return loadOrders(rows)
    .filter((order) => !order.cancelled)
    .reduce((sum, order) => sum + order.amount, 0);
}

module.exports = { revenue };
JS
