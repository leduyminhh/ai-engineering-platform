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

> **Gói npm chỉ ship core** — nguyên tắc nền tảng và skill `git-workflow` / `git-release` / `artifact-templates` / `plan-execution`
> (`core:principles` + `core:git-workflow` + `core:git-release` + `core:artifact-templates` + `core:plan-execution`). Các plugin (`backend`, `frontend`, `engineering`,
> `ops`, `data`) và workflow **không** có trong gói; hãy cài từ source:
> `git clone` + `npm link` (xem [Bắt đầu nhanh](#bắt-đầu-nhanh)), rồi `aip install --plugin all`, hoặc
> `aip --all` để mở wizard với mọi skill kể cả draft.

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
# hoặc non-interactive (gói npm chỉ có core nên chỉ cài git-workflow + principles):
aip install --provider all --yes
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
npx ai-engineering-platform install --provider all --yes
```

## Cấu trúc

| Đường dẫn | Vai trò |
| --- | --- |
| `plugins/` | Nguồn năng lực: `<id>/.manifest.json` + `shared/principles.md` + `skills/<skill>/SKILL.md`, cùng `_marketplace.json` và `_cowork.json`. |
| `core/` | Baseline dùng chung: `agents/AGENTS.template.md`, `principles/`, recipe dùng chung `skills/git-workflow/`, `skills/git-release/`, `skills/plan-execution/` (giao thức vòng task, 3 script Node) và `skills/artifact-templates/` (11 template artifact, gồm `spec` cho spec sống ở `docs/specs/`; `check-request.mjs` cảnh báo W1–W18), và `hooks/` an toàn (chỉ plugin-mode). |
| `evals/` | Case `claude plugin eval` theo plugin (chạy tay; không ship; `npm test` chỉ kiểm cấu trúc). |
| `templates/` | `init/` khung project (do skill `*-init` drop ra); `project-knowledge/`, `docs/requests/_TEMPLATE/` và `docs/decisions/_TEMPLATE.md` sinh từ `core/skills/artifact-templates/`. |
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
chỉ offer phần được liệt kê (khi chạy từ source; gói npm chỉ ship core), và `npm run build` sinh `build/wizard-install-report.md`.
Skill chưa được publish của một plugin (vd các skill `data-oltp-*` / `data-olap-*`) là draft, cài bằng `--plugin`/`--skill`, hoặc `aip --all` trong wizard (chỉ ở chế độ skills).

| Plugin | Năng lực | Skill |
| --- | --- | --- |
| `core` | Baseline mọi plugin phụ thuộc. | `principles`, `git-workflow`, `git-release`, `artifact-templates` |
| `backend` | Project backend (REST API / service). | `backend-init`, `backend-migrate-architecture`, `backend-migrate-vault-consul` |
| `frontend` | Project frontend (web app / SPA). | `frontend-init`, `frontend-migrate-architecture` |
| `data` | Project dữ liệu — CSDL OLTP (`data-oltp-*`) + kho/pipeline OLAP (`data-olap-*`). *(publish một phần: `data-db-migration`; skill OLTP/OLAP còn draft)* | `data-db-migration`, `data-oltp-init`, `data-olap-init` |
| `engineering` | Capability kỹ thuật xuyên suốt (quality gate, spec, phân rã task, diagram, ADR, release notes, convention). | `engineering-quality-gate`, `engineering-spec-writing`, `engineering-task-breakdown`, `engineering-adr` |
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
tách khỏi cây plugin vì workflow gọi xuyên nhiều plugin.

Agent không commit, không push, không tạo PR, và không gọi agent khác — chỉ workflow (chạy ở
session chính) mới điều phối và gọi `core:git-workflow` sau checkpoint. Mọi báo cáo của agent
có cấu trúc (kết quả, `file:line`, residual risk); khẳng định "đã chạy / đã pass" luôn kèm
evidence, hoặc `not_run` + lý do.

### Agent (16)

`mode` trung lập với provider: Claude map `read-only` → `disallowedTools: Edit, Write, NotebookEdit, Agent`
và `write` → `disallowedTools: Agent`; Codex map `read-only` → `sandbox_mode: "read-only"` và
`write` → `"workspace-write"`.

| Agent id | Plugin | Mode | Skill gói | Dùng trong |
| --- | --- | --- | --- | --- |
| `backend-implementer` | backend | write | backend-implement, backend-api-contract | WF01 |
| `backend-test-writer` | backend | write | backend-testing | WF02, WF06 |
| `backend-reviewer` | backend | read-only | backend-code-review, backend-api-contract (kiểm drift) | WF01, WF02, WF06, WF09 |
| `backend-fixer` | backend | write | backend-fix | WF02, WF06, WF09 |
| `backend-performance-analyst` | backend | write | backend-performance | WF09 |
| `data-migration-writer` | data | write | data-db-migration | skill data-db-migration |
| `frontend-implementer` | frontend | write | frontend-implement | WF01 |
| `frontend-data-integrator` | frontend | write | frontend-data-integration | WF01 |
| `frontend-test-writer` | frontend | write | frontend-testing | WF01, WF02, WF06 |
| `frontend-e2e-test-writer` | frontend | write | frontend-e2e-testing | WF01 |
| `frontend-reviewer` | frontend | read-only | frontend-code-review | WF01, WF02, WF06, WF09 |
| `frontend-fixer` | frontend | write | frontend-fix | WF02, WF06, WF09 |
| `frontend-performance-analyst` | frontend | write | frontend-performance | WF09 |
| `engineering-quality-auditor` | engineering | read-only | engineering-quality-gate, engineering-convention-enforce (chế độ kiểm) | WF01, WF02, WF06 |
| `engineering-spec-analyst` | engineering | write (chỉ `docs/`) | engineering-spec-writing, engineering-adr, engineering-diagram, engineering-task-breakdown | WF01 |
| `ops-incident-investigator` | ops | read-only | ops-incident-troubleshooting, ops-observability | skill ops-incident-troubleshooting |

Không có agent Security riêng: `engineering-quality-gate` đã phủ cả quality lẫn security review
source-first (OWASP/ASVS/CWE, SCA, secrets); tách ra chỉ trùng lặp.

### Workflow (4) + orchestrator

Id dạng `workflow-<slug>`, nguồn ở `workflows/<slug>/WORKFLOW.md`. `tier` quyết định độ sâu nội
dung (1 = nhiều gate/DoD chặt, 2 = đủ template nhưng gọn, 3 = gọn); `risk` quyết định mức độ
xác nhận bắt buộc của orchestrator.

| Mã | Id | Tier | Risk | Thay cho (plan cũ) | Agent |
| --- | --- | --- | --- | --- | --- |
| WF01 | `workflow-feature` | 1 | medium | W1+W2+W3 | spec-analyst, BE/FE implementer, FE data-integrator, FE test-writer, FE e2e-test-writer, BE/FE reviewer, quality-auditor |
| WF02 | `workflow-bugfix` | 1 | medium | W11 | BE/FE test-writer, BE/FE fixer, BE/FE reviewer, quality-auditor |
| WF06 | `workflow-security-review` | 1 | high | W14 | quality-auditor, backend-test-writer, frontend-test-writer, backend-fixer, frontend-fixer |
| WF09 | `workflow-performance` | 3 | medium | W16 | backend-performance-analyst, frontend-performance-analyst, backend-fixer, frontend-fixer, backend-reviewer, frontend-reviewer |
| — | `workflow-orchestrator` | — | — | mới | không (chạy ở session chính) |

`workflow-feature` chạy 7 bước: baseline → làm rõ & cỡ việc ⏸ → tài liệu ⏸ → plan ⏸ → vòng task (mỗi task: implement theo `kind`, review, sửa tối đa 3 vòng, commit) → review cuối → kết thúc nhánh ⏸. Tiến độ ghi vào ledger (`docs/requests/<ngày>-<slug>/.sdd/progress.md`) để phiên bị nén hoặc phiên mới làm tiếp từ task đầu tiên chưa `complete`; giao thức nằm ở skill `core:plan-execution`.

Việc chỉ cần một năng lực gọi thẳng skill (orchestrator cũng chỉ đường tới skill): review →
`backend-code-review`/`frontend-code-review`; refactor → `*-refactor`/`*-migrate-architecture`; viết test →
`*-testing`; đổi schema → `data-db-migration`; sự cố → `ops-incident-troubleshooting`.

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
aip install --provider codex -g --skill workflows/workflow-security-review
aip install --provider claude --as-plugin --plugin workflows
aip uninstall --skill workflows/workflow-feature
```

Cài một workflow sẽ tự kéo theo dependency closure (`requires` + skill của mọi agent workflow
đó liệt kê), in ra dạng `[aip] workflow-feature kéo theo: backend/backend-implement, …`; gỡ
workflow sẽ bỏ luôn phần không còn workflow nào khác cần tới.

### Roadmap

Các gap còn mở — chưa làm.

**Skill gap** (bước hiện workflow làm thẳng ở session chính, chưa tách thành skill tái dùng):

| # | Skill | Plugin | Hưởng lợi |
| --- | --- | --- | --- |
| G3 | `engineering-dependency-upgrade` | engineering | `workflow-dependency-upgrade` |
| G4 | `engineering-bugfix` (tái hiện → evidence → failing test → root cause → fix tối thiểu) | engineering | WF02 |
| G6 | `ops-ci-pipeline` (GitHub Actions / GitLab CI / Jenkins) | ops | — |
| G7 | `engineering-codebase-onboarding` (brownfield → `project-knowledge/`) | engineering | `workflow-onboarding` |
| G8 | `engineering-tech-debt-audit` | engineering | `workflow-tech-debt-review` |
| G11 | `engineering-docs-sync` | engineering | — |

**Workflow tương lai:** `workflow-new-project`, `workflow-dependency-upgrade` (G3),
`workflow-onboarding` (G7), `workflow-tech-debt-review` (G8).

**Provider / nền tảng (P1–P7):**

| # | Hạng mục | Ghi chú |
| --- | --- | --- |
| P1 | Agent/workflow cho Cursor, Antigravity | Antigravity có thể chiếu sang `.agent/workflows/` native, Cursor sang `.cursor/commands/` [Unverified] |
| P2 | Claude native workflow `.js` | Fan-out tất định (vd review nhiều module); tốn token, người dùng opt-in |
| P3 | Hooks (vd pre-commit gọi quality-auditor) | Hook trong plugin subagent bị Claude bỏ qua; phải đặt ở `settings.json` project |
| P4 | `[agents]` trong `.codex/config.toml` | Config bền vững, cần người dùng xác nhận tường minh |
| P6 | Workflow cho Cowork | Cowork không có subagent; chỉ thêm nếu có fallback tuần tự |
| P7 | Tầng Rules (coding/git/security/architecture/production) | Spec riêng. Hiện rule nằm rải ở `core/principles`, `shared/principles.md`, `AGENTS.md`, `git-workflow`, `code-convention.md`; còn thiếu rule Production (deploy/incident) |

## CLI

Mọi lệnh chạy `node cli/index.mjs`.

```bash
aip                 # menu wizard: init | install | uninstall | update | build
aip --all           # wizard liệt kê MỌI skill kể cả draft + mọi workflow (cài từ source)
aip init      [--full]    # AGENTS.md (baseline) + CLAUDE.md import @AGENTS.md; --full thêm khung templates/init và .claude/settings.json (chính sách quyền, chỉ khi chưa có); bỏ qua file đã có
aip install   --provider all|<p>... [--plugin all|<id>...] [--skill <a,b>] [-g] [--yes] [--as-plugin]
aip uninstall [--provider ...] [--plugin ...] [--skill <a,b>] [-g] [--yes]   # alias: remove
aip build     --provider all|<p>...   # cờ alias: --target
aip check     [-g]
aip update    [-g]        # git pull + build lại + cài lại các install đã ghi
aip pack                  # đóng gói skill Cowork -> build/cowork/<skill>.zip
aip list                  # adapter + plugin phát hiện được
aip mode      full|ask|status   # chế độ quyền theo project (chỉ phạm vi project); xem Hooks > Chế độ quyền
aip stats     [--session <path>] [--json] [--usage [--since <số ngày|yyyy-mm-dd>]]   # kích thước context, hoặc token + tiền theo model, từ transcript
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
- **`--all`** làm wizard liệt kê mọi skill có trong source — gồm draft (vd các skill `data-oltp-*` / `data-olap-*`, gắn nhãn
  `(draft)`) và toàn bộ workflow — thay vì chỉ phần `plugins/_published.json` cho phép offer. Cờ này
  không tắt wizard; lệnh non-interactive `aip install --plugin all` vốn đã cài tất cả.
- **Uninstall** (alias `remove`) chỉ gỡ path đã track (không đụng target của link), prune thư mục
  rỗng, và đếm-tham-chiếu khối managed dùng chung.
- **`aip stats`** đọc các transcript Claude Code của project hiện tại. Không cờ thì in bảng 10 phiên đầu theo đỉnh context (số lượt, đầu, đỉnh, cuối); `--session <path>` in phân rã đầy đủ một phiên; `--json` in JSON thô. `--usage [--since <số ngày|yyyy-mm-dd>]` (mặc định 7 ngày, lọc theo timestamp của từng dòng) tổng hợp token và tiền theo model, phiên chính so với subagent, kèm tín hiệu cache (đổi model, khoảng nghỉ trên 60 phút trước lượt ghi cache lớn, lượt ghi cache trên 50% context). Tiền lấy từ bản ghi `cost-state` do Claude Code ghi: tính cho cả phiên gồm subagent, không chia theo cửa sổ `--since`, và có thể lệch hóa đơn. aip không có bảng giá (không tự giữ bảng giá) và không dự đoán hạn mức gói; phiên thiếu `cost-state` hiển thị `—` cho tiền. [Unverified] Lệnh dựa vào layout `~/.claude/projects/<slug>/*.jsonl` và ý nghĩa của `cost-state`, đều là nội bộ của Claude Code, không phải hợp đồng công khai. Bảng chỉ hiện tỷ lệ subagent; phân rã theo từng agent nằm ở `--json`. `--since yyyy-mm-dd` nghĩa là 0h UTC của ngày đó. Mỗi `message.id` chỉ tính một lần trên toàn project, kể cả bản sao fork/resume; phiên bị bỏ lượt như vậy được đánh dấu trong bảng (tiền từ `cost-state` không bị trừ). Lệnh chỉ đọc, không in nội dung hội thoại và không ghi gì.
- Provider cài mặc định: `claude`, `cursor`, `codex`. `antigravity` có build nhưng chỉ cài
  khi gọi tường minh (`--provider antigravity`).

`aip build` không đưa skill draft vào marketplace của Claude: chúng được ghi vào `build/claude/drafts/<plugin>/…` và vẫn cài được bằng `--plugin`/`--skill` (chỉ ở chế độ skills — `--as-plugin` cài plugin từ marketplace, không có skill draft). Thêm `--include-draft` (`node cli/build.mjs --include-draft`) để build draft vào cây plugin như trước.

State mỗi lần cài nằm ở `<scope-root>/.ai-engineering/manifest.json`.

## Phân phối

Có hai cách đưa nội dung Claude vào một project:

- **Plugin-mode — đường chuẩn cho Claude.** `aip install --provider claude --as-plugin` (hoặc tự thêm marketplace) cài plugin thật, đặt tên `<id>:<skill>`. Chỉ plugin-mode mang **hook** của core (`${CLAUDE_PLUGIN_ROOT}` chỉ tồn tại với plugin đã cài).
- **Skills-mode** — `.claude/skills/` phẳng. Dùng khi muốn chọn lẻ từng skill hoặc đóng gói skill cho Cowork (`aip pack`). Chế độ này **không cài hook**.

Không cài cùng một plugin ở cả hai chế độ: mỗi skill sẽ hiện hai lần. `aip install` ở skills-mode nay cảnh báo khi `claude plugin list` cho thấy plugin được chọn đã cài từ marketplace này (bỏ qua khi đặt `AIE_INSTALL_ROOT`, và bỏ qua im lặng khi không có `claude` trên PATH).

Lưới an toàn model cho subagent: agent của plugin đã khai `model: sonnet`. Với subagent ngoài plugin, đặt `{"env": {"CLAUDE_CODE_SUBAGENT_MODEL": "sonnet"}}` trong `~/.claude/settings.json`. Thứ tự ưu tiên model của subagent ([sub-agents](https://code.claude.com/docs/en/sub-agents)): tham số lúc gọi → frontmatter `model` → biến môi trường `CLAUDE_CODE_SUBAGENT_MODEL` → model của phiên chính. `aip` không bao giờ tự ghi settings của người dùng.

Phát hành marketplace từ một branch git (maintainer; cần git >= 2.42 cho `git worktree add --orphan`):

```bash
node cli/dist.mjs --dry-run   # build rồi chỉ in danh sách file và commit message
node cli/dist.mjs             # build rồi commit build/claude (trừ drafts/) vào branch CỤC BỘ `dist`
git push origin dist          # do bạn quyết định — script không bao giờ push
```

Người dùng thêm marketplace bằng `claude plugin marketplace add <owner>/<repo>@dist`. [Unverified] Việc cài marketplace từ ref là branch chưa được thử đầu-cuối; hãy kiểm một lần sau lần push đầu tiên.

## Hooks

Plugin `core` mang năm hook cho Claude Code (`core/hooks/`; Node không phụ thuộc thư viện): ba cổng `PreToolUse` (`guard-bash` và `guard-files`: H1–H5 bên dưới; `guard-mcp`, bên dưới), cổng kiểm chứng `Stop`/`SubagentStop` (`gate-stop`, bên dưới) và hook `SessionStart` (`session-start`, bên dưới). **Chỉ có ở cài đặt plugin-mode** — skills-mode (`.claude/skills/` phẳng) không cài hook nào vì `${CLAUDE_PLUGIN_ROOT}` chỉ tồn tại với plugin đã cài. Cài đặt managed `allowManagedHooksOnly` sẽ tắt hook của plugin nào không được quản trị viên force-enable.

| Quy tắc | Tool | Quyết định | Phạm vi |
| --- | --- | --- | --- |
| H1 | Bash, PowerShell | ask | `git push` lên `main`/`master`/`dev`/`develop`, và push `--force`/`--delete`/`--mirror`/`--all`/`--prune` (lệnh ghép, `git -C`, đích của `cd`/`chdir`/`pushd`/`Push-Location`/`Set-Location`/`sl` đứng trước (bỏ qua `--`), ref có nháy, cụm cờ). Đích `cd` chứa `$`, `~`, backtick, `-` hoặc để trống, `popd`/`Pop-Location`, hay lệnh đứng sau `||` / `|` mà phía trước có `cd` thì không resolve được: push không refspec / `HEAD` / `@` sẽ hỏi |
| H2 | Bash, PowerShell | deny | `git commit -m` có ký tự non-ASCII — dùng `git commit -F <file>` (xem skill `git-workflow`) |
| H3 | Read, Edit, Write, MultiEdit, NotebookEdit, Grep | deny | file bí mật: `.env*`, `*.env`, `.envrc`, `*.pem`/`*.jks`/`*.keystore`/`*.p12`/`*.pfx`/`*.key`/`*.ppk`/`*.p8`, khoá riêng `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519` (kể cả `_sk` và hậu tố bất kỳ khác `.pub`), và chỉ `credentials`/`credentials.json`/`credentials.yml`/`credentials.yaml` (có giải symlink và NTFS stream; [Unverified] tên ngắn 8.3). `.env.example`/`.env.sample`/`.env.template` và `*.pub` được phép |
| H3 | Bash, PowerShell | ask | lệnh nhắc tới file bí mật |
| SS | SessionStart | context | `startup`/`clear`/`compact`: nạp `handoff.md` dùng được mới nhất và đuôi ledger plan chưa xong mới nhất; `resume`/`fork` phiên đã nguội: một dòng cảnh báo chi phí (xem `session-start` bên dưới) |
| H5 | Edit, Write, MultiEdit, NotebookEdit | deny | agent có `writeScope` ghi ngoài phạm vi (neo theo gốc git của file đích, không phải của cwd phiên): `engineering-spec-analyst`, `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer`. Phiên chính và agent khác không bị khoá |

Script fail-open: lỗi nội bộ (stdin rỗng, JSON hỏng, thiếu trường) thoát 0 không quyết định. Khi `guard-bash` không phân tích chắc chắn được lệnh thì nghiêng về `ask` (`guard-files` không có hành vi này). Không có H4: agent ops không có tool Bash.

**Công tắc theo project `allowEnvFiles`.** Đặt `{"allowEnvFiles": true}` trong `<git-root>/.claude/aip-gate.json` thì H3 không hỏi/chặn file env (`.env*`, `*.env`, `.envrc`) trong project đó nữa; file khoá và `credentials*` vẫn bị chặn, kể cả khi lệnh nhắc tới chúng cùng file env, còn H1/H2/H5 giữ nguyên. File được đọc ở gốc worktree trước, rồi tới gốc repo chính, nên worktree tạo trước khi file được commit vẫn theo project. `guard-files` đọc công tắc theo repo chứa file đích (không theo cwd của phiên); `guard-bash` đọc theo cwd của phiên. Không có file, JSON hỏng hoặc giá trị khác `true` thì giữ mặc định. Quy tắc file bí mật trong baseline vẫn áp cho agent; công tắc chỉ bỏ lời hỏi của hook.

**Cổng MCP (`guard-mcp`).** Hook `PreToolUse` với matcher `mcp__.*`; đọc hai mảng chuỗi trong `<git-root>/.claude/aip-gate.json`: `mcpAllow` và `mcpDeny`. Tên server là `<server>` hoặc `plugin:<plugin>:<server>`; tool `mcp__<server>__<tool>` ánh xạ về dạng thứ nhất, `mcp__plugin_<plugin>_<server>__<tool>` về dạng thứ hai. Server nằm trong `mcpDeny` bị chặn; khi `mcpAllow` không rỗng thì server ngoài danh sách bị chặn; `mcpDeny` thắng `mcpAllow`. Phần tử được cắt khoảng trắng hai đầu và so khớp phân biệt hoa thường; danh sách không phải mảng chuỗi bị bỏ qua (coi như không khai báo), mảng mà mọi phần tử đều sai hoặc rỗng cũng coi như không khai báo. Không có khoá, sai kiểu, hoặc lỗi nội bộ thì không đổi gì (fail-open, exit 0, không in gì). Danh sách được đọc từ repository của cwd phiên làm việc. Ví dụ: `{"mcpAllow": ["github", "plugin:acme:docs"], "mcpDeny": ["shell"]}`. [Unverified] `deny` của hook giữ nguyên ở mọi chế độ quyền và dạng tên tool MCP của plugin lấy từ tổng hợp thứ cấp của tài liệu Claude Code; đối chiếu [hooks](https://code.claude.com/docs/en/hooks) trước khi dựa vào. Đây là cổng theo tên và còn residual risk: server trong `.mcp.json` của project có thể dùng lại một tên được phép, và `aip-gate.json` là nội dung repository mà một pull request có thể sửa; trong CI nên dùng `--bare` hoặc `--strict-mcp-config`. Tên plugin không được chứa `_` (bộ phân tích tách tại `_` đầu tiên sau `plugin_`; server như vậy bị chặn theo `mcpAllow`), và server thường tên đúng `plugin_acme_docs` bị phân loại thành `plugin:acme:docs`. [Unverified] Tool của connector xuất hiện dạng `mcp__claude_ai_<server>__<tool>` nên tên cổng sẽ là `claude_ai_<server>`; xác nhận trong tài liệu [hooks](https://code.claude.com/docs/en/hooks).

**Chính sách quyền.** `core/permissions/policy.json` giữ các nhóm quy tắc chuẩn: `secrets` (`deny`) và `git_push`, `network`, `production_deploy` (`ask`). `aip init --full` ghi `.claude/settings.json` với `permissions.deny` và `permissions.ask` dựng từ chính sách **chỉ khi file chưa tồn tại**; không bao giờ sửa file có sẵn (file có sẵn được giữ nguyên và `aip init` in cảnh báo nêu `core/permissions/policy.json` để bạn so sánh và tự thêm quy tắc) và không ghi ở scope global. Chỉ dành cho Claude: Cursor, Codex và Antigravity chưa nhận file quyền vì định dạng quyền và MCP của chúng chưa xác minh hoặc bị báo là không đáng tin (ví dụ quy tắc `Mcp(...)` của Cursor bị báo là không khớp, danh sách allow của Antigravity bị báo là không được tôn trọng). Codex vẫn nhận `sandbox_mode` theo `mode` của agent. Các quy tắc `secrets` là `Read(.env)`, `Read(.env.local)`, `Read(.env.production)` và `Read(.env.development)`; theo [tài liệu permissions](https://code.claude.com/docs/en/permissions), tên file trần theo ngữ nghĩa gitignore và khớp ở mọi độ sâu nên file lồng như `apps/api/.env` cũng được chặn. Biến thể khác (ví dụ `.env.staging`, `.envrc`) không được phủ, còn `.env.example`, `.env.sample`, `.env.template` vẫn đọc được như ở hook H3. Quy tắc Read chỉ best-effort với công cụ file có sẵn, không áp cho `cat` trong Bash. Khi `.claude/aip-gate.json` có `allowEnvFiles: true` tại thời điểm init (đúng giá trị `true`; chuỗi, `false`, thiếu file hoặc JSON hỏng đều không tính), `aip init --full` không sinh các quy tắc `secrets` (`.env`). Cờ chỉ được kiểm tra một lần lúc sinh file; bật/tắt sau đó thì phải tự sửa `.claude/settings.json`, vì quy tắc `secrets` chặn đọc `.env` độc lập với hook. Các quy tắc `ask` là lớp thứ hai sau `guard-bash`: [Inference] `Bash(git push *)` không khớp `git -C . push …`, H1 vẫn bắt lệnh này.

**Cổng Stop (`gate-stop`).** Đăng ký cho `Stop` và `SubagentStop`. Hook chặn **một lần** khi lượt hiện tại đã sửa file code (Edit/Write/MultiEdit/NotebookEdit; sửa thuần tài liệu như `.md`/`.mdx`/`.txt`/`.rst`/`.adoc` không tính) mà chưa chạy lệnh test/lint/typecheck/build nào sau lần sửa cuối. Hook không phán kết quả xanh hay đỏ, chỉ kiểm có chạy hay chưa; khi có `stop_hook_active` thì cho dừng, nên agent có thể dừng sau khi giải thích vì sao bỏ qua bước kiểm. Tắt bằng `AIP_STOP_GATE=off` hoặc `<git-root>/.claude/aip-gate.json` `{"stopGate": false}`. Chỉ lệnh Bash/PowerShell được tính là lệnh kiểm. Thêm mẫu lệnh qua `testCommands` (regex); mỗi mẫu được so với từng đoạn lệnh (tách theo `&&`, `||`, `;`, `|` và xuống dòng) sau khi bỏ các tiền tố đầu `VAR=x`, `time`, `env`, `timeout <n>`; với `SubagentStop` thì xét toàn bộ transcript của subagent, không chỉ lượt cuối; `exemptAgents` thay thế mặc định `["data-migration-writer"]` và được so với `agent_type` của `SubagentStop` sau khi bỏ tiền tố `<plugin>:`. Hook fail-open như các script khác. [Unverified] Hook đọc transcript JSONL nội bộ của Claude Code, không phải hợp đồng được tài liệu hoá và có thể đổi.

```json
{
  "stopGate": true,
  "testCommands": ["^make test\\b"],
  "exemptAgents": ["data-migration-writer"]
}
```

**Khởi động phiên (`session-start`).** Đăng ký cho `SessionStart`; bật mặc định. Hook có hai chế độ. (1) `source` là `startup`, `clear` hoặc `compact`: nạp nội dung file handoff làm ngữ cảnh bổ sung, kèm đường dẫn tương đối ở đầu và cắt tối đa 9.000 ký tự (Claude Code giới hạn ngữ cảnh hook ở 10.000). Thứ tự tìm file: `handoffPath` trong cấu hình (resolve theo cwd của phiên), `docs/requests/*/handoff.md` sửa gần nhất, rồi `.claude/handoff.md`. File cũ hơn `handoffMaxAgeHours` (mặc định 24), hoặc rỗng, hoặc còn là template chưa điền thì bị bỏ qua. Cùng chế độ này hook còn nạp đuôi của `docs/requests/*/.sdd/progress.md` (ledger plan) sửa gần nhất mà chưa có dòng `Plan: complete` và không cũ hơn `handoffMaxAgeHours`, tối đa 2.000 ký tự; ledger và handoff dùng chung ngân sách 9.000 ký tự (ledger tính trước, handoff lấy phần còn lại). (2) `source` là `resume` hoặc `fork` khi cache prompt có khả năng đã hết hạn: thêm một dòng nêu số token không cache và chi phí ước tính khi Claude Code cung cấp, và trỏ tới file handoff nếu có file dùng được. Tắt bằng `{"handoffInject": false}` (chế độ 1) và/hoặc `{"resumeWarn": false}` (chế độ 2), và `{"ledgerInject": false}` để bỏ qua ledger, trong `<git-root>/.claude/aip-gate.json`. Hook fail-open như các script khác.

```json
{
  "handoffInject": true,
  "ledgerInject": true,
  "resumeWarn": true,
  "handoffPath": "docs/requests/my-feature/handoff.md",
  "handoffMaxAgeHours": 24
}
```

**Cửa sổ nén (`autoCompactWindow`).** Auto-compaction chạy khi đạt một ngưỡng token. Với model có cửa sổ 1M token, mặc định là khoảng 967K. Hạ ngưỡng này làm trần kích thước mỗi request thấp hơn, nhưng nén sẽ chạy nhiều lần hơn và mỗi lần nén làm mất chi tiết của hội thoại trước đó. Đánh đổi này do bạn quyết định. Có bốn cách đặt:

- `/autocompact <100k–1M>` trong phiên;
- `autoCompactWindow` trong settings của Claude Code;
- cờ `--autocompact`;
- biến môi trường `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, có ưu tiên cao nhất (hậu tố `k`/`M` được nhận từ Claude Code v2.1.304 [Unverified]).

**aip không ghi settings của bạn** (aip does not write your settings). Đây là cấu hình của bạn (giá trị cài đặt compaction, không phải file quyền `.claude/settings.json` mà `aip init --full` tạo khi chưa có); `aip` không đặt và không sửa nó. [Unverified] Lưu ý: khi đặt `CLAUDE_CODE_AUTO_COMPACT_WINDOW`, `used_percentage` của statusline vẫn đo trên cửa sổ đầy, nên không còn chỉ đúng lúc nén sắp chạy.

**Agent trong CI.** Công thức tối thiểu cho `claude -p` (xem mục baseline `Agents in CI`); các khẳng định về Claude Code dưới đây là [Unverified], tóm tắt từ [headless](https://code.claude.com/docs/en/headless) và [permissions](https://code.claude.com/docs/en/permissions):

```bash
claude -p "Review the diff and report findings" \
  --permission-mode dontAsk \
  --allowedTools "Read" "Grep" "Bash(git diff *)" \
  --max-turns 20 --max-budget-usd 2 \
  --bare
```

- `--permission-mode dontAsk` biến mọi hành động không được phép thành từ chối thay vì hộp hỏi không ai trả lời; liệt kê tường minh điều được phép bằng `--allowedTools`; giới hạn lượt chạy bằng `--max-turns` và `--max-budget-usd`.
- Dùng `--bare` khi không cần plugin và hook. Không có `--bare`, `-p` nạp hook và `.mcp.json` của project mà không hỏi tin cậy, nên một pull request không đáng tin có thể mang theo hook và MCP server riêng.
- Ghim action bên thứ ba theo commit SHA đầy đủ, cấp token chỉ đọc cho job, và chạy mọi workflow có thể push trong môi trường được bảo vệ, cần người duyệt (required reviewers).
- aip không thêm file workflow vào `templates/init`. Ví dụ review pull request chỉ đọc được mô tả ở [Chạy review trong CI](#chạy-review-trong-ci).

**Agent song song.** Quy ước chạy nhiều agent cùng lúc, mỗi agent một worktree (xem mục baseline `Parallel agents`). aip không tự chạy agent: aip chỉ phân phối quy ước và một script kiểm tra; Claude Code tạo worktree. Chỉ `writeScope` của agent cộng với hook `guard-files` mới ép phạm vi ghi; phần còn lại là hướng dẫn mềm, và Bash vẫn ghi được ở nơi khác.

1. Chia plan thành các task độc lập. Trong `plan.md` mỗi task có danh sách `**Files:**` và một dòng `**Song song:** <nhóm>`; các task cùng nhóm chạy cùng lúc. Kiểm bằng `node core/skills/artifact-templates/scripts/check-partition.mjs <thư-mục-request>` (cảnh báo P1 file giao nhau, P2 file chung bị cấm; `--strict` exit 1).
2. Từ nhánh tích hợp `feature/<slug>`, tạo mỗi task một worktree, tối đa 3 cùng lúc: `claude --worktree <slug>-t<n>` cho nhánh `worktree-<slug>-t<n>` tại `.claude/worktrees/<slug>-t<n>/`. Mặc định Claude Code cắt từ default branch; đặt `worktree.baseRef` là `"head"` trong cài đặt Claude Code (`{"worktree": {"baseRef": "head"}}`; file cài đặt cụ thể là [Unverified], tài liệu chỉ nói "settings") (hoặc tạo bằng `git worktree add`) để bắt đầu từ đỉnh nhánh tích hợp. Thêm `.claude/worktrees/` vào `.gitignore`.
3. Giao cho mỗi agent task và tập file của nó. File chung (bump version, `versions.mjs --lock`, spec sống, README) chỉ được chạm một lần, ở phiên chính, sau khi gộp.
4. Ở nhánh tích hợp, gộp từng nhánh task bằng `git merge --no-ff worktree-<slug>-t<n>` theo thứ tự task, chạy test của các thành phần bị chạm sau mỗi lần gộp. Xung đột ngoài tập file đã khai báo là lỗi chia việc: dừng và báo. Con người duyệt toàn bộ nhánh tích hợp; không có PR riêng cho từng agent.
5. Dọn bằng `git worktree remove <path>`, chỉ với worktree đã gộp và sạch. Không `rm -rf` worktree có junction từ Git Bash trên Windows; nếu phải xoá tay thì dùng Node `fs.rmSync`. Phiên `claude -p` không tự dọn worktree.

| Trạng thái | Nhận định (nguồn) |
| --- | --- |
| [Verified] | `claude --worktree <name>` tạo `.claude/worktrees/<name>/` trên nhánh `worktree-<name>`; base là default branch trừ khi `worktree.baseRef` là `"head"`; phiên không đặt tên và sạch thì tự xoá worktree khi thoát, phiên có tên thì hỏi trước; `claude -p` không bao giờ tự dọn ([worktrees](https://code.claude.com/docs/en/worktrees)). |
| [Verified] | Subagent có `isolation: worktree` dùng `.claude/worktrees/` và bị xoá khi không có thay đổi; lệnh trỏ về main checkout bị chặn; `${CLAUDE_PROJECT_DIR}` vẫn là main checkout còn `cwd` trong đầu vào hook là worktree; file gitignored như `.env` không có trong worktree trừ khi liệt kê trong `.worktreeinclude` ([worktrees](https://code.claude.com/docs/en/worktrees)). |
| [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại] | Hook `WorktreeCreate`/`WorktreeRemove` tồn tại; hook PreToolUse chạy trong subagent ([hooks](https://code.claude.com/docs/en/hooks)). |
| [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại] | Mặc định tối đa 20 subagent đồng thời ([sub-agents](https://code.claude.com/docs/en/sub-agents)); agent teams là experimental, tắt mặc định, khuyến nghị 3-5 teammate và tốn chi phí hơn rõ rệt ([agent-teams](https://code.claude.com/docs/en/agent-teams), [costs](https://code.claude.com/docs/en/costs)). |
| [Unverified] | `isolation: worktree` với agent do plugin cung cấp (trang sub-agents không liệt `isolation` trong các trường bị bỏ qua của agent plugin nhưng cũng không nói là có hiệu lực), và khi chạy headless/SDK. |
| [Unverified] | Tên nhánh và đường dẫn worktree của subagent; ràng buộc "một nhánh một worktree" trong tài liệu Claude Code (đó là hành vi của git, [Inference]); khuyến nghị chính thức một PR cho mỗi agent. |
| [Inference] | Trần 3 agent là heuristic thận trọng, không phải giới hạn chính thức. |

`.claude/aip-gate.json` thường bị gitignore nên worktree không có file này: hook đọc gốc worktree trước rồi tới gốc repo chính, và `guard-files` neo `writeScope` theo gốc worktree. Đừng sao chép file này bằng `.worktreeinclude`.

**Chế độ quyền (`aip mode`).** Mỗi project có một trong hai chế độ, đặt trong project: không có chế độ global và không thừa kế từ thư mục cha (ở worktree, hook đọc gốc worktree trước rồi mới rơi về gốc repo chính).
- `ask` (mặc định; thiếu khóa `mode` nghĩa là `ask`): mọi cổng ở trên chạy đúng như mô tả, và `.claude/settings.json` giữ các quy tắc `deny`/`ask` của aip.
- `full` (`aip mode full`, chỉ phạm vi project; `-g` bị từ chối): cho project bạn tin để chạy không người canh. `aip mode ask` bỏ khóa `mode` và `aip mode status` in chế độ hiện tại cùng việc `settings.json` còn quy tắc aip hay không. `aip mode full` ghi `"mode": "full"` vào `<git-root>/.claude/aip-gate.json` (giữ khóa khác, bỏ BOM). Nó chỉ thay `.claude/settings.json` bằng `{"permissions":{"deny":[],"ask":[]}}` khi file đó trùng byte với bản aip sinh; nếu khác thì để nguyên và liệt kê quy tắc aip bạn cần tự gỡ, vì quy tắc `deny`/`ask` vẫn chặn trong bypass [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại].
- Chỉ hiệu lực khi **cả ba** đúng: `mode` là `"full"` trong `aip-gate.json`, stdin của hook có `permission_mode: "bypassPermissions"`, **và** file không được git theo dõi (điều kiện thứ ba, bên dưới). Thiếu trường hoặc giá trị khác thì chạy như `ask`. Hãy chạy Claude bằng `--permission-mode bypassPermissions` hoặc đặt trong settings người dùng: `settings.json` của project không bật được bypass [Unverified: tóm tắt thứ cấp của trang chính thức, chưa đọc lại] nên aip cũng không bật được.
- Khi hiệu lực: `guard-bash` bỏ H2 và H3, giữ H1 (push nhánh bảo vệ, force push) theo `fullKeep` (mặc định `["push"]`; `[]` là mở hết); `guard-files` bỏ H3 nhưng giữ H5 (`writeScope` là phạm vi vai trò của agent); `guard-mcp` bỏ `mcpAllow` nhưng giữ `mcpDeny`. `gate-stop` và `session-start` không đổi.
- Nhốt trong các root (H6, heuristic): root là gốc project (gốc worktree và gốc repo chính khi ở worktree), `scratchpad_dir` trong stdin của hook, và các đường dẫn tuyệt đối trong `fullRoots` (mặc định rỗng). Tool ghi ngoài root bị deny; Read/Grep ngoài root thì ask. `guard-bash` deny `rm`/`rmdir`/`del`/`erase`/`rd`/`Remove-Item`, `mv`/`move`/`Move-Item`, `cp`/`copy`/`Copy-Item`, `touch`, `mkdir`, `chmod`, `chown`, `tee`, `truncate`, `Set-Content`/`Out-File`/`Add-Content` và chuyển hướng `>`/`>>` nhắm ngoài root, và ask khi không phân tích được đường dẫn (`$X`, `~`, `*` ở gốc). Tiền tố `sudo` (kể cả các option có giá trị), `VAR=x`, `timeout`, `nohup`, `nice` (`-n5`, `--10`, `--adjustment`), `env` (kể cả `env -S "…"`), `command` hoặc `exec` được bỏ qua; `bash -c`/`bash -lc`/`eval` mang lệnh ghi thì ask; chuyển hướng nối tiếp (`a>b>/tmp/x`) và `chmod -x` được kiểm; kiểm push cũng thấy `git` sau lệnh bọc. Không phát hiện: cụm `env -iS`, `bash -cx`, `time`, `xargs`, `find -delete`, `dd`, `sed -i`, `ln`, `cp -t`, chương trình tự ghi file, và symlink (không resolve). Bộ tách lệnh là parser hai lượt nên thân heredoc hoặc `;` trong nháy có thể gây deny nhầm (nghiêng về an toàn). `.claude/aip-gate.json` nằm trong root nên agent ở `full` sửa được file này. Đây không phải sandbox.
- Phiên không bypass trong project có `mode: "full"`: quy tắc của `settings.json` đã bỏ nên `guard-bash` hỏi với `git push` (mọi nhánh), `curl`, `wget`, `kubectl apply`, `terraform apply` và `helm upgrade`. Một contract test giữ danh sách này bằng các quy tắc Bash của nhóm `git_push`, `network`, `production_deploy` trong `core/permissions/policy.json`. `kubectl -n x apply` và `helm -n x upgrade` khớp; chỉ `nice`, `env`, `sudo`, `timeout`, `nohup`, `command` và `exec` được bóc, nên `time`, `xargs` và `bash -c` không khớp; cờ có giá trị khác của `kubectl` (ví dụ `--as`) không khớp; `WebFetch` không còn bị hỏi ở đó. `aip mode ask` chỉ sinh lại `settings.json` khi file trùng byte với dạng `full` do aip sinh; nếu khác thì giữ nguyên file.
- Đường dẫn giống file bí mật (`.env`, khoá, credentials) trong lệnh Bash chỉ mở trong root; ngoài root hoặc không phân tích được thì `guard-bash` hỏi. Đọc file khác bằng Bash, công cụ MCP và lệnh bọc chưa liệt kê không bị nhốt.
- Tool PowerShell: trên Windows, hook không đổi `/e/x` thành `E:\x` kiểu Git Bash cho tool PowerShell (chỉ win32); tool resolve `/e/x` theo ổ đĩa hiện tại [Unverified: giả định, chưa đo; [hooks](https://code.claude.com/docs/en/hooks)], hook làm giống vậy.
- Root chỉ-đọc (khi `full` hiệu lực): file của chính Claude Code nằm ngoài project nếu không sẽ bị ask. Mặc định là `<config dir>/plugins` [Unverified: chưa đo; [permissions](https://code.claude.com/docs/en/permissions)] và `<config dir>/projects/<một đoạn>/<session_id>/tool-results` của phiên này (chỉ khi `session_id` không rỗng, không có dấu gạch chéo, gạch ngược hay `*` và khác `.`/`..`; không thì không có root này), config dir là `CLAUDE_CONFIG_DIR` [Unverified: chưa rõ Claude Code có tôn trọng; [hooks](https://code.claude.com/docs/en/hooks)] khi là đường dẫn tuyệt đối, không thì `~/.claude`. Thêm root bằng khóa `fullReadRoots` trong `aip-gate.json` (đường dẫn tuyệt đối; `*` là wildcard cho một đoạn). Read/Grep ở đó không còn ask; ghi ở đó vẫn bị deny. Root vừa ghi được (trong project) vẫn ghi được. Nguồn plugin thêm từ thư mục ngoài project (marketplace-from-directory) không có mặc định: hãy thêm vào `fullReadRoots`, muốn cho ghi thì dùng `fullRoots`. Trong `claude -p`, `ask` nghĩa là bị từ chối.
- Điều kiện thứ ba: trong phiên khởi động bằng `bypassPermissions`, `full` chỉ hiệu lực khi `.claude/aip-gate.json` **không được git theo dõi** (`git ls-files --error-unmatch`, so tên không phân biệt hoa/thường, chạy ở repo thực sự chứa file sau khi resolve đường dẫn thật; đang được theo dõi, hoặc git lỗi, thì chạy như `ask`; file cấu hình hay thư mục `.claude` là symlink được xét theo cả đường dẫn link lẫn đích, một trong hai được theo dõi thì coi là được theo dõi, không xác định được thì chạy như `ask`), nên repo clone về không bật được `full` bằng file đã commit. Cách xử lý: `git rm --cached .claude/aip-gate.json` rồi gitignore file. `aip mode full` không bao giờ sửa `.gitignore`; nó in cảnh báo khi file đang được theo dõi hoặc chưa theo dõi nhưng chưa bị ignore, và `aip mode status` in dòng `git:`. Phiên không bypass (nhánh rơi về `ask`) không bị ảnh hưởng. Công tắc secret/env của `guard-files` cũng đọc từ repo của file đích.
- Trong worktree, `aip mode` resolve cấu hình như hook: `aip-gate.json` của worktree, thiếu thì lấy của repo chính. `full` và `ask` ghi file của worktree (xuất phát từ các khóa của repo chính) nên file đó che file chính từ lúc đó. `aip-gate.json` của worktree tồn tại nhưng hỏng thì che file chính (không có cấu hình, không rơi về repo chính), và `aip mode` báo lỗi ra stderr với exit 1; lỗi hệ thống file (ví dụ thư mục nằm ở chỗ `settings.json`) cũng ra stderr với exit 1.
- Cảnh báo: [Unverified] theo [tài liệu permissions](https://code.claude.com/docs/en/permissions) (tóm tắt thứ cấp, chưa đọc lại) lệnh xóa ở đường dẫn quan trọng vẫn có thể hỏi trong bypass. Windows native không có sandbox, nên "trong project" chỉ là cấu hình của hook, không phải ranh giới của hệ điều hành; muốn nhốt hãy dùng WSL2, VM hoặc container.
- Đã kiểm ngày 2026-10-22, Claude Code 2.1.306 ([hooks](https://code.claude.com/docs/en/hooks) mô tả đầu vào; đây là phép đo trên một máy, khoảng 0,46 USD cho 4 phiên `claude -p` nhỏ): đầu vào `PreToolUse` có `permission_mode: "bypassPermissions"` với hook khai trong settings và hook của plugin (`--plugin-dir`), và `"default"` với hook của plugin ở chế độ thường (chưa đo với hook khai trong settings); `ask` của hook trong bypass ở `claude -p` được tôn trọng (lệnh không chạy vì không có ai trả lời); trong subagent (`general-purpose`, hook khai trong settings) đầu vào có `permission_mode: "bypassPermissions"`, `agent_id` và `agent_type`.
- Phép đo 2026-10-23, Claude Code 2.1.308 (một phiên `claude -p`, khoảng 0,17 USD, một máy): đã đo mẫu vị trí file tràn (`<config dir>/projects/<cwd, ký tự không phải chữ-số thay bằng "-">/<session_id>/tool-results/`, khác `scratchpad_dir`) và việc Read một file plugin từ thư mục nguồn marketplace. Chưa đo: mặc định `<config dir>/plugins`, `CLAUDE_CONFIG_DIR`, vị trí trong subagent, các kiểu cài khác [Unverified; [permissions](https://code.claude.com/docs/en/permissions)].
- [Unverified] `ask` của hook có hiện hộp xác nhận trong phiên bypass tương tác hay không (chỉ thử `claude -p`); `permission_mode` khi đổi chế độ giữa phiên (Shift+Tab); hook của plugin bên trong subagent (chỉ thử hook khai trong settings); `scratchpad_dir` có trong stdin của subagent hay không (thiếu thì chỉ còn gốc project và `fullRoots`); hành vi trên Linux/macOS; `claude plugin validate --strict`. Thiếu `permission_mode` thì rơi về `ask`.

**Giới hạn / residual risk.** Hook là cổng regex, không phải sandbox.

- Không bắt được: `bash -c "…"` / `eval`, ref bị escape như `ma\in`, literal `$'…'`, và file bí mật ngoài danh sách trên (ví dụ `credentials.csv`, `credentials.xml`, `credentials.toml`).
- H5 chỉ canh tool ghi — agent có Bash vẫn có thể ghi ra chỗ khác. Ngoài mọi repo git, H5 quay về cwd của phiên làm mốc neo.
- Phân tích lệnh theo kiểu POSIX. Với tool PowerShell, nối dòng bằng backtick và escape backtick (``git push origin ` `` + xuống dòng + `main`, ``ma`in``) được chuẩn hoá trước khi phân tích nên không che được push; cú pháp riêng khác của PowerShell (here-string `@'…'@`, `Invoke-Expression`, `-EncodedCommand`) không được phân tích và không bị bắt.
- [Unverified: phụ thuộc mặc định của ripgrep] Grep trên một đường dẫn thư mục có thể đọc `prod.env` không ẩn nằm trong đó; H3 chỉ kiểm `path`/`glob` của Grep, không kiểm các file mà việc duyệt thư mục chạm tới.
- Trong `bypassPermissions`, `ask` của hook được tôn trọng ở `claude -p` (2026-10-22, Claude Code 2.1.306: lệnh không chạy vì không có ai trả lời). [Unverified] chưa rõ phiên tương tác có hiện hộp xác nhận hay không; nên chạy thử thủ công một lần (`git push origin main` trong repo nháp) trước khi dựa vào H1 ở chế độ đó.
- Chi phí: đo được khoảng 0,2 s mỗi lần gọi tool có hook trên Windows (mỗi lần spawn một tiến trình Node).
- Kiểm `glob` của Grep chỉ là heuristic cố gắng hết sức (ví dụ `*.k*` không được nhận ra là glob khoá).
- Dương tính giả đã biết, đều nghiêng về an toàn: `.env.local.example`, chứng chỉ `*.pem` công khai, file như `src/id_rsa.go`, lệnh Bash chỉ nhắc `import.meta.env` hoặc `config.env`, `grep -rn credentials src` (ask), `node -e "console.log(o.key)"` (ask), và thân commit dạng heredoc `git commit -F -` có nhắc `.env` (ask). Deny của Read cũng trúng `.env.development`/`.env.production`/`.env.test` đã commit (Vite/Next).

**Tắt hook tạm thời.** Disable hoặc gỡ plugin `core`: `claude plugin disable core@ai-engineering-platform` (`--scope user|project|local`; lệnh có trong `claude plugin --help`), bật lại bằng `claude plugin enable core@ai-engineering-platform`. [Inference] Tắt `core` cũng tắt luôn skill của nó. [Unverified] chưa xác nhận `/hooks` trong phiên có tắt được riêng một hook của plugin hay không. [Unverified] Mọi plugin domain khai báo `dependencies: ["core"]`; chưa kiểm Claude Code xử lý các plugin phụ thuộc đó thế nào khi `core` bị disable hoặc gỡ (từ chối, kéo theo, hay vẫn chạy thiếu core) — chạy `claude plugin disable` và đọc kết quả trước khi dựa vào.

## Chạy review trong CI

[`templates/ci/claude-review.example.yml`](templates/ci/claude-review.example.yml) là ví dụ review pull request chỉ đọc cho GitHub Actions: chạy một skill review của aip qua `anthropics/claude-code-action` và ghi kết quả ra job summary. Đây là mẫu để chép: `aip init` không sao chép nó, nên bạn tự chép vào `.github/workflows/`. Các khẳng định về Claude Code dưới đây đã được đối chiếu ngày 2026-10-22 với [github-actions](https://code.claude.com/docs/en/github-actions), [headless](https://code.claude.com/docs/en/headless), [action.yml](https://github.com/anthropics/claude-code-action/blob/main/action.yml), [usage.md](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md) và [security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md) của Action; mục đánh dấu [Unverified] hoặc [Inference] chưa được xác nhận.

Trước khi dùng: thay mỗi `<full-40-char-commit-sha>` bằng SHA của release bạn đã rà soát, thêm secret repository `ANTHROPIC_API_KEY`, và đặt `plugin_marketplaces` là URL Git của một repository chứa marketplace: đẩy đầu ra nhánh `dist` (`node cli/dist.mjs`) làm nhánh mặc định của một repository riêng của bạn (hoặc dùng repository có `.claude-plugin/marketplace.json` ở gốc). [Unverified] chưa rõ Action có nhận dạng `#branch` hoặc `--branch` hay không.

Ví dụ đặt sẵn những điều sau (giảm rủi ro, không phải bảo đảm):

- Trigger `pull_request`, không bao giờ `pull_request_target`; quyền chỉ `contents: read` và `pull-requests: read`; mọi action ghim commit SHA đầy đủ.
- `--permission-mode dontAsk`, danh sách `--allowedTools` tường minh (tool đọc cùng `git diff`/`git log`), và trần `--max-turns` / `--max-budget-usd`.
- Prompt cố định, không nội suy gì từ pull request; đầu ra là job summary và job không đăng bình luận.

Giới hạn:

- Chỉ nhánh cùng repository: `if` bỏ qua pull request từ fork; theo [github-actions](https://code.claude.com/docs/en/github-actions), trên repository công khai GitHub không đưa secret cho lần chạy từ pull request của fork (hành vi với repository riêng không được khẳng định ở đây).
- `display_report: true` ghi vào Step Summary đầu ra do Claude tạo từ diff của pull request; [action.yml](https://github.com/anthropics/claude-code-action/blob/main/action.yml) (mặc định `false`) cảnh báo chỉ dùng với đầu vào tin cậy. Giới hạn nhánh cùng repository không làm nội dung diff thành tin cậy. Xóa dòng đó nếu bạn không muốn hiển thị đầu ra này.
- Theo tài liệu headless, `claude -p` không có `--bare` nạp hook và `.mcp.json` của project mà không hỏi tin cậy, còn [security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md) nói với pull request Action khôi phục `.claude/`, `.mcp.json`, `CLAUDE.md` và vài đường dẫn khác từ nhánh base. Chỉ chạy trên nhánh tin cậy.
- [Inference] `pull_request` chạy workflow đúng như nó tồn tại trên merge ref, nên tác giả pull request cùng repository có thể sửa file workflow. [security.md](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md) liệt kê `CLAUDE.md` trong phần khôi phục từ nhánh base nhưng không liệt kê `AGENTS.md`; vì `CLAUDE.md` gốc trong project aip import `@AGENTS.md`, [Inference] tác giả sửa `AGENTS.md` có thể điều hướng chỉ dẫn của reviewer. Prompt cố định chỉ xử lý việc nội suy nội dung, không xử lý tác giả vốn đã có quyền ghi.
- Nội dung pull request (diff, comment) là đầu vào không tin cậy. Reviewer chỉ đọc vẫn có thể bị prompt injection, nên đừng cấp thêm tool cho nó.
- [Speculation] Reviewer bị prompt injection có `Read` có thể in secret trong môi trường ra job summary; chưa kiểm GitHub có che chúng ở đó hay không. Dùng một API key riêng có hạn mức thấp.
- [github-actions](https://code.claude.com/docs/en/github-actions) nói `id-token: write` là bắt buộc cho xác thực GitHub App mặc định của Action, còn [usage.md](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md) nói `github_token` chỉ cần với GitHub App tùy chỉnh. Ví dụ truyền `github.token` và không cấp `id-token`; [Inference] đó là lý do. [Unverified] chưa chạy thử cấu hình này; nếu xác thực lỗi, bạn tự quyết có nâng quyền hay không.
- `backend-code-review` có thể hỏi người dùng khi thiếu phạm vi review; dưới `dontAsk` trong CI không ai trả lời được.
- [Unverified] `Bash(git diff *)` về nguyên tắc có thể ghi file qua `git diff --output=<file>`; chưa kiểm thử.
- P6b (`aip-runner`, LangGraph, repository riêng) là thiết kế sơ bộ và chưa hiện thực.

## Eval

`evals/<plugin>/<case>/` chứa 12 case `claude plugin eval` thuộc `backend`, `frontend`, `engineering`, `workflows`, `core`, `data` và `ops`. Chúng nằm ở cấp repo, không ship trong plugin hay gói npm. `npm test` chỉ kiểm cấu trúc; **chạy case gọi model trên tài khoản của bạn và tốn tiền**, nên không nằm trong `npm test` hay CI.

Chạy một plugin từ thư mục gốc repo (runner bỏ khoá `dependencies` của plugin trong bản sao tạm, vì plugin có `dependencies` không được nạp khi đánh giá từ đường dẫn [Inference: chưa xác nhận nguyên nhân]):

```bash
node scripts/eval-run.mjs --plugin <id> --max-cost-usd <usd> [--runs 3] [--scaffold] [--case <glob>]
```

Một lần đo ngày 2026-10-23 (n=3–5 mỗi nhánh, Windows) nằm trong bảng kết quả của [evals/README.md](evals/README.md). Δ là tín hiệu, không phải thống kê; nhiều Δ đo định dạng/quy ước chứ không đo chất lượng, và `guard-bash`/`guard-mcp`/`gate-stop` không đánh giá được trên Windows (Bash). Xem file đó để biết cờ, danh sách case và giới hạn.

## Đầu ra theo provider

`aip build` ghi một cây cho mỗi provider dưới `build/<provider>/`:

| Provider | Đầu ra build | Cài vào (scope project) |
| --- | --- | --- |
| Claude | `.claude-plugin/marketplace.json` + `plugins/<id>/` (core là plugin dependency) | `.claude/skills/<skill>`; khối baseline → `CLAUDE.md` (project: → `AGENTS.md` khi `CLAUDE.md` import `@AGENTS.md`) |
| Cursor | `<id>/.cursor/rules/<id>-00-principles.mdc` + `.cursor/skills/<skill>/` | `.cursor/rules` + `.cursor/skills` |
| Codex | `<id>/skills/<skill>/SKILL.md` (native skills) | `.agents/skills/<skill>` (global: `~/.agents/skills`; agent giữ ở `.codex/agents/`); khối baseline → `AGENTS.md` |
| Antigravity | `<id>/AGENTS.md` + `docs/workflow/<skill>/` | khi cài tường minh; khối baseline → `AGENTS.md` |

Skill nào ship thư mục `references/` thì ship tới **mọi** provider (parity, do
`test/validate.mjs` bắt buộc).

**Ghi chú nâng cấp Codex.** Skill đã chuyển từ `.codex/skills` sang `.agents/skills`. Chạy `aip update` (thêm `-g` nếu cài global) hoặc cài lại: manifest cài đặt sẽ gỡ bản cũ ở `.codex/skills`. Bản cũ không do manifest theo dõi thì phải xoá tay. Installer không bao giờ ghi đè hay xoá file thường không phải do nó cài; thư mục thật không phải của nó được merge và giữ nguyên các file đã có (bỏ qua kèm cảnh báo); symlink/junction đã có ở đích thì bị thay.

## Viết nội dung

- **Skill mới** → thêm `plugins/<id>/skills/<skill-id>/SKILL.md` với frontmatter (`name`,
  `description`, `order`, `title`, `runsIn`, `invoke`).
  Tự động được phát hiện — không phải khai vào manifest. File tham chiếu đặt dưới
  `skills/<skill>/references/`.
  Thân skill phải có H2 `## Quy trình…` và `## Ranh giới an toàn…` (cho phép hậu tố sau dấu
  cách), do `test/validate.mjs` kiểm.
  `description` theo mẫu cố định: một câu hành động (≤ 200 ký tự), rồi
  `Dùng khi người dùng muốn "…", "…", "…"` (3–5 trigger trong ngoặc kép), rồi
  `Không dùng khi <tình huống> → <id>.` (id skill/workflow/agent có thật) — tối đa 500 ký tự
  (mục tiêu 450; description workflow cũng bị chặn ở 500), không có câu mẫu thừa, không lặp nguyên văn trigger của skill khác. Mô tả
  agent ≤ 260 ký tự và kết thúc bằng `Dùng khi …`.
- **Hành vi provider mới** → sửa `adapters/<provider>/adapter.mjs`; giữ là hàm thuần
  `build(plugins, { outDir, marketplace, core }) -> fileEntry[]` với entry là
  `{path, content}` | `{path, copyFrom}` | `{path, copyDir}`.
- Chạy `npm run build` và `npm test` (đã gồm `test/validate.mjs --build`).
- Mọi thay đổi nội dung → bump version của plugin sở hữu rồi chạy `node cli/lib/versions.mjs --lock` (Claude Code cache plugin theo version).

## Maintainer

```bash
npm test            # validate --build + install + wizard + managed-block + pack-guard
npm run build       # build tất cả provider vào build/
npm run validate    # hợp đồng source + build-output
npm run overlap     # báo cáo trùng lặp skill/workflow (tham khảo)
npm run pack:verify # kiểm tập file npm-publish nằm trong pack.config.json
```

Cowork upload: `cli/lib/pack.mjs` đóng gói tập skill khai trong `_cowork.json` thành
`build/cowork/<skill>.zip` tất định cho Customize → Skills → Upload.

## Phát hành lên npm (maintainer)

Gói dùng allowlist `files[]` trong `package.json`; hook `prepack` tự chạy pack-guard
(fail-loud nếu tập file lệch `pack.config.json`). Gói không có scope nên mặc định public.
Gói npm chỉ ship **core**: pack-guard từ chối mọi `plugins/<id>/` có id không nằm trong
`shipPlugins` (mặc định rỗng), từ chối `workflows/`, và báo lỗi nếu plugin khai trong `shipPlugins`
vắng khỏi gói. `plugins/_published.json` chỉ điều khiển phần wizard offer khi chạy từ source —
không còn quyết định nội dung tarball.
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
- [docs/requests/](docs/requests/) — design và plan theo từng request.
- [docs/decisions/](docs/decisions/) — ADR.

## Checklist thay đổi

- Cập nhật `README.md` trước, rồi đồng bộ [README_VI.md](README_VI.md).
- Giữ danh mục plugin và bảng provider khớp `plugins/` và `adapters/`.
- Chạy `npm test` sau mọi thay đổi cấu trúc, nội dung, hoặc projection.