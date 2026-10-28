#!/usr/bin/env bash
# Dựng app báo cáo doanh thu tối thiểu chưa có export; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src

cat > package.json <<'JSON'
{
  "name": "revenue-dashboard",
  "version": "0.3.0",
  "private": true,
  "main": "src/report-routes.js"
}
JSON

cat > src/report-service.js <<'JS'
function buildSummary(orders) {
  const byMonth = {};
  for (const o of orders) {
    const month = o.createdAt.slice(0, 7);
    byMonth[month] = (byMonth[month] || 0) + o.total;
  }
  return { months: byMonth, orderCount: orders.length };
}

module.exports = { buildSummary };
JS

cat > src/report-routes.js <<'JS'
const { buildSummary } = require('./report-service');

function registerRoutes(app, orderRepo) {
  app.get('/reports/summary', async (req, res) => {
    const orders = await orderRepo.findAll();
    res.json(buildSummary(orders));
  });
}

module.exports = { registerRoutes };
JS

cat > README.md <<'MD'
# Revenue Dashboard
Trang báo cáo doanh thu theo tháng cho bộ phận kế toán. Hiện chỉ xem được trên web (`GET /reports/summary`).
MD
