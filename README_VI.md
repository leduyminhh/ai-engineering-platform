# AI Engineering Platform

`ai-engineering-platform` (CLI: `aip`) là nền tảng plugin giữ **một nguồn sự thật
duy nhất** cho nội dung năng lực AI-agent và chiếu (project) nó ra layout gốc của
**Codex, Claude Code, Cursor, và Google Antigravity**. Viết năng lực MỘT LẦN dưới
`plugins/` và `core/`; CLI sinh skill/marketplace/rules/workflow cho từng provider
vào project đích, và chèn khối baseline "AI Engineering" vào `AGENTS.md` / `CLAUDE.md`
của project đó.

Pure ESM, **zero runtime dependency**, không có bước build. Node.js 20+.

> English: xem [README.md](README.md).

## Bắt đầu nhanh

```bash
git clone https://github.com/leduyminhh/ai-engineering-platform.git
cd ai-engineering-platform
npm install        # không biên dịch gì — chỉ cài dev tooling
npm test           # mọi suite phải pass
npm link           # đưa `aip` lên PATH
```

Cài năng lực vào project khác:

```bash
cd /duong-dan/project
aip                                   # wizard tương tác
# hoặc non-interactive:
aip install --provider claude --plugin backend --yes
aip install --provider all --plugin all --yes
aip install --provider codex --plugin all -g   # scope global
# chọn skill lẻ (plugin/skill):
aip install --provider claude --skill backend/backend-init,core/git-workflow --yes
aip uninstall --skill backend/backend-migrate-architecture --yes
```

`aip` và `ai-engineering-platform` gọi cùng một CLI. `aip --help` in hướng dẫn.

## Cài từ npm

Người dùng cuối không cần clone repo. Sau khi gói đã phát hành lên npm registry:

```bash
npm install -g ai-engineering-platform   # cài global, `aip` sẵn trên PATH
aip --help
cd /duong-dan/project
aip install --provider all --plugin all --yes
```

Chạy một lần không cài global:

```bash
npx ai-engineering-platform install --provider all --plugin all --yes
```

## Cấu trúc

| Đường dẫn | Vai trò |
| --- | --- |
| `plugins/` | Nguồn năng lực: `<id>/.manifest.json` + `shared/principles.md` + `skills/<skill>/SKILL.md`, cùng `_marketplace.json` và `_cowork.json`. |
| `core/` | Baseline dùng chung: `agents/AGENTS.template.md`, `principles/`, và recipe dùng chung `skills/git-workflow/`. |
| `templates/` | `init/` khung project (do skill `*-init` drop ra) và `skills/` khung viết skill. |
| `adapters/` | Chiếu theo provider (`<provider>/adapter.mjs`), auto-discover. `_shared/lib.mjs` chứa logic dùng chung. |
| `cli/` | CLI `aip` (`index.mjs` + `lib/*.mjs` + `build.mjs`). Pure ESM, zero-dep. |
| `test/` | Validator hợp đồng + test install/wizard/managed-block/pack-guard. |
| `docs/` | Bản thiết kế và spec. |
| `completions/` | Shell completion cho `aip` (xem [SHELL_SETUP.md](SHELL_SETUP.md)). |

## Danh mục plugin

Nội dung được giữ gọn: `core`, các domain plugin (`backend`, `frontend`, `data`) và
plugin capability xuyên suốt (`engineering`, `ops`); skill là **recipe độc lập,
gọi-khi-cần** (KHÔNG có pipeline bắt buộc). Tập publish nằm ở `plugins/_published.json`
— mỗi phần tử là CẢ plugin (`backend`) hoặc MỘT skill (`frontend/frontend-init`); wizard
chỉ offer phần được liệt kê, và `npm run build` sinh `build/wizard-install-report.md`.
Plugin không có skill nào được publish (vd `data`, `ops`) là draft, chỉ cài bằng `--plugin`.

