// aip autonomy high|safe|status — mức hỏi của luồng plan-execution qua khoá `autonomy` của aip-gate.json.
// Khác `aip mode` (quyền công cụ): không đụng settings.json. Zero-dependency.
import fs from 'node:fs';
import path from 'node:path';
import { resolveAutonomy } from '../../core/skills/plan-execution/scripts/autonomy.mjs';
import { gitStateOf, cliGate, gateLines } from './mode.mjs';

const HIGH = Object.freeze({ mergeLocal: true, cleanup: true, partRunner: 'subagent' });
const SUBS = new Set(['high', 'safe', 'status']);
// `planRunner` lưu bằng `autonomy.mjs --set` là sở thích riêng, không thuộc bộ `high`, nên high/safe giữ nó; `partRunner` thuộc bộ `high` (HIGH ghi nó) nên safe bỏ.
const HINTS = ['planRunner'];

const GIT_LABEL = {
  tracked: 'aip-gate.json được git theo dõi ⇒ khoá autonomy bị bỏ qua',
  ignored: 'aip-gate.json không theo dõi, đã gitignore',
  open: 'aip-gate.json không theo dõi, chưa gitignore',
  unknown: 'không xác định (git lỗi, hoặc đường dẫn là symlink chưa commit); trong repo git thì khoá autonomy bị bỏ qua',
};

const dump = (obj) => JSON.stringify(obj, null, 2) + '\n';

export function runAutonomy(sub, { root, out = console.log, err = console.error, run }) {
  if (!SUBS.has(sub)) { err(`Cách dùng: aip autonomy high|safe|status${sub ? ` (giá trị không hợp lệ: "${sub}")` : ''}`); return 2; }
  try { return runUnsafe(sub, { root, out, err, run }); } catch (e) { err(`Lỗi: ${e.message}`); return 1; }
}

function runUnsafe(sub, { root, out, err, run }) {
  const info = cliGate(root, { run });
  // File hỏng của repo chính cũng chặn: ghi file worktree lúc đó sẽ che nó mà người dùng chưa sửa.
  if (info.bad) { err(`Lỗi: ${info.bad} không phải đối tượng JSON hợp lệ; sửa tay trước khi chạy aip autonomy.`); return 1; }
  const g = info.g;

  const file = path.join(root, '.claude', 'aip-gate.json');
  const gitState = (f) => gitStateOf(f, run && { run });

  if (sub === 'status') {
    const eff = resolveAutonomy(root);
    const why = g.config?.autonomy === undefined ? ' (mặc định an toàn, aip-gate.json không có khoá autonomy)'
      : eff.ignored ? ` (mặc định an toàn: bỏ qua khoá autonomy vì aip-gate.json ${eff.ignored === 'tracked' ? 'đang được git theo dõi' : 'không xác định được trạng thái git'}; gỡ theo dõi: git rm --cached .claude/aip-gate.json)` : '';
    out(`autonomy: ${JSON.stringify(eff.value)}${why}`);
    out(`Nguồn: ${g.file ? `${g.file}${g.source === 'main' ? ' (repo chính; worktree này chưa có aip-gate.json)' : ''}` : 'không có'}`);
    out(`git: ${GIT_LABEL[gitState(g.file ?? file)]}`);
    for (const l of gateLines(info)) out(l);
    return 0;
  }

  // Ghi vào gốc hiện tại như `aip mode`: worktree chưa có file thì chép khoá của repo chính sang để không mất chúng (trừ khoá bị bỏ qua, xem cliGate).
  const next = { ...info.copy };
  // `mode` luôn bỏ khi chép từ repo chính, kể cả file chưa theo dõi: aip autonomy không phải lệnh bật full.
  const droppedMode = g.source === 'main' && 'mode' in (info.config ?? {});
  if (droppedMode) delete next.mode;
  const prior = next.autonomy && typeof next.autonomy === 'object' && !Array.isArray(next.autonomy) ? next.autonomy : {};
  const kept = Object.fromEntries(HINTS.filter((k) => k in prior).map((k) => [k, prior[k]]));
  if (sub === 'high') next.autonomy = { ...HIGH, ...kept };
  else if (!('autonomy' in next)) { out(`✓ autonomy=safe tại ${root} (không có khoá autonomy, không ghi gì)`); return 0; }
  else if (Object.keys(kept).length) next.autonomy = kept;
  else delete next.autonomy;

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, dump(next), 'utf8');
  out(`✓ autonomy=${sub} tại ${root}${sub === 'high' ? `: ${JSON.stringify(next.autonomy)}` : ''}`);
  if (g.source === 'main') out(`  ghi ${file}: cấu hình lấy từ repo chính, file của worktree này che file của repo chính từ giờ.`);
  if (droppedMode) out('  không chép khoá mode của repo chính; cần full trong worktree này thì chạy aip mode full.');
  if (sub === 'high') {
    // Như `full`, khoá trong file đã commit bị bỏ qua nên high ở file đã theo dõi là vô hiệu.
    const gs = gitState(file);
    if (gs === 'tracked') out('  ⚠ aip-gate.json đang được git theo dõi nên khoá autonomy bị bỏ qua (repo clone không tự cấp được). Gỡ theo dõi: git rm --cached .claude/aip-gate.json rồi thêm vào .gitignore.');
    else if (gs === 'open') out('  ⚠ aip-gate.json chưa được gitignore; nếu bị commit, khoá autonomy sẽ bị bỏ qua. Thêm dòng này vào .gitignore: .claude/aip-gate.json (aip không tự sửa .gitignore).');
    out('  Push/PR vẫn luôn hỏi; G1 (design), G2 (plan), G3 (diff cả nhánh) vẫn dừng chờ duyệt; cách chạy vẫn hỏi mỗi lần (partRunner chỉ là gợi ý).');
  }
  return 0;
}
