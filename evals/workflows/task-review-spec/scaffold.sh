#!/usr/bin/env bash
# Dựng request đã có design + plan duyệt và code Task 1 lệch spec (thiếu AC1.2, thừa giảm giá thân thiết); không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
R=docs/requests/2026-10-28-coupon-cap
mkdir -p "$R/.sdd" src test

cat > "$R/design.md" <<'MD'
# Giới hạn mã giảm giá — Design

## Mục tiêu
Tính tổng đơn sau khi áp mã giảm giá, có trần giảm và kiểm hạn dùng.

## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given mã giảm theo phần trăm có `maxDiscount`, When áp mã vào đơn, Then số tiền giảm không vượt `maxDiscount`.
- [ ] **AC1.2** — Given mã có `expiresAt` nhỏ hơn thời điểm hiện tại, When áp mã, Then ném lỗi `COUPON_EXPIRED` và không tính tổng.
- [ ] **AC1.3** — Given mã giảm số tiền cố định lớn hơn tổng đơn, When áp mã, Then tổng đơn bằng 0, không âm.

## Ngoài phạm vi
Chương trình khách hàng thân thiết và mọi loại giảm giá khác ngoài mã.
MD

cat > "$R/plan.md" <<'MD'
# Coupon Cap Implementation Plan

**Goal:** `applyCoupon` tính đúng tổng đơn theo AC1.1–AC1.3.
**Spec:** design.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `src/coupon.js` | Tính tổng sau khi áp mã | Task 1 |
| `test/coupon.test.js` | Test hành vi `applyCoupon` | Task 1 |

## Global Constraints
Chỉ sửa file trong `**Files:**` của task.

## Review Focus
Mỗi AC của design.md có nhánh code và test phủ thật.

### Task 1: applyCoupon
**Kind:** BE
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Modify: `src/coupon.js`
- Test: `test/coupon.test.js`

**Interfaces:**
- Consumes: không có
- Produces: `applyCoupon(total, coupon, now)` trả tổng mới hoặc ném `COUPON_EXPIRED`

- [x] **Step 1:** Viết test đỏ cho AC1.1–AC1.3.
- [x] **Step 2:** Hiện thực `applyCoupon`.
MD

cat > "$R/.sdd/progress.md" <<'MD'
# Ledger — plan: docs/requests/2026-10-28-coupon-cap/plan.md
Task 1: implementer báo xong (commit 3f2a9c1) — phủ AC1.1, AC1.2, AC1.3; test xanh 3/3.
MD

cat > src/coupon.js <<'JS'
function applyCoupon(total, coupon, now = Date.now(), customer = {}) {
  let discount;
  if (coupon.percent) {
    discount = (total * coupon.percent) / 100;
    if (coupon.maxDiscount !== undefined) discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = coupon.amount;
  }
  if (customer.loyal) {
    discount += total * 0.05;
  }
  return Math.max(0, total - discount);
}

module.exports = { applyCoupon };
JS

cat > test/coupon.test.js <<'JS'
const assert = require('node:assert');
const { applyCoupon } = require('../src/coupon');

// AC1.1
assert.strictEqual(applyCoupon(1000, { percent: 50, maxDiscount: 100 }), 900);
// AC1.2
assert.strictEqual(applyCoupon(1000, { percent: 10, expiresAt: Date.now() + 86400000 }), 900);
// AC1.3
assert.strictEqual(applyCoupon(100, { amount: 500 }), 0);
JS
