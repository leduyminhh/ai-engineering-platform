#!/usr/bin/env bash
# Dựng module giỏ hàng giữ trạng thái ở cấp module (gốc lỗi) kèm ghi chú 3 lần sửa nông đã thất bại; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
mkdir -p src test docs

cat > src/cart-store.js <<'JS'
const state = { userId: null, items: [] };

function load(userId, items) {
  state.userId = userId;
  state.items = items;
}

function add(item) {
  state.items.push(item);
}

function total() {
  return state.items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

module.exports = { load, add, total };
JS

cat > src/cart-handler.js <<'JS'
const store = require('./cart-store');

async function handleAddItem(req, res) {
  const items = await req.db.loadItems(req.userId);
  store.load(req.userId, items);
  await req.db.audit(req.userId, 'add-item');
  store.add(req.body.item);
  res.json({ total: store.total() });
}

module.exports = { handleAddItem };
JS

cat > test/cart-concurrent.test.js <<'JS'
const assert = require('node:assert');
const { handleAddItem } = require('../src/cart-handler');

const db = {
  loadItems: async (u) => (u === 'u1' ? [{ price: 100, qty: 1 }] : [{ price: 5, qty: 2 }]),
  audit: () => new Promise((r) => setTimeout(r, 10)),
};
const call = (userId, item) =>
  new Promise((resolve) => handleAddItem({ db, userId, body: { item } }, { json: resolve }));

(async () => {
  const [a, b] = await Promise.all([
    call('u1', { price: 50, qty: 1 }),
    call('u2', { price: 1, qty: 1 }),
  ]);
  assert.strictEqual(a.total, 150);
  assert.strictEqual(b.total, 11);
})();
JS

cat > docs/bugfix-notes.md <<'MD'
# Ghi chú sửa lỗi: tổng giỏ hàng lẫn giữa hai người dùng

Triệu chứng: hai request thêm món gần như cùng lúc thì tổng của người này dính món của người kia
(`test/cart-concurrent.test.js` đỏ).

| Lần | Thay đổi | Kết quả |
|---|---|---|
| 1 | Bọc `store.add` trong mutex | Test vẫn đỏ: `load` của request kia vẫn ghi đè giữa hai lần `await` |
| 2 | Sao chép mảng `items` trong `load` | Test vẫn đỏ: `userId` và `items` của request kia vẫn lẫn vào `state` |
| 3 | Đặt lại `state` ở đầu `handleAddItem` | Test vẫn đỏ, và làm hỏng thêm một test của luồng checkout |
MD