| Plugin | Năng lực | Skill |
| --- | --- | --- |
| `core` | Baseline mọi plugin phụ thuộc. | `principles`, `git-workflow` |
| `backend` | Project backend (REST API / service). | `backend-init`, `backend-migrate-architecture`, `backend-migrate-vault-consul` |
| `frontend` | Project frontend (web app / SPA). | `frontend-init`, `frontend-migrate-architecture` |
| `data` | Project dữ liệu — CSDL OLTP (`data-oltp-*`) + kho/pipeline OLAP (`data-olap-*`). *(draft, chưa publish)* | `data-oltp-init`, `data-olap-init` |
| `engineering` | Capability kỹ thuật xuyên suốt (quality gate, spec, diagram, ADR, release notes, convention). | `engineering-quality-gate`, `engineering-spec-writing`, `engineering-adr` |
| `ops` | Maintain server — deploy/release, xử lý sự cố, observability. | `ops-deploy-release`, `ops-incident-troubleshooting`, `ops-observability` |

Mỗi skill `*-init` là **bộ scaffold TÀI LIỆU**: drop cây `templates/init` +
`AGENTS.template.md`, hỏi thông tin nền (stack / framework / engine / nguồn), rồi điền
`project-knowledge/`. Hai recipe `migrate-*` của backend tái cấu trúc codebase có sẵn
(kiến trúc; hoặc config → Vault/Consul).

Gọi skill trong Claude Code: `/<plugin>:<skill>` (vd `/backend:backend-init`).

## CLI

Mọi lệnh chạy `node cli/index.mjs`.

```bash
aip                 # menu wizard: install | uninstall | build | check
aip install   --provider all|<p>... [--plugin all|<id>...] [--skill <a,b>] [-g] [--yes] [--as-plugin]
aip uninstall [--provider ...] [--plugin ...] [--skill <a,b>] [-g] [--yes]   # alias: remove
aip build     --provider all|<p>...   # cờ alias: --target
aip check     [-g]
aip update    [-g]        # git pull + build lại + cài lại các install đã ghi
aip pack                  # đóng gói skill Cowork -> build/cowork/<skill>.zip
aip list                  # adapter + plugin phát hiện được
```

- **Scope**: `project` (mặc định, cwd) hoặc `global` (`-g` / `--scope global`, thư mục home).
- **`--plugin <id>...`** chọn **nguyên plugin** (mọi skill của nó); **`--skill <a,b>`** chọn
  **skill lẻ** dạng `plugin/skill` (vd `backend/backend-init`) — tên skill trần chỉ nhận khi
  không trùng. `--plugin` và `--skill` hợp nhất với nhau. `core/principles` luôn được cài
  (ép bật); `core/git-workflow` chọn lẻ được (mặc định bật cùng plugin nguyên khối, muốn bỏ thì
  dùng `--skill core/...` tường minh).
- **Install** ưu tiên symlink (junction trên Windows) + fallback copy, và **cộng dồn** —
  cài thêm plugin hay skill sẽ hợp với cái đã có. Đồng thời chèn khối baseline vào file chỉ dẫn của project.
- **`--as-plugin`** (chỉ Claude) cài qua CLI `claude` như PLUGIN THẬT (marketplace +
  namespaced `<id>:<skill>`) thay vì copy phẳng vào `.claude/skills/`; cần có `claude` trên PATH.
  Nó cài NGUYÊN plugin của mỗi skill được chọn (plugin-mode không tách skill) và cảnh báo khi
  `--skill` bị thu hẹp.
- **Wizard** chọn ở mức skill: skill được gộp theo plugin (toggle header plugin cascade xuống mọi
  skill con), nên có thể chọn cả plugin hoặc từng skill trong một danh sách; `core/principles`
  luôn khoá-bật.
- **Uninstall** (alias `remove`) chỉ gỡ path đã track (không đụng target của link), prune thư mục
  rỗng, và đếm-tham-chiếu khối managed dùng chung.
- Provider cài mặc định: `claude`, `cursor`, `codex`. `antigravity` có build nhưng chỉ cài
  khi gọi tường minh (`--provider antigravity`).

State mỗi lần cài nằm ở `<scope-root>/.ai-engineering/manifest.json`.

## Đầu ra theo provider

