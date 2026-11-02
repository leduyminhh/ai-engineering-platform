/** items: [{ sku, price, qty }] — price in VND (integer). */
export function subtotal(items) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}
