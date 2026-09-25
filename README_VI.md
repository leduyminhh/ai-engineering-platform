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

Người dùng cuối không cần clone repo — gói `ai-engineering-platform` phát hành trên npm
registry, hai bin `aip` và `ai-engineering-platform` trỏ cùng một CLI.

**1. Kiểm tra Node.js** — cần **v20 trở lên**:

```bash
node --version
```

**2. Cài global** (một lần mỗi máy; npm đặt bin vào PATH):

```bash
npm install -g ai-engineering-platform
```

**3. Xác minh cài đặt**:

```bash
aip --help        # in hướng dẫn CLI
aip check         # liệt kê năng lực đã cài (rỗng lúc đầu)
```

**4. Cài năng lực vào project** — đứng trong project đích, chạy wizard hoặc lệnh trực tiếp:

```bash
cd /duong-dan/project
aip                                   # wizard tương tác (menu install/uninstall/build/check)
# hoặc non-interactive:
aip install --provider all --plugin all --yes
aip install --provider claude --plugin backend --yes
```

**5. Kiểm tra kết quả** trong project: `aip check` liệt kê từng skill và file đã ghi
(ví dụ `.claude/skills/…`, `.cursor/rules/…`, khối baseline trong `CLAUDE.md` / `AGENTS.md`).

Sau này cập nhật gói:

```bash
npm update -g ai-engineering-platform
```

> `aip update` dành cho bản cài từ clone repo (git pull → rebuild → cài lại); với bản npm
> hãy dùng `npm update -g` như trên. Gỡ công cụ: `npm uninstall -g ai-engineering-platform`;
> gỡ năng lực khỏi project: `aip uninstall --yes` trong project đó.

Chạy một lần, không cài global — `npx` tải gói về npm cache và không thêm bin vào PATH:

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

## Agent & Workflow

Bên cạnh skill, nền tảng còn chiếu ra **agent** (subagent đảm nhận một vai trò, gói một hoặc
nhiều skill) và **workflow** (recipe nhiều bước, điều phối agent tuần tự, có checkpoint người
duyệt), cùng **`workflow-orchestrator`** để phân loại một yêu cầu tự do về đúng workflow. Agent
nằm ở `plugins/<id>/agents/<agent-id>.md`; workflow nằm ở thư mục cấp repo `workflows/<slug>/WORKFLOW.md`,
tách khỏi cây plugin vì workflow gọi xuyên nhiều plugin. Thiết kế đầy đủ:
`docs/superpowers/specs/2026-09-25-agents-workflows-design.md`.

Agent không commit, không push, không tạo PR, và không gọi agent khác — chỉ workflow (chạy ở
session chính) mới điều phối và gọi `core:git-workflow` sau checkpoint. Mọi báo cáo của agent
có cấu trúc (kết quả, `file:line`, residual risk); khẳng định "đã chạy / đã pass" luôn kèm
evidence, hoặc `not_run` + lý do.

### Agent (11)

`mode` trung lập với provider: Claude map `read-only` → `disallowedTools: Edit, Write, NotebookEdit, Agent`
và `write` → `disallowedTools: Agent`; Codex map `read-only` → `sandbox_mode: "read-only"` và
`write` → `"workspace-write"`.

| Agent id | Plugin | Mode | Skill gói | Dùng trong |
| --- | --- | --- | --- | --- |
| `backend-implementer` | backend | write | backend-implement, backend-api-contract | WF01, WF07, WF08 |
| `backend-test-writer` | backend | write | backend-testing | WF01, WF02, WF03, WF05, WF08 |
| `backend-reviewer` | backend | read-only | backend-code-review, backend-api-contract (kiểm drift) | WF01–WF04, WF07–WF09 |
| `frontend-implementer` | frontend | write | frontend-implement | WF01, WF08 |
| `frontend-test-writer` | frontend | write | frontend-testing | WF01, WF02, WF03, WF05 |
| `frontend-reviewer` | frontend | read-only | frontend-code-review | WF01–WF04 |
| `engineering-quality-auditor` | engineering | read-only | engineering-quality-gate, engineering-convention-enforce (chế độ kiểm) | WF01–WF04, WF06, WF11 |
| `engineering-spec-analyst` | engineering | write (chỉ `docs/`) | engineering-spec-writing, engineering-adr, engineering-diagram | WF01, WF03, WF10, WF12 |
| `engineering-release-scribe` | engineering | write (chỉ `docs/`, `CHANGELOG.md`) | engineering-release-notes | WF11 |
| `ops-incident-investigator` | ops | read-only | ops-incident-troubleshooting, ops-observability | WF10 |
| `ops-release-engineer` | ops | read-only | ops-deploy-release, ops-observability | WF11 |

Không có agent Security riêng: `engineering-quality-gate` đã phủ cả quality lẫn security review
source-first (OWASP/ASVS/CWE, SCA, secrets); tách ra chỉ trùng lặp.

### Workflow (12) + orchestrator

Id dạng `workflow-<slug>`, nguồn ở `workflows/<slug>/WORKFLOW.md`. `tier` quyết định độ sâu nội
dung (1 = nhiều gate/DoD chặt, 2 = đủ template nhưng gọn, 3 = gọn); `risk` quyết định mức độ
xác nhận bắt buộc của orchestrator.

