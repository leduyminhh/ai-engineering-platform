// aip autonomy high|safe|status — mức hỏi của luồng plan-execution qua khoá `autonomy` của aip-gate.json.
// Khác `aip mode` (quyền công cụ): không đụng settings.json. Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { resolveGate } from '../../core/hooks/scripts/gate-config.mjs';
import { readAutonomy } from '../../core/skills/plan-execution/scripts/autonomy.mjs';

const HIGH = Object.freeze({ mergeLocal: true, cleanup: true, partRunner: 'subagent' });
const SUBS = new Set(['high', 'safe', 'status']);

const dump = (obj) => JSON.stringify(obj, null, 2) + '\n';

// resolveGate bỏ qua lặng lẽ file hỏng của repo chính; aip mode báo lỗi nên aip autonomy cũng báo, không ghi file che nó.
function invalidAt(root) {
  let raw;
  try { raw = fs.readFileSync(path.join(root, '.claude', 'aip-gate.json'), 'utf8'); } catch (e) { return e?.code !== 'ENOENT'; }
  try { const v = JSON.parse(raw.replace(/^﻿/, '')); return !(v && typeof v === 'object' && !Array.isArray(v)); } catch { return true; }
}

export function runAutonomy(sub, { root, out = console.log, err = console.error }) {
  if (!SUBS.has(sub)) { err(`Cách dùng: aip autonomy high|safe|status${sub ? ` (giá trị không hợp lệ: "${sub}")` : ''}`); return 2; }
  try { return runUnsafe(sub, { root, out, err }); } catch (e) { err(`Lỗi: ${e.message}`); return 1; }
}

function runUnsafe(sub, { root, out, err }) {
  const g = resolveGate(root);
  const bad = g?.source === 'worktree-invalid' ? g.file
    : g && !g.source && g.main && invalidAt(g.main) ? path.join(g.main, '.claude', 'aip-gate.json') : null;
  if (bad) { err(`Lỗi: ${bad} không phải đối tượng JSON hợp lệ; sửa tay trước khi chạy aip autonomy.`); return 1; }

  if (sub === 'status') {
    out(`autonomy: ${JSON.stringify(readAutonomy(root))}${g?.config?.autonomy === undefined ? ' (mặc định an toàn, aip-gate.json không có khoá autonomy)' : ''}`);
    out(`Nguồn: ${g?.file ? `${g.file}${g.source === 'main' ? ' (repo chính; worktree này chưa có aip-gate.json)' : ''}` : 'không có'}`);
    return 0;
  }

  // Ghi vào gốc hiện tại như `aip mode`: worktree chưa có file thì chép khoá của repo chính sang để không mất chúng.
  const file = path.join(root, '.claude', 'aip-gate.json');
  const next = { ...(g?.config || {}) };
  if (sub === 'high') next.autonomy = { ...HIGH };
  else if (!('autonomy' in next)) { out(`✓ autonomy=safe tại ${root} (không có khoá autonomy, không ghi gì)`); return 0; }
  else delete next.autonomy;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, dump(next), 'utf8');
  out(`✓ autonomy=${sub} tại ${root}${sub === 'high' ? `: ${JSON.stringify(HIGH)}` : ''}`);
  if (g?.source === 'main') out(`  ghi ${file}: cấu hình lấy từ repo chính, file của worktree này che file của repo chính từ giờ.`);
  if (sub === 'high') out('  Push/PR vẫn luôn hỏi; G1 (design), G2 (plan), G3 (diff cả nhánh) vẫn dừng chờ duyệt.');
  return 0;
}
