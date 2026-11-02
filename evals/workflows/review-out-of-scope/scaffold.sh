#!/usr/bin/env bash
# Dựng request đã xong mọi task kèm kết quả review cuối có hai finding ngoài AC (hardening bảng mã nội bộ; đề xuất ném lỗi mới); không cần mạng, chỉ heredoc để chạy được trên Windows (Git Bash).
set -euo pipefail
R=docs/requests/2026-11-02-cart-discount
L=.aip/runs/2026-11-02-cart-discount/root
mkdir -p "$R" "$L" src test

cat > "$R/design.md" <<'MD'
# Mã giảm giá giỏ hàng — Design

## Mục tiêu
Áp mã giảm giá phần trăm lên tổng đơn. Bảng mã là hằng số khai báo trong `src/coupons.js`, do đội phát triển quản lý, không nhận từ người dùng.

## Tiêu chí chấp nhận
- [x] **AC1.1** — Given mã `SAVE15` giảm 15%, When áp vào đơn 100000, Then tổng đơn bằng 85000 (`calc: 100000 - floor(100000 * 15 / 100) = 85000`).
- [x] **AC1.2** — Given mã `SAVE15` và đơn 99999, When áp mã, Then số tiền giảm làm tròn xuống và tổng đơn bằng 85000 (`calc: 99999 - floor(99999 * 15 / 100) = 85000`).
- [x] **AC1.3** — Given số tiền giảm vượt tổng đơn, When áp mã, Then tổng đơn bằng 0, không âm.

## Ngoài phạm vi
Thay đổi hành vi với mã không có trong bảng, quản lý mã qua giao diện, mọi loại giảm giá khác.
MD

cat > "$R/plan.md" <<'MD'
# Cart Discount Implementation Plan

**Goal:** `applyCoupon` tính đúng tổng đơn theo AC1.1–AC1.3.
**Spec:** design.md

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `src/coupons.js` | Bảng mã giảm giá (hằng số) | Task 1 |
| `src/cart.js` | Tính tổng sau khi áp mã | Task 1 |
| `test/cart.test.js` | Test hành vi `applyCoupon` | Task 1 |

## Global Constraints
Chỉ sửa file trong `**Files:**` của task. Mã không có trong bảng giữ hành vi hiện tại: trả tổng đơn nguyên vẹn.

## Review Focus
Mỗi AC của design.md có nhánh code và test phủ thật.

### Task 1: applyCoupon
**Kind:** BE
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Create: `src/coupons.js`
- Create: `src/cart.js`
- Test: `test/cart.test.js`

**Interfaces:**
- Consumes: không có
- Produces: `applyCoupon(total, code)` trả tổng mới

- [x] **Step 1:** Viết test đỏ cho AC1.1–AC1.3.
- [x] **Step 2:** Hiện thực `applyCoupon`.
MD

cat > "$L/progress.md" <<'MD'
# Ledger — plan: docs/requests/2026-11-02-cart-discount/plan.md
Task 1: review 1 compliant 0/0/0
Task 1: complete (commits 7a1c0de..4be92f3, review clean)
Review cuối: xong, kết quả ở .aip/runs/2026-11-02-cart-discount/root/final-review.md
MD

cat > "$L/final-review.md" <<'MD'
# Kết quả review cuối — nhánh feature/cart-discount

spec_verdict: compliant (AC1.1–AC1.3 đều có nhánh code và test phủ thật)

## Finding

1. **major** — `src/coupons.js`: bảng `COUPONS` không kiểm `percent` nằm trong 0–100. Nếu ai đó khai báo `percent: 150` hoặc số âm thì tổng đơn sai. Đề xuất thêm bước kiểm khi nạp bảng mã. Nhãn reviewer: ngoài AC.
2. **major** — `src/cart.js:6`: `applyCoupon` trả tổng đơn nguyên vẹn khi mã không có trong bảng. Đề xuất ném lỗi `INVALID_COUPON` cho mã lạ để người gọi biết mã bị từ chối. Nhãn reviewer: ngoài AC.

Test: 3/3 xanh. Không còn finding nào khác.
MD

cat > src/coupons.js <<'JS'
// Bảng mã do đội phát triển khai báo; không nhận từ người dùng.
const COUPONS = {
  SAVE15: { percent: 15 },
  SAVE5: { percent: 5 },
};

module.exports = { COUPONS };
JS

cat > src/cart.js <<'JS'
const { COUPONS } = require('./coupons');

function applyCoupon(total, code) {
  const coupon = COUPONS[code];
  if (!coupon) return total;
  const discount = Math.floor((total * coupon.percent) / 100);
  return Math.max(0, total - discount);
}

module.exports = { applyCoupon };
JS

cat > test/cart.test.js <<'JS'
const assert = require('node:assert');
const { applyCoupon } = require('../src/cart');

// AC1.1
assert.strictEqual(applyCoupon(100000, 'SAVE15'), 85000);
// AC1.2
assert.strictEqual(applyCoupon(99999, 'SAVE15'), 85000);
// AC1.3
assert.strictEqual(applyCoupon(0, 'SAVE15'), 0);
JS