| Mã | Id | Tier | Risk | Thay cho (plan cũ) | Agent |
| --- | --- | --- | --- | --- | --- |
| WF01 | `workflow-feature` | 1 | medium | W1+W2+W3 | spec-analyst, BE/FE implementer, BE/FE test-writer, BE/FE reviewer, quality-auditor |
| WF02 | `workflow-bugfix` | 1 | medium | W11 | BE/FE test-writer, BE/FE reviewer, quality-auditor |
| WF03 | `workflow-refactor` | 1 | medium | W4a+W4b+W6 | BE/FE test-writer, BE/FE reviewer, spec-analyst, quality-auditor |
| WF04 | `workflow-code-review` | 1 | low | W5 | BE/FE reviewer, quality-auditor |
| WF05 | `workflow-testing` | 2 | low | mới | BE/FE test-writer |
| WF06 | `workflow-security-review` | 1 | high | W14 | quality-auditor |
| WF07 | `workflow-db-change` | 2 | high | W15 | backend-implementer, backend-reviewer |
| WF08 | `workflow-api` | 2 | medium | mới (tách từ bước contract của W1) | backend-implementer, backend-test-writer, backend-reviewer, frontend-implementer |
| WF09 | `workflow-performance` | 3 | medium | W16 | backend-reviewer |
| WF10 | `workflow-incident` | 1 | critical | W9 | ops-incident-investigator, spec-analyst |
| WF11 | `workflow-release` | 2 | high | W8 | quality-auditor, release-scribe, release-engineer |
| WF12 | `workflow-docs` | 3 | low | W17 | spec-analyst |
| — | `workflow-orchestrator` | — | — | mới | không (chạy ở session chính) |

**Cách gọi:**

- Claude Code: `/workflow-orchestrator <yêu cầu>` để tự phân loại theo registry, hoặc gọi thẳng
  một workflow bằng `/workflow-<slug>` (vd `/workflow-bugfix`); xem/liệt kê subagent bằng
  `/agents`.
- Codex: gọi skill `workflow-<slug>` — workflow chiếu ra như skill native của Codex, cùng cơ
  chế với mọi skill khác.

**Cài đặt** (workflow đi qua cơ chế chọn có sẵn, không thêm flag CLI):

```bash
aip install --provider claude --plugin workflows
aip install --provider claude --skill workflows/workflow-feature,workflows/workflow-bugfix
aip install --provider codex -g --skill workflows/workflow-code-review
aip install --provider claude --as-plugin --plugin workflows
aip uninstall --skill workflows/workflow-feature
```

Cài một workflow sẽ tự kéo theo dependency closure (`requires` + skill của mọi agent workflow
đó liệt kê), in ra dạng `[aip] workflow-feature kéo theo: backend/backend-implement, …`; gỡ
workflow sẽ bỏ luôn phần không còn workflow nào khác cần tới.

### Roadmap

Theo dõi như gap còn mở trong bản thiết kế (`docs/superpowers/specs/2026-09-25-agents-workflows-design.md` §9) — chưa làm.

**Skill gap** (bước hiện workflow làm thẳng ở session chính, chưa tách thành skill tái dùng):

| # | Skill | Plugin | Hưởng lợi |
| --- | --- | --- | --- |
| G1 | `frontend-data-integration` (nối UI với API contract) | frontend | WF01, WF08 |
| G2 | `backend-migrate-db` (Flyway ↔ Liquibase) | backend | WF07 |
| G3 | `engineering-dependency-upgrade` | engineering | `workflow-dependency-upgrade` |
| G4 | `engineering-bugfix` (tái hiện → evidence → failing test → root cause → fix tối thiểu) | engineering | WF02 |
| G5 | `frontend-e2e-testing` (Playwright) | frontend | WF05 |
| G6 | `ops-ci-pipeline` (GitHub Actions / GitLab CI / Jenkins) | ops | WF11 |
| G7 | `engineering-codebase-onboarding` (brownfield → `project-knowledge/`) | engineering | `workflow-onboarding` |
| G8 | `engineering-tech-debt-audit` | engineering | `workflow-tech-debt-review` |
| G9 | `engineering-task-breakdown` | engineering | WF01 |
| G10 | `backend-performance-testing` (k6/JMeter/Gatling) | backend | WF09 |
| G11 | `engineering-docs-sync` | engineering | WF12 |

**Workflow tương lai:** `workflow-new-project`, `workflow-dependency-upgrade` (G3),
`workflow-onboarding` (G7), `workflow-tech-debt-review` (G8).

**Provider / nền tảng (P1–P7):**

| # | Hạng mục | Ghi chú |
| --- | --- | --- |
| P1 | Agent/workflow cho Cursor, Antigravity | Antigravity có thể chiếu sang `.agent/workflows/` native, Cursor sang `.cursor/commands/` [Unverified] |
| P2 | Claude native workflow `.js` | Fan-out tất định (vd WF04 nhiều module); tốn token, người dùng opt-in |
| P3 | Hooks (vd pre-commit gọi quality-auditor) | Hook trong plugin subagent bị Claude bỏ qua; phải đặt ở `settings.json` project |
| P4 | `[agents]` trong `.codex/config.toml` | Config bền vững, cần người dùng xác nhận tường minh |
| P6 | Workflow cho Cowork | Cowork không có subagent; chỉ thêm nếu có fallback tuần tự |
| P7 | Tầng Rules (coding/git/security/architecture/production) | Spec riêng. Hiện rule nằm rải ở `core/principles`, `shared/principles.md`, `AGENTS.md`, `git-workflow`, `code-convention.md`; còn thiếu rule Production (deploy/incident) |

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