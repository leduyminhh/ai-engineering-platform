// Keypress TUI primitives (zero-dep, raw-mode). Chỉ dùng trong terminal tương tác (TTY).
import readline from 'node:readline';

export const BACK = Symbol('back');     // người dùng bấm b — quay lại bước trước
export const CANCEL = Symbol('cancel'); // huỷ wizard (vd manifest rỗng)
export class WizardUnavailable extends Error {
  constructor() { super('Wizard cần terminal tương tác (TTY).'); this.name = 'WizardUnavailable'; }
}

// Màu ANSI — chỉ bật khi stdout là TTY và không đặt NO_COLOR (tránh lẫn mã màu vào pipe/redirect/test).
const USE_COLOR = !!process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (USE_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => paint('1', s);
const dim = (s) => paint('2', s);
const cyan = (s) => paint('36', s);
const green = (s) => paint('32', s);
const yellow = (s) => paint('33', s);
const SEP = dim('─'.repeat(40));

/** Thuần: ánh xạ tên phím -> hành động wizard. Export để test. */
export function keyToAction(name, { ctrl = false } = {}) {
  if (ctrl && name === 'c') return 'quit';
  switch (name) {
    case 'up': case 'k': return 'up';
    case 'down': case 'j': return 'down';
    case 'space': return 'toggle';
    case 'a': return 'all';
    case 'return': case 'enter': return 'confirm';
    case 'b': return 'back';
    case 'q': case 'escape': return 'quit';
    default: return null;
  }
}

function renderLines(title, items, { cursor, selected, multi, hint, window }) {
  const { start, end } = window || { start: 0, end: items.length };
  const out = [bold(title)];
  if (start > 0) out.push(dim(`  ↑ còn ${start} mục`));
  for (let i = start; i < end; i++) {
    const it = items[i];
    const active = i === cursor;
    const pointer = active ? cyan('>') : ' ';
    const box = multi ? (selected.has(i) ? green('[x]') : dim('[ ]')) + ' ' : '';
    const label = active ? cyan(it.label) : it.label;
    const tail = it.hint ? dim('  — ' + it.hint) : '';
    out.push(`${pointer} ${box}${label}${tail}`);
  }
  if (end < items.length) out.push(dim(`  ↓ còn ${items.length - end} mục`));
  out.push(hint);
  return out;
}

// Bề rộng hiển thị của một dòng = độ dài sau khi bỏ mã màu ANSI (mã màu rộng 0 trên màn hình).
const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
/**
 * Số DÒNG VISUAL thật của text: mỗi dòng logic dài hơn `width` bị terminal WRAP thành nhiều
 * dòng, nên đếm theo ceil(bề-rộng/width) — nếu không, cursor-up khi vẽ lại sẽ hụt và để sót
 * dòng cũ (text bị trùng khi lên/xuống). Dòng rỗng vẫn tính 1.
 */
function visualRows(text, width) {
  const w = width > 0 ? width : 80;
  let n = 0;
  for (const line of text.split('\n')) n += Math.max(1, Math.ceil(stripAnsi(line).length / w));
  return n;
}

/**
 * Thuần: cửa sổ [start,end) các item để vẽ khi list DÀI HƠN chiều cao terminal — giữ con trỏ
 * trong tầm nhìn (căn giữa rồi clamp hai biên). capacity ≥ total hoặc ≤ 0 → không cắt (vẽ hết).
 * Không có cửa sổ thì `draw` nhảy con trỏ lên số dòng vượt màn hình → terminal cuộn, reposition
 * lệch, frame hỏng ("mất lựa chọn"). Export để test. Giả định mỗi item cao 1 dòng (nhãn ngắn).
 */
export function viewport(total, cursor, capacity) {
  if (capacity <= 0 || capacity >= total) return { start: 0, end: total };
  let start = cursor - Math.floor(capacity / 2);
  if (start < 0) start = 0;
  if (start + capacity > total) start = total - capacity;
  return { start, end: start + capacity };
}

/**
 * Số item (dòng) tối đa được vẽ để VÙNG VẼ LẠI KHÔNG vượt chiều cao terminal (điều kiện để lệnh
 * nhảy-con-trỏ-lên khi redraw còn đúng). Trừ title + hint + 2 dòng chỉ báo ↑/↓ + 1 dòng đệm.
 */
function itemCapacity(title, hintLine, width, termRows) {
  const rows = termRows > 0 ? termRows : 24;
  const overhead = visualRows(title, width) + visualRows(hintLine, width) + 3;
  return Math.max(1, rows - overhead);
}

/**
 * Khung hiển thị một frame: gộp các dòng thành text + đếm số DÒNG HIỂN THỊ THẬT
 * (kể cả title '\n' nhiều dòng LẪN dòng bị wrap khi dài hơn `width`). `rows` dùng cho lệnh
 * cuộn con trỏ lên khi vẽ lại, nên phải đếm theo dòng visual chứ KHÔNG phải số phần tử mảng.
 * `width` mặc định = bề rộng terminal hiện tại (fallback 80 khi không phải TTY). Export để test.
 */
export function renderFrame(title, items, opts, width = process.stdout.columns || 80) {
  const text = renderLines(title, items, opts).join('\n');
  return { text, rows: visualRows(text, width) };
}

function runSelect(title, items, { multi = false, preselected = [], min = 0 } = {}) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return Promise.reject(new WizardUnavailable());
  return new Promise((resolve) => {
    let cursor = 0;
    const selected = new Set(
      preselected.map((v) => items.findIndex((it) => it.value === v)).filter((i) => i >= 0),
    );
    const hint = multi
      ? '↑/↓ di chuyển · Space chọn · a tất cả · Enter xác nhận · b quay lại · q huỷ'
      : '↑/↓ di chuyển · Enter chọn · b quay lại · q huỷ';
    let last = 0;
    const draw = (note = '') => {
      if (last) process.stdout.write(`\x1b[${last}A\x1b[0J`);
      const hintLine = note ? yellow(note) : dim(hint);
      const width = process.stdout.columns || 80;
      const window = viewport(items.length, cursor, itemCapacity(title, hintLine, width, process.stdout.rows));
      const { text, rows } = renderFrame(title, items, { cursor, selected, multi, hint: hintLine, window }, width);
      process.stdout.write(text + '\n');
      last = rows;
    };
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cleanup = () => {
      process.stdin.off('keypress', onKey);
      try { process.stdin.setRawMode(false); } catch { /* */ }
      process.stdin.pause();
    };
    const onKey = (_str, key) => {
      if (!key) return;
      const act = keyToAction(key.name, key);
      if (act === 'up') cursor = (cursor - 1 + items.length) % items.length;
      else if (act === 'down') cursor = (cursor + 1) % items.length;
      else if (act === 'toggle' && multi) { selected.has(cursor) ? selected.delete(cursor) : selected.add(cursor); }
      else if (act === 'all' && multi) {
        if (selected.size === items.length) selected.clear();
        else items.forEach((_, i) => selected.add(i));
      } else if (act === 'back') { cleanup(); return resolve(BACK); }
      else if (act === 'quit') { cleanup(); return resolve(CANCEL); }
      else if (act === 'confirm') {
        if (multi) {
          if (selected.size < min) { draw(`! Chọn ít nhất ${min} mục (Space để chọn).`); return; }
          cleanup(); return resolve([...selected].sort((a, b) => a - b).map((i) => items[i].value));
        }
        cleanup(); return resolve(items[cursor].value);
      }
      draw();
    };
    process.stdout.write('\n' + SEP + '\n'); // phân cách với step trước (ngoài vùng vẽ lại nên giữ nguyên)
    process.stdin.on('keypress', onKey);
    draw();
  });
}

export function selectOne(title, items, opts = {}) { return runSelect(title, items, { ...opts, multi: false }); }
export function selectMany(title, items, opts = {}) { return runSelect(title, items, { ...opts, multi: true }); }

/** Thuần: dựng danh sách dòng phẳng (header nhóm xen kẽ skill) để duyệt con trỏ. Export để test. */
export function flattenTree(groups) {
  const rows = [];
  groups.forEach((g, gi) => {
    rows.push({ type: 'header', groupIndex: gi, label: g.label });
    for (const s of g.skills) rows.push({ type: 'skill', groupIndex: gi, value: s.value, label: s.label, locked: !!s.locked });
  });
  return rows;
}
/** Thuần: trạng thái checkbox nhóm theo số skill con đang chọn. Export để test. */
export function headerState(group, selected) {
  const vals = group.skills.map((s) => s.value);
  const on = vals.filter((v) => selected.has(v)).length;
  if (on === 0) return 'empty';
  if (on === vals.length) return 'full';
  return 'partial';
}
/** Thuần: bật/tắt toàn nhóm — full thì tắt hết (trừ locked), ngược lại bật hết; locked luôn giữ. Export để test. */
export function cascadeToggle(selected, group) {
  const state = headerState(group, selected);
  for (const s of group.skills) {
    if (s.locked) { selected.add(s.value); continue; }
    if (state === 'full') selected.delete(s.value); else selected.add(s.value);
  }
}

