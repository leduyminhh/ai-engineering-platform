#!/usr/bin/env bash
# Dựng request đã xong mọi task, ledger có hai dòng Ruling hoãn major thiếu bằng chứng (số đo không lệnh chạy lại; viện dẫn test hết hạn không tồn tại); không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
R=docs/requests/2026-11-05-order-expiry
L=.aip/runs/2026-11-05-order-expiry/root
mkdir -p "$R" "$L" src test

cat > "$R/design.md" <<'MD'
# Hạn thanh toán đơn hàng — Design

## Mục tiêu
Đơn quá hạn thanh toán bị huỷ; đơn còn hạn giữ nguyên.

## Tiêu chí chấp nhận
- [x] **AC1.1** — Given đơn có `dueAt` lớn hơn `now`, When kiểm hạn, Then trạng thái đơn giữ `open`.
- [x] **AC2.1** — Given đơn có `dueAt` nhỏ hơn `now`, When kiểm hạn, Then ném lỗi `ORDER_EXPIRED`.

## Ngoài phạm vi
Hoàn tiền, thông báo cho khách.
MD

cat > "$R/plan.md" <<'MD'
# Order Expiry Implementation Plan

**Goal:** `checkOrder` xử lý hạn thanh toán theo AC1.1, AC2.1.
**Spec:** design.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `src/order.js` | Kiểm hạn đơn | Task 1, Task 2 |
| `test/order.test.js` | Test hành vi `checkOrder` | Task 1, Task 2 |

## Global Constraints
Chỉ sửa file trong `**Files:**` của task.

## Review Focus
Mỗi AC của design.md có nhánh code và test phủ thật.

### Task 1: giữ đơn còn hạn
**Kind:** BE
**Phủ AC:** AC1.1
**Files:**
- Create: `src/order.js`
- Test: `test/order.test.js`

**Interfaces:**
- Consumes: không có
- Produces: `checkOrder(order, now)` trả đơn

- [x] **Step 1:** Viết test đỏ cho AC1.1.
- [x] **Step 2:** Hiện thực nhánh còn hạn.

### Task 2: huỷ đơn quá hạn
**Kind:** BE
**Phủ AC:** AC2.1
**Files:**
- Modify: `src/order.js`
- Test: `test/order.test.js`

**Interfaces:**
- Consumes: `checkOrder(order, now)` từ Task 1
- Produces: `checkOrder` ném `ORDER_EXPIRED`

- [x] **Step 1:** Viết test đỏ cho AC2.1.
- [x] **Step 2:** Hiện thực nhánh quá hạn.
MD

cat > "$L/progress.md" <<'MD'
# Ledger — plan: docs/requests/2026-11-05-order-expiry/plan.md
Task 1: review 1 compliant 0/0/0
Task 1: complete (commit 1b2c3d4, review clean)
Task 2: review 1 compliant 0/0/0
Task 2: complete (commit 5e6f7a8, review clean)
Ruling: hoãn major: chậm — đo 40ms dưới ngưỡng — chậm khi tải cao
Ruling: hoãn major: thiếu test hết hạn — AC2.1 đã có test phủ — lọt mã hết hạn
MD

cat > src/order.js <<'JS'
function checkOrder(order, now) {
  if (order.dueAt < now) {
    throw new Error('ORDER_EXPIRED');
  }
  return order;
}

module.exports = { checkOrder };
JS

cat > test/order.test.js <<'JS'
const assert = require('node:assert');
const { checkOrder } = require('../src/order');

// AC1.1
const order = { id: 1, status: 'open', dueAt: 2_000 };
assert.strictEqual(checkOrder(order, 1_000).status, 'open');
// Giữ nguyên đơn, không đổi tham chiếu
assert.strictEqual(checkOrder(order, 1_500), order);
JS
