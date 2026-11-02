// usage: node oracle.mjs <aip|aip-obj|base> <module path>
import { pathToFileURL } from 'node:url';

const [kind, modPath] = process.argv.slice(2);
const mod = await import(pathToFileURL(modPath).href);
const PAST = new Date('2020-01-01T00:00:00Z');
const NOW = new Date('2026-11-02T00:00:00Z');
const cart = (price, qty = 1) => [{ sku: 'X', price, qty }];

// Mỗi coupon mô tả trung tính; adapter dịch sang schema riêng của từng bản.
function apply(items, code, c, now = NOW) {
  // aip-obj: API nhận đối tượng coupon (caller tra mã), hạn là số ms; tra mã khớp tuyệt đối nên ca chuẩn hoá mã không áp dụng.
  if (kind === 'aip-obj') {
    const coupon = code === c.code ? { type: c.type, value: c.value, expiresAt: c.expiresAt?.getTime(), minSubtotal: c.min, maxUses: c.maxUses } : null;
    const r = mod.applyCoupon(items, coupon, { now: now.getTime(), used: c.used ?? 0 });
    return { ...r, ok: r.applied };
  }
  if (kind === 'aip') {
    const rec = { code: c.code, type: c.type, value: c.value, endsAt: c.expiresAt, minSubtotal: c.min, maxUses: c.maxUses, used: c.used };
    return mod.applyCoupon(items, code, [rec], now);
  }
  const rec = { code: c.code, type: c.type, value: c.value, expiresAt: c.expiresAt, minSubtotal: c.min, maxUses: c.maxUses };
  const usage = new Map(c.used ? [[c.code, c.used]] : []);
  return mod.applyCoupon(items, code, { coupons: [rec], now, usage });
}
const totalOf = (items, r) => (r.ok ? r.total : (r.total ?? items.reduce((s, i) => s + i.price * i.qty, 0)));

const cases = [
  ['percent 10% đúng', () => { const r = apply(cart(25000), 'LE', { code: 'LE', type: 'percent', value: 10 }); return r.ok && r.total === 22500; }],
  ['percent làm tròn xuống phần giảm', () => { const r = apply(cart(99999), 'LE', { code: 'LE', type: 'percent', value: 15 }); return r.ok && r.total === 85000; }],
  ['fixed lớn hơn subtotal → total 0', () => { const r = apply(cart(20000), 'LE', { code: 'LE', type: 'fixed', value: 50000 }); return r.ok && r.total === 0; }],
  ['percent > 100 không âm', () => { const i = cart(20000); return totalOf(i, apply(i, 'LE', { code: 'LE', type: 'percent', value: 150 })) >= 0; }],
  ['value âm không làm tăng tổng', () => { const i = cart(20000); let r; try { r = apply(i, 'LE', { code: 'LE', type: 'fixed', value: -5000 }); } catch { return true; } return totalOf(i, r) <= 20000; }],
  ['mã hết hạn bị từ chối', () => !apply(cart(20000), 'LE', { code: 'LE', type: 'fixed', value: 1000, expiresAt: PAST }).ok],
  ['chưa đủ đơn tối thiểu bị từ chối', () => !apply(cart(20000), 'LE', { code: 'LE', type: 'fixed', value: 1000, min: 50000 }).ok],
  ['hết lượt bị từ chối', () => !apply(cart(20000), 'LE', { code: 'LE', type: 'fixed', value: 1000, maxUses: 5, used: 5 }).ok],
  ['chuẩn hoá hoa/thường + khoảng trắng', () => apply(cart(20000), '  le  ', { code: 'LE', type: 'fixed', value: 1000 }).ok],
  ['mã không tồn tại → không áp, tổng giữ nguyên', () => { const i = cart(20000); const r = apply(i, 'NOPE', { code: 'LE', type: 'fixed', value: 1000 }); return !r.ok && totalOf(i, r) === 20000; }],
  ['now không hợp lệ + mã hết hạn → fail-closed', () => { try { return !apply(cart(20000), 'LE', { code: 'LE', type: 'fixed', value: 1000, expiresAt: PAST }, new Date('x')).ok; } catch { return true; } }],
  ['giỏ rỗng không âm', () => { const r = apply([], 'LE', { code: 'LE', type: 'fixed', value: 1000 }); return totalOf([], r) === 0; }],
];

let pass = 0;
for (const [name, fn] of cases) {
  let ok; try { ok = !!fn(); } catch (e) { ok = false; name += ` (ném ${e.name})`; }
  pass += ok; console.log(ok ? 'PASS' : 'FAIL', name);
}
console.log(`${kind}: ${pass}/${cases.length}`);
