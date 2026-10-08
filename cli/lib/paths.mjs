// Resolve install destinations per provider × scope. Zero-dependency.
//
// Scope:
//   project (mặc định) -> gốc = process.cwd()  (hoặc $AIE_INSTALL_ROOT để test/override)
//   global  (-g)        -> gốc = os.homedir()
//
// Mỗi provider có một thư mục cấu hình dưới gốc đó. Install COPY payload đã build vào đây;
// manifest `.ai-engineering/manifest.json` ở gốc ghi lại file đã copy để check/uninstall chính xác.
import os from 'node:os';
import path from 'node:path';

// Provider ĐANG HỖ TRỢ — danh sách này lái: wizard, install/init "all", help text.
// PENDING: 'antigravity' tạm GỠ khỏi đây (chưa hoàn thiện đường cài `agy plugin install`) nên
// KHÔNG hiện trong wizard và KHÔNG cài khi chọn "all". Adapter vẫn build (build/antigravity/) và
// vẫn cài được nếu gọi tường minh `--provider antigravity` (PROVIDER_LAYOUT bên dưới còn giữ).
export const PROVIDERS = ['claude', 'cursor', 'codex'];

/** Gốc cài đặt theo scope. $AIE_INSTALL_ROOT override (dùng cho test). */
export function scopeRoot(scope) {
  if (process.env.AIE_INSTALL_ROOT) return path.resolve(process.env.AIE_INSTALL_ROOT);
  return scope === 'global' ? os.homedir() : process.cwd();
}

export function manifestPath(scope) {
  return path.join(scopeRoot(scope), '.ai-engineering', 'manifest.json');
}

/**
 * Mô tả cách 1 provider đặt file dưới gốc. `kind` quyết định layout copy:
 *   - 'claude'  : mỗi skill-dir của plugin -> <root>/.claude/skills/<skillDir>/ (phẳng; id duy nhất)
 *                 thành phần khác (commands/agents/hooks/.mcp.json) -> <root>/.claude/<comp>
 *   - 'cursor'  : rules -> <root>/.cursor/rules/<id>-00-principles.mdc; skills -> <root>/.cursor/skills/<skill-id>/
 *   - 'codex'   : mỗi skill-dir -> <root>/.agents/skills/<skill-id>/ (native skills; global -g → ~/.agents/skills/); agent TOML → <root>/.codex/agents/
 *   - 'agents'  : antigravity; 1 plugin -> gốc (AGENTS.md + docs/workflow/), nhiều plugin -> <root>/cowork-<provider>/<plugin>/
 * [Inference] Đường dẫn tool thực đọc (.claude/skills, .cursor/rules + .cursor/skills, ~/.agents/skills,
 * AGENTS.md ở gốc) theo tài liệu từng tool; nếu tool đổi vị trí, chỉ cần sửa map này.
 */
export const PROVIDER_LAYOUT = {
  claude: { kind: 'claude', label: 'Claude Code', base: '.claude' },
  cursor: { kind: 'cursor', label: 'Cursor', base: '.cursor' },
  codex: { kind: 'codex', label: 'OpenAI Codex', base: '.agents/skills' },
  antigravity: { kind: 'agents', label: 'Google Antigravity', base: '.' }, // PENDING (xem PROVIDERS)
};