// Tập value của mọi skill bị khoá (luôn phải giữ trong selected).
function lockedValues(groups) {
  const out = [];
  for (const g of groups) for (const s of g.skills) if (s.locked) out.push(s.value);
  return out;
}

// Vẽ một dòng cây: header với checkbox 3 trạng thái, skill thụt 2 space (locked = dim).
function renderTreeLines(title, rows, groups, { cursor, selected, hint, window }) {
  const { start, end } = window || { start: 0, end: rows.length };
  const out = [bold(title)];
  const boxOf = (state) => state === 'full' ? green('[x]') : state === 'partial' ? yellow('[~]') : dim('[ ]');
  if (start > 0) out.push(dim(`  ↑ còn ${start} mục`));
  for (let i = start; i < end; i++) {
    const r = rows[i];
    const active = i === cursor;
    const pointer = active ? cyan('>') : ' ';
    if (r.type === 'header') {
      const box = boxOf(headerState(groups[r.groupIndex], selected));
      const label = active ? cyan(r.label) : bold(r.label);
      out.push(`${pointer} ${box} ${label}`);
    } else {
      const on = selected.has(r.value);
      const box = r.locked ? dim('[x]') : on ? green('[x]') : dim('[ ]');
      const label = r.locked ? dim(r.label) : active ? cyan(r.label) : r.label;
      out.push(`${pointer}   ${box} ${label}`);
    }
  }
  if (end < rows.length) out.push(dim(`  ↓ còn ${rows.length - end} mục`));
  out.push(hint);
  return out;
}

// Khung raw-mode song song runSelect nhưng duyệt cây phân cấp (header cascade skill).
function runSelectTree(title, groups, { preselected = [], min = 0 } = {}) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') return Promise.reject(new WizardUnavailable());
  const rows = flattenTree(groups);
  const locked = lockedValues(groups);
  return new Promise((resolve) => {
    let cursor = 0;
    const selected = new Set([...preselected, ...locked]);
    const hint = '↑/↓ di chuyển · Space chọn/nhóm · a tất cả · Enter xác nhận · b quay lại · q huỷ';
    let last = 0;
    const draw = (note = '') => {
      if (last) process.stdout.write(`\x1b[${last}A\x1b[0J`);
      const hintLine = note ? yellow(note) : dim(hint);
      const width = process.stdout.columns || 80;
      const window = viewport(rows.length, cursor, itemCapacity(title, hintLine, width, process.stdout.rows));
      const text = renderTreeLines(title, rows, groups, { cursor, selected, hint: hintLine, window }).join('\n');
      process.stdout.write(text + '\n');
      last = visualRows(text, width);
    };
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const cleanup = () => {
      process.stdin.off('keypress', onKey);
      try { process.stdin.setRawMode(false); } catch { /* */ }
      process.stdin.pause();
    };
    const onKey = (_str, key) => {
      if (!key) return;
      const act = keyToAction(key.name, key);
      if (act === 'up') cursor = (cursor - 1 + rows.length) % rows.length;
      else if (act === 'down') cursor = (cursor + 1) % rows.length;
      else if (act === 'toggle') {
        const r = rows[cursor];
        if (r.type === 'header') cascadeToggle(selected, groups[r.groupIndex]);
        else if (!r.locked) { selected.has(r.value) ? selected.delete(r.value) : selected.add(r.value); }
      } else if (act === 'all') {
        const normals = rows.filter((r) => r.type === 'skill' && !r.locked).map((r) => r.value);
        if (normals.every((v) => selected.has(v))) for (const v of normals) selected.delete(v);
        else for (const v of normals) selected.add(v);
      } else if (act === 'back') { cleanup(); return resolve(BACK); }
      else if (act === 'quit') { cleanup(); return resolve(CANCEL); }
      else if (act === 'confirm') {
        if (selected.size < min) { draw(`! Chọn ít nhất ${min} mục (Space để chọn).`); return; }
        cleanup();
        const order = rows.filter((r) => r.type === 'skill' && selected.has(r.value)).map((r) => r.value);
        return resolve(order);
      }
      draw();
    };
    process.stdout.write('\n' + SEP + '\n');
    process.stdin.on('keypress', onKey);
    draw();
  });
}

export function selectTree(title, groups, opts = {}) { return runSelectTree(title, groups, opts); }

/** Confirm = chọn "Xác nhận & chạy" (true) hoặc "Quay lại sửa" (BACK). q huỷ. */
export async function confirmStep(title, lines = []) {
  const body = [title, ...lines.map((l) => '  ' + l)].join('\n');
  return selectOne(body, [
    { label: 'Xác nhận & chạy', value: true },
    { label: 'Quay lại sửa', value: BACK },
  ]);
}