`aip build` ghi một cây cho mỗi provider dưới `build/<provider>/`:

| Provider | Đầu ra build | Cài vào (scope project) |
| --- | --- | --- |
| Claude | `.claude-plugin/marketplace.json` + `plugins/<id>/` (core là plugin dependency) | `.claude/skills/<skill>`; khối baseline → `CLAUDE.md` |
| Cursor | `<id>/.cursor/rules/<id>-00-principles.mdc` + `.cursor/skills/<skill>/` | `.cursor/rules` + `.cursor/skills` |
| Codex | `<id>/skills/<skill>/SKILL.md` (native skills) | `.codex/skills/<skill>` (global: `~/.codex/skills`); khối baseline → `AGENTS.md` |
| Antigravity | `<id>/AGENTS.md` + `docs/workflow/<skill>/` | khi cài tường minh; khối baseline → `AGENTS.md` |

Skill nào ship thư mục `references/` thì ship tới **mọi** provider (parity, do
`test/validate.mjs` bắt buộc).

## Viết nội dung

- **Skill mới** → thêm `plugins/<id>/skills/<skill-id>/SKILL.md` với frontmatter (`name`,
  `description`, `order`, `title`, `runsIn`, `invoke`, `pipeline: false`, `next: null`).
  Tự động được phát hiện — không phải khai vào manifest. File tham chiếu đặt dưới
  `skills/<skill>/references/`.
- **Hành vi provider mới** → sửa `adapters/<provider>/adapter.mjs`; giữ là hàm thuần
  `build(plugins, { outDir, marketplace, core }) -> fileEntry[]` với entry là
  `{path, content}` | `{path, copyFrom}` | `{path, copyDir}`.
- Chạy `npm run build` và `npm test` (đã gồm `test/validate.mjs --build`).

## Maintainer

```bash
npm test            # validate --build + install + wizard + managed-block + pack-guard
npm run build       # build tất cả provider vào build/
npm run validate    # hợp đồng source + build-output
npm run pack:verify # kiểm tập file npm-publish nằm trong pack.config.json
```

Cowork upload: `cli/lib/pack.mjs` đóng gói tập skill khai trong `_cowork.json` thành
`build/cowork/<skill>.zip` tất định cho Customize → Skills → Upload.

## Phát hành lên npm (maintainer)

Gói dùng allowlist `files[]` trong `package.json`; hook `prepack` tự chạy pack-guard
(fail-loud nếu tập file lệch `pack.config.json`). Gói không có scope nên mặc định public.
Làm theo thứ tự:

```bash
# 1. Đăng nhập npm (một lần mỗi máy); npm whoami để kiểm tra
npm login

# 2. Xác thực trước khi phát hành
npm test
npm run build

# 3. Kiểm tập file sẽ publish (không tạo file thật)
npm run pack:verify        # hoặc npm run pack:show để xem danh sách
npm pack --dry-run         # xem chính xác nội dung tarball

# 4. Bump version — tạo commit + tag vX.Y.Z, yêu cầu cây git sạch
npm version patch          # hoặc minor | major

# 5. Phát hành (prepack chạy pack-guard trước khi đóng gói)
npm publish

# 6. Đẩy commit + tag lên remote
git push --follow-tags
```

Lưu ý: một version đã publish **không** ghi đè được; muốn sửa phải bump version mới.
Không phát hành từ nhánh bảo vệ — bump/tag trên nhánh làm việc, để người review duyệt.

## Tài liệu

- [CHANGELOG.md](CHANGELOG.md) — lịch sử phiên bản.
- [MIGRATION.md](MIGRATION.md) — hướng dẫn nâng cấp.
- [docs/superpowers/specs/](docs/superpowers/specs/) — bản thiết kế.

## Checklist thay đổi

- Cập nhật `README.md` trước, rồi đồng bộ [README_VI.md](README_VI.md).
- Giữ danh mục plugin và bảng provider khớp `plugins/` và `adapters/`.
- Chạy `npm test` sau mọi thay đổi cấu trúc, nội dung, hoặc projection.
