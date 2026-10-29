#!/usr/bin/env bash
# Dựng app báo cáo doanh thu tối thiểu chưa có export; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src project-knowledge

cat > package.json <<'JSON'
{
  "name": "revenue-dashboard",
  "version": "0.3.0",
  "private": true,
  "main": "src/report-routes.js",
  "scripts": { "test": "node --test" }
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

cat > project-knowledge/architecture.md <<'MD'
# Architecture
## Sơ đồ khối thành phần
Một service Node: `src/report-routes.js` (HTTP) gọi `src/report-service.js` (tính tổng hợp thuần, không I/O). `orderRepo` do ứng dụng chủ truyền vào.
## Trách nhiệm từng thành phần
- `report-routes.js`: đăng ký route, lấy đơn từ `orderRepo`, trả JSON.
- `report-service.js`: `buildSummary(orders)` gộp doanh thu theo tháng.
## Luồng dữ liệu
`orderRepo.findAll()` → `buildSummary` → JSON.
## Quyết định kiến trúc chính
Chưa có ADR.
## Tích hợp ngoài
Không.
MD
