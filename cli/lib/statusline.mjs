// Dòng trạng thái cho `statusLine` của Claude Code. Zero-dependency, hàm thuần.
// Chỉ dùng trường Claude Code đã gửi sẵn trong stdin (theo tài liệu statusline); [Unverified] chưa quan sát hiển thị trong phiên thật.

export const DEFAULT_SOFT = 40;
export const DEFAULT_HARD = 60;
const CACHE_WARN_MIN = 5;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Ngưỡng do người dùng nhập; sai thì báo lỗi thay vì đoán, vì statusline sai ngưỡng làm lệch kỷ luật xoay phiên.
export function parseThresholds({ soft, hard }) {
  const s = soft === undefined ? DEFAULT_SOFT : Number(soft);
  const h = hard === undefined ? DEFAULT_HARD : Number(hard);
  const valid = (v) => Number.isFinite(v) && v >= 1 && v <= 100;
  if (!valid(s) || !valid(h)) return { error: '--soft và --hard phải là số trong khoảng 1–100.' };
  if (s >= h) return { error: '--soft phải nhỏ hơn --hard.' };
  return { soft: s, hard: h };
}

export function renderStatusline(input, { nowMs = Date.now(), soft = DEFAULT_SOFT, hard = DEFAULT_HARD, color = false } = {}) {
  if (!input || typeof input !== 'object') return '';
  const paint = (code, text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
  const parts = [];

  const model = input.model?.display_name;
  if (typeof model === 'string' && model) parts.push(model);

  const pct = num(input.context_window?.used_percentage);
  if (pct === null) parts.push('ctx --');
  else {
    const p = Math.round(pct);
    if (p >= hard) parts.push(paint(31, `ctx ${p}% ‼ bàn giao ngay`));
    else if (p >= soft) parts.push(paint(33, `ctx ${p}% ⚠ bàn giao sau gói`));
    else parts.push(`ctx ${p}%`);
  }

  const cache = input.prompt_cache;
  if (cache && typeof cache === 'object' && cache.caching_observed !== false) {
    const ratio = num(cache.hit_ratio);
    const hit = ratio === null ? '' : ` ${Math.round(ratio * 100)}%`;
    const expires = num(cache.expires_at);
    if (cache.warm === true && expires !== null) {
      const mins = Math.max(0, Math.ceil((expires * 1000 - nowMs) / 60000));
      const text = `cache ${mins}m${hit}`;
      parts.push(mins <= CACHE_WARN_MIN ? paint(33, text) : text);
    } else if (cache.warm === false) parts.push(paint(31, 'cache nguội'));
  }

  const cost = num(input.cost?.total_cost_usd);
  if (cost !== null) parts.push(`$${cost.toFixed(2)}`);

  const five = num(input.rate_limits?.five_hour?.used_percentage);
  if (five !== null) parts.push(`5h ${Math.round(five)}%`);

  return parts.join(' │ ');
}
