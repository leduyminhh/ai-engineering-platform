#!/usr/bin/env bash
# Dựng request có design nói now/expiresAt tính bằng mili-giây, code Task 1 coi now là giây và báo cáo implementer khai giả định đó kèm test xanh; không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
R=docs/requests/2026-11-04-coupon-expiry
L=.aip/runs/2026-11-04-coupon-expiry/root
mkdir -p "$R" "$L" src test

cat > "$R/design.md" <<'MD'
# Hạn dùng mã giảm giá — Design

## Mục tiêu
`applyCoupon` từ chối mã đã hết hạn và vẫn áp mã còn hạn.

## Quy ước
`now` và `expiresAt` đều là mili-giây kể từ epoch (giá trị của `Date.now()`).

## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given mã giảm số tiền cố định không có `expiresAt`, When áp vào đơn, Then tổng đơn giảm đúng số tiền đó, không âm.
- [ ] **AC1.2** — Given mã có `expiresAt` nhỏ hơn `now`, When áp mã, Then ném lỗi `COUPON_EXPIRED`.
- [ ] **AC1.3** — Given mã có `expiresAt` lớn hơn `now`, When áp mã, Then tổng đơn giảm đúng số tiền của mã, không ném lỗi.

## Ngoài phạm vi
Múi giờ, gia hạn mã, mọi loại giảm giá khác.
MD

cat > "$R/plan.md" <<'MD'
# Coupon Expiry Implementation Plan

**Goal:** `applyCoupon` xử lý hạn dùng theo AC1.1–AC1.3.
**Spec:** design.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `src/coupon.js` | Tính tổng sau khi áp mã, kiểm hạn | Task 1 |
| `test/coupon.test.js` | Test hành vi `applyCoupon` | Task 1 |

## Global Constraints
Chỉ sửa file trong `**Files:**` của task. Thời gian theo quy ước của design.md.

## Review Focus
Mỗi AC của design.md có nhánh code và test phủ thật; giả định implementer khai phải khớp design.

### Task 1: applyCoupon
**Kind:** BE
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Create: `src/coupon.js`
- Test: `test/coupon.test.js`

**Interfaces:**
- Consumes: không có
- Produces: `applyCoupon(total, coupon, now)` trả tổng mới hoặc ném `COUPON_EXPIRED`

- [x] **Step 1:** Viết test đỏ cho AC1.1–AC1.3.
- [x] **Step 2:** Hiện thực `applyCoupon`.
MD

cat > "$L/progress.md" <<'MD'
# Ledger — plan: docs/requests/2026-11-04-coupon-expiry/plan.md
Task 1: implementer báo xong (commit 5d9e0b4) — phủ AC1.1, AC1.2, AC1.3; test xanh 3/3. Giả định: now tính bằng giây (design.md không nói rõ đơn vị nên chọn giây cho khớp expiresAt đổi sang giây).
MD

cat > src/coupon.js <<'JS'
function applyCoupon(total, coupon, now) {
  if (coupon.expiresAt !== undefined && coupon.expiresAt / 1000 < now) {
    throw new Error('COUPON_EXPIRED');
  }
  return Math.max(0, total - coupon.amount);
}

module.exports = { applyCoupon };
JS

cat > test/coupon.test.js <<'JS'
const assert = require('node:assert');
const { applyCoupon } = require('../src/coupon');

const now = 1_700_000_000;
// AC1.1
assert.strictEqual(applyCoupon(1000, { amount: 200 }, now), 800);
// AC1.2
assert.throws(() => applyCoupon(1000, { amount: 200, expiresAt: 1_000 }, now), /COUPON_EXPIRED/);
// AC1.3
assert.strictEqual(applyCoupon(100, { amount: 500 }, now), 0);
JS
