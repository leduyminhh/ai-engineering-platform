# Kiểm định `ai-engineering-platform` theo chuẩn Claude Code hiện hành + lộ trình nâng cấp

- Ngày: 2026-10-07
- Trạng thái: **Đã duyệt 2026-10-08** (chủ dự án chấp nhận cả 6 khuyến nghị ở §6); thực thi theo từng phase, mỗi phase một plan riêng
- Phạm vi: toàn bộ nội dung chiếu ra (36 skill, 18 agent, 13 workflow, templates) và engine (`cli/`, `adapters/`,
  `test/`, CI) — audit trên head `feature/task-breakdown-integration` @ `0693874` (bao gồm `master` `d804d01`).
- Thước đo: **Claude Code là chính** (tài liệu chính thức fetch ngày 2026-10-07, xem §0.2); Codex/Cursor/Antigravity
  chỉ kiểm "không gãy". Lộ trình chia phase theo chi phí, mỗi phase merge độc lập (lựa chọn của chủ dự án: Q1=A,
  Q2=A, Q3=A).
- Người duyệt: chủ dự án.

---

## 0. Cách đọc & nguồn

### 0.1 Nhãn

| Nhãn | Nghĩa |
|---|---|
| (không nhãn) | Đã kiểm chứng: chạy lệnh / đọc file, có `file:dòng` hoặc số đo |
| `[Inference]` | Suy luận từ dữ liệu đã đọc |
| `[Unverified]` | Chưa kiểm chứng được trong phiên này |
| `[Đề xuất]` | Quyết định chờ chủ dự án chốt |

### 0.2 Nguồn chuẩn (fetch 2026-10-07)

`code.claude.com/docs/en/`: `skills.md`, `plugins/manifest-reference.md`, `plugins/marketplace-reference.md`,
`plugins/publish.md`, `plugins/cli-reference.md`, `sub-agents.md`, `hooks.md`, `memory.md`, `settings-reference.md`.
Provider khác: `learn.chatgpt.com/docs/build-skills`, `…/agent-configuration/subagents` (Codex); `cursor.com/docs/context/rules`,
`…/skills` (Cursor); `antigravity.google/docs/rules`, `…/skills` (Antigravity). Checklist rút gọn + 4 báo cáo audit
chi tiết nằm trong thư mục scratchpad của phiên (không commit).

### 0.3 Bằng chứng công cụ

| Lệnh | Kết quả |
|---|---|
| `claude plugin validate --strict build/claude` + 7 plugin | 8/8 pass (CLI 2.1.285) |
| `claude plugin details engineering@…` | 8 skill + 3 agent: **~1.957 token always-on**; on-invoke 1,1k–2,3k/skill |
| `claude plugin list` | `workflows` **✘ failed to load** (thiếu dependency `data`); backend/frontend/engineering cài 1.2.0 trong khi nguồn 1.5.0/1.7.0/1.4.0 |
| PyYAML parse frontmatter build | `build/claude`: **15/73 hợp lệ**; `build/codex` 8/55; `build/cursor` skills 2/36; **nguồn: 67/67 hợp lệ** |
| `npm test` | 2.472 pass / 0 fail, ~36 s (`install.test.mjs` 32 s) |
| `npm run overlap` | `*-init` 48–56 %, `*-fix` 51 %, `*-code-review` 49 %; chưa cặp nào chạm ngưỡng gộp 60 % |
| Mô tả luôn nạp (nguồn) | 36 skill 31.511 ký tự · 13 workflow 6.948 · 18 agent 7.506 → `[Inference]` ≈ 11,6–12k token khi cài đủ 7 plugin |

---

## 1. Kết luận tổng quát

Repo **đạt chuẩn ở phần khung**: manifest/marketplace pass `--strict`, skill = thư mục + `SKILL.md`, progressive
disclosure có dùng thật (146 file phụ, 0 link hỏng), validator ép khung body và câu "Không dùng khi → id", agent
chặn nesting đúng khuyến nghị, install an toàn, pack-guard fail-loud.

Repo **chưa chuẩn ở ba chỗ có hệ quả thật**:

1. **Engine chiếu quá hẹp:** chỉ phát `name` + `description` cho skill và 4 trường cho agent; mọi key chuẩn khác
   (`allowed-tools`, `when_to_use`, `user-invocable`, `tools`, `skills` preload, `maxTurns`…) bị **drop im lặng**;
   không chiếu được hooks / MCP / evals. Vì vậy mọi ranh giới an toàn hiện chỉ là **văn xuôi**.
2. **Lỗi đang xảy ra trên máy dev:** plugin `workflows` không load (hard-dependency vào cả 6 plugin); version không
   bump khi nội dung đổi nên cache Claude Code giữ bản cũ; frontmatter build **không phải YAML hợp lệ** (58/73) — Claude
   Code hiện dung thứ, parser nghiêm hơn thì không.
3. **Tốn context không cần thiết:** description dài gấp ~2 lần cần thiết (47 % là liệt kê trigger/loại trừ), preamble
   ép nạp 2 skill principles mỗi lần gọi (≈1,9–2,9k token/lần `[Inference]`), workflow 8–22 KB nạp nguyên khối.

Validator/test thì **mạnh về phủ nhưng giòn**: 66 % dòng là assert ghim câu chữ theo spec cũ, 5 chỗ ghim version, CI
chỉ ubuntu và chưa chạy `claude plugin validate --strict`, chưa có eval.

---

## 2. Đã tốt (giữ nguyên)

| # | Điểm | Bằng chứng |
|---|---|---|
| G1 | Manifest + marketplace đúng schema, `validate --strict` sạch 8/8 | `adapters/claude/adapter.mjs:16-47` |
| G2 | Skill name = tên thư mục, kebab-case, 0 lệch; không có key lạ lọt vào build | `adapters/_shared/lib.mjs:31-41` |
| G3 | Progressive disclosure có dùng: 146 file phụ, 230 link, 0 link hỏng; 11 skill có "Bản đồ tài liệu" | quét build |
| G4 | Validator ép khung H2 + description có "Không dùng khi → id" + trigger không trùng | `cli/lib/conventions.mjs` |
| G5 | Agent chặn nesting (`disallowedTools: Agent`), read-only chặn Edit/Write | `adapters/_shared/agents.mjs:5` |
| G6 | Workflow có khung 8 trường/bước, gate, evidence, checkpoint ⏸; Registry được kiểm drift | `cli/lib/workflows.mjs` |
| G7 | Install an toàn: junction/symlink, merge không đè, manifest, reference-count managed block | `cli/lib/install.mjs` |
| G8 | Pack-guard fail-loud; Cowork zip tất định zero-dep | `cli/lib/pack-guard.mjs`, `pack.mjs` |
| G9 | Mẫu script đúng chuẩn đã có: `check-tasks.mjs` (built-in, exit code, đường lui thủ công) | `engineering-task-breakdown/scripts/` |
| G10 | Projection Cursor (rules `.mdc` + `.cursor/skills`) và Codex agents TOML khớp docs hiện hành | audit C §Provider |

---

## 3. Chưa chuẩn / thiếu — theo mảng

Cột **Mức**: High = đang gây lỗi hoặc đánh lừa người dùng; Med = lệch chuẩn có chi phí thật; Low = polish.

### 3.1 Engine / projection (audit C)

| ID | Vấn đề | Bằng chứng | Chuẩn | Mức |
|---|---|---|---|---|
| E1 | Frontmatter build là plain scalar không quote → 58/73 file không phải YAML hợp lệ (Claude), Codex 47/55, Cursor 34/36 | `cli/lib/write.mjs:47-55`; PyYAML | YAML 1.2; `validate --strict` pass nên Claude dung thứ `[Inference]` | **High** (rủi ro tương thích) |
| E2 | Skill: chỉ phát `name`+`description`; key khác drop im lặng | `plugins.mjs:162-175`, `lib.mjs:31-41` | skills.md: `when_to_use`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `argument-hint`, `paths`, `effort`… | **High** (chặn mọi nâng cấp an toàn) |
| E3 | Agent: chỉ phát `disallowedTools/model/effort/color`; không `tools`, `skills` preload, `maxTurns`, `permissionMode`, `memory`, `isolation` | `agents.mjs:15-27` | sub-agents.md (`skills:` inject toàn bộ skill lúc khởi động; tên **trần**, không namespace — đã xác minh) | Med |
| E4 | Không chiếu `hooks/`, `.mcp.json`, `settings.json`, `evals/`, `userConfig`; `plugin details` báo Hooks 0 / MCP 0 | `plugins.mjs:263-286`, `adapter.mjs:118-143` | manifest-reference layout chuẩn | Med (Phase 3) |
| E5 | Version không bump khi nội dung đổi → cache Claude giữ bản cũ; `core` version hard-code trong code | `install.mjs:163-197`, `plugins.mjs:91`; `plugin list` | publish.md "tăng version mỗi release" | **High** |
| E6 | `workflows` hard-depend cả 6 plugin → thiếu `data` là mất 13 workflow; `data` chỉ cần cho 1/12, `ops` 2/12 | `adapter.mjs:90-98`; `plugin list` | manifest `dependencies[]` = phải enabled | **High** |
| E7 | Hai đường cài (skills-mode phẳng vs marketplace directory trỏ `build/` gitignore) chồng lấn, lệch trạng thái; pointer phải ghi 2 dạng tên | `install.mjs:499-528`, `:242-258` | cli-reference: plugin tiêu thụ qua marketplace add + install | Med-High |
| E8 | Marketplace phơi cả skill draft (`data-oltp/olap-*`) | `adapter.mjs:109-145` vs `_published.json` | — | Low-Med |
| E9 | plugin.json thiếu `homepage/repository/license/defaultEnabled`; `keywords` giống nhau mọi plugin; marketplace thiếu `owner.email/url`, `renames` | `adapter.mjs:23`, `_marketplace.json` | manifest/marketplace-reference | Low |
| E10 | Parser frontmatter chỉ scalar 1 dòng; không list/map → không thể nhận `allowed-tools: [..]`, `hooks:` | `plugins.mjs:99-122` | — | Med (điều kiện của E2/E3) |

### 3.2 Nội dung skill (audit A)

| ID | Vấn đề | Bằng chứng | Chuẩn | Mức |
|---|---|---|---|---|
| S1 | Description dài (TB 875, max 1.006 ký tự): 32 % là danh sách trigger, 15 % "Không dùng khi", 6 % boilerplate; mở đầu bằng nhãn meta ("Recipe on-demand:") | 36 SKILL.md; `desc.mjs` | skills.md: "<What>. Use when <scenario>", concise | Med (≈3,5–4k token/phiên tiết kiệm được `[Inference]`) |
| S2 | Preamble "Đọc trước nguyên tắc nền tảng…" chèn vào 49/55 skill → ép gọi 2 skill principles mỗi lần (≈1,9–2,9k token `[Inference]`); nội dung an toàn lặp trong 27/36 body | `adapter.mjs:131-136`; grep | best practice #2 | Med |
| S3 | Mô tả `*-principles` sinh bởi adapter vẫn ghi "pipeline bắt buộc" — mâu thuẫn với quy ước đã bỏ pipeline; không qua `checkDescription` | `adapter.mjs:80-83` | — | Med |
| S4 | Skill read-only (`*-code-review`, `ops-incident-troubleshooting`, `ops-observability`, `convention-enforce`) không khoá tool; skill nền tảng hiện trong menu `/`; skill `*-init` (`invoke: once`) không có `disable-model-invocation` | frontmatter nguồn | skills.md best practice #3; `user-invocable`, `disable-model-invocation` | Med (phụ thuộc E2) |
| S5 | 11 skill có mục "Khi nào dùng" lặp description trong body; `ops-deploy-release` lặp `references/deploy-safety.md` | `ops-deploy-release/SKILL.md:23-46` | best practice #2 | Low |
| S6 | 3 script `.sh` nằm trong `references/` thay vì `scripts/`; `test-commit-message-encoding.ps1` chỉ chạy PowerShell | `data-db-migration/references/…/new-migration.sh`, `git-workflow/scripts/*.ps1` | skills.md `scripts/` | Low-Med |
| S7 | `architecture/` nhân bản vào 14 skill (≈245 KB mỗi bản) — dung lượng cài, không tốn token | `sharedAssets` 14 skill | — | Low |

### 3.3 Agent + workflow (audit B)

| ID | Vấn đề | Bằng chứng | Chuẩn | Mức |
|---|---|---|---|---|
| W1 | Agent read-only vẫn có Bash → `ops-release-engineer`/`ops-incident-investigator` "chỉ đề xuất lệnh" chỉ bằng prose | `agents.mjs:5` | sub-agents.md `tools` allowlist; best practice #3 | **High** (ops) |
| W2 | 0/18 agent đặt `model/effort/maxTurns/tools/skills`; skill nạp "lazy bằng prose" (vẫn hoạt động — subagent gọi được plugin skill qua Skill tool, đã xác minh) | frontmatter nguồn | sub-agents.md | Med |
| W3 | Scope-lock của 13 agent write chỉ bằng prose; gate "diff chỉ gồm file test" kiểm sau khi đã ghi | `release-scribe.md`, `spec-analyst.md`, `*-test-writer.md` | hooks.md PreToolUse exit 2 (stdin có `agent_type` — đã xác minh) | Med |
| W4 | Description agent TB 417 ký tự, 17/18 kết thúc "Dùng khi workflow…", có agent nhét danh sách cấm | `data-migration-writer.md` (690) | "<Role>. Use when <trigger>." | Low-Med |
| W5 | Workflow-skill không có `argument-hint`; 4 workflow risk ≥ high vẫn model-invocable | build `workflow-*/SKILL.md` | skills.md | Med |
| W6 | Workflow nạp nguyên khối 7,9–21,9 KB (tổng ≈40k token); nhánh hiếm luôn nạp | build | best practice #2 | Med |
| W7 | Preamble dispatch không nói `∥` = nhiều Agent trong một message; orchestrator Bước 2 in lệnh `aip` vô nghĩa khi cài plugin | `agents.mjs:34`, `orchestrator/WORKFLOW.md` | — | Low |
| W8 | 0 hook: không có cổng cứng cho push protected branch, commit `-F` UTF-8, đọc secret, lệnh lên môi trường, ⏸ | repo | hooks.md | Med-High |

### 3.4 Validator / test / CI (audit D)

| ID | Vấn đề | Bằng chứng | Mức |
|---|---|---|---|
| T1 | `claude plugin validate --strict` không có trong `npm test`/CI (docs: `--strict` là chế độ CI) | `ci.yml`, `package.json` | Med |
| T2 | `validate.mjs` 2.390 dòng/36 block: 21 block generic (33 %) vs 24 block ghim nội dung (66 %); 668 `.includes(`; 5 assert ghim version; 4 chỗ đọc `docs/superpowers/specs`; assert vacuous L419, L424 chỉ kiểm `dependencies[0]` | `test/validate.mjs` | Med |
| T3 | Không allowlist key frontmatter (skill/agent/workflow); không kiểm semver, dependency ⊂ marketplace, manifest description ↔ danh sách skill, ngân sách description, BOM/LF | grep | Med |
| T4 | CI chỉ ubuntu + Node 20 (dev dùng Windows + Node 24; nhánh junction không được test); `npm run validate` chạy trùng; `release.yml` dùng `actions/create-release@v1` `[Unverified]` đã archive; không `permissions:` | `.github/workflows/*.yml` | Med |
| T5 | Không có eval (`evals/` + `claude plugin eval`) | repo | Med (Phase 3) |
| T6 | `install.test.mjs` 32 s, temp dir không `try/finally`; `build/` là trạng thái chung → 2 lượt test song song gây lỗi (quan sát được) | `test/install.test.mjs` | Low |

### 3.5 Provider khác (chỉ "không gãy")

| Provider | Kết luận | Ghi chú |
|---|---|---|
| Codex | Skill/agent **khớp** docs; **đường cài `.codex/skills` có nguy cơ** — docs hiện chỉ liệt kê `.agents/skills` `[Inference]` | kiểm thực nghiệm trước khi đổi |
| Cursor | Khớp (`.mdc` rules, `.cursor/skills`) | rule always-apply 8–15 KB/plugin |
| Antigravity | `AGENTS.md` < 24 KB; đã có **Skills native** `.agents/skills` mà engine chưa dùng | xét khi bật lại provider |

---

## 4. Điểm đã xác minh thêm (ảnh hưởng lộ trình)

| Câu hỏi | Kết quả | Nguồn |
|---|---|---|
| `skills:` trong agent dùng tên gì khi cùng plugin? | **Tên trần** (`api-conventions`), không namespace | sub-agents.md |
| Subagent tự gọi được plugin skill không? | **Có**, qua Skill tool (chặn bằng bỏ `Skill` khỏi `tools`) | sub-agents.md |
| `disable-model-invocation: true` còn nạp description không? | **Không** — ẩn hoàn toàn, chỉ `/name` | skills.md |
| Hook PreToolUse biết đang ở agent nào không? | **Có**: `agent_id`, `agent_type` trong stdin; `if: "Bash(git push*)"` được tài liệu hoá | hooks.md |
| `--strict` là chế độ CI? | **Có** | plugins/publish.md |
| Plugin agent có dùng được `hooks`/`permissionMode`/`memory`? | `[Unverified]` — docs không nêu hạn chế | — |

---

## 5. Lộ trình nâng cấp (mỗi phase một branch, merge độc lập)

### Phase 0 — Sửa gấp lỗi đang xảy ra (S, engine nhỏ)

| # | Việc | Giải quyết | Chạm |
|---|---|---|---|
| P0.1 | `frontmatter()` quote chuỗi bằng `JSON.stringify` khi cần (có `: `, `#`, ký tự mở YAML); thêm lint trong `conventions.mjs`; cập nhật assert | E1 | `cli/lib/write.mjs`, `conventions.mjs`, test |
| P0.2 | `workflows` dependencies: chỉ `core` + plugin **bắt buộc chung**; plugin theo workflow (`data`, `ops`) ghi vào "Điều kiện tiên quyết" + preamble; validator kiểm đồ thị dependency khép kín trong marketplace; bump `workflows` 1.1.0 | E6 | `adapters/claude/adapter.mjs:90-98`, `agents.mjs:29`, test |
| P0.3 | Version gate: `core/.manifest.json` (bỏ hard-code), kiểm "nội dung plugin đổi so với tag/base ⇒ version đổi" trong validate/CI; bỏ 5 assert ghim version → semver + đồng bộ `.manifest.json`/`plugin.json`/marketplace; `aip check` đối chiếu `claude plugin list` | E5, T2 (một phần) | `plugins.mjs`, `install.mjs`, test, CI |
| P0.4 | CI: matrix `ubuntu + windows-latest` × Node `20, 24`; thêm `npm run build` → `claude plugin validate --strict build/claude` (+ từng plugin; bước tuỳ chọn nếu CLI không cài được); `permissions: contents: read`; bỏ `npm run validate` trùng; thay `create-release@v1` | T1, T4 | `.github/workflows/*.yml` |
| P0.5 | Sửa chuỗi mô tả `*-principles` (bỏ "pipeline bắt buộc", thêm tình huống dùng) | S3 | `adapter.mjs:80-83` |
| P0.6 | Người dùng: `aip update` / cài lại để đồng bộ bản cài 1.2.0 → hiện tại (không phải việc của repo) | — | — |

### Phase 1 — Nội dung + quy ước + test (M, không đổi cấu trúc engine)

| # | Việc | Giải quyết |
|---|---|---|
| P1.1 | Viết lại 36 description: câu hành động đầu, 3–5 trigger mạnh, 1 mệnh đề "Không dùng khi → id", bỏ boilerplate; mục tiêu **≤ 450 ký tự** `[Đề xuất]`; hạ `DESCRIPTION_MAX` → 500; thêm gate tổng ngân sách description | S1 |
| P1.2 | Viết lại 18 description agent ≤ ~230 ký tự theo "<Vai trò + phạm vi ghi>. Dùng khi <việc>."; chuyển danh sách cấm vào body | W4 |
| P1.3 | Thay preamble ép nạp principles bằng **digest 5–8 dòng** nhúng thẳng (adapter string); xoá mục "Khi nào dùng" (11 skill) và đoạn an toàn/ngôn ngữ lặp trong body (giữ phần đặc thù) | S2, S5 |
| P1.4 | Workflow: thêm dòng `∥` = nhiều Agent trong một message; orchestrator Bước 2 "Kiểm cài" theo provider; rút Evidence trùng Gate | W7, W6 (một phần) |
| P1.5 | Script: chuyển 3 `.sh` sang `scripts/`; port `test-commit-message-encoding.ps1` sang Node; (tuỳ chọn) `collect-history.mjs` cho git-workflow | S6 |
| P1.6 | Test: tách `validate.mjs` → `test/harness.mjs` (`--only`) + `test/contract/*` (generic) + `test/content/*` (pin); về hưu pin câu chữ khi rule đã thành contract; sửa L419/L424; thay 4 chỗ đọc spec docs; thêm kiểm BOM/LF/UTF-8, manifest ↔ skill, allowlist key frontmatter nguồn (chuẩn bị cho Phase 2); `try/finally` temp dir; không chạy 2 lượt song song | T2, T3, T6 |

### Phase 2 — Engine: chiếu frontmatter đầy đủ (M)

| # | Việc | Giải quyết |
|---|---|---|
| P2.1 | Parser frontmatter: inline list `[a, b]`, block list `- x`, chuỗi quoted; emitter serialize list/map; key lạ ⇒ **fail-loud** | E10, E2 |
| P2.2 | Skill passthrough theo allowlist provider: `when_to_use`, `argument-hint`, `arguments`, `user-invocable`, `disable-model-invocation`, `allowed-tools`, `disallowed-tools`, `effort`, `paths`, `compatibility`, `metadata` (Claude); Cursor chỉ `paths`, `disable-model-invocation`, `metadata` | E2 |
| P2.3 | Áp dụng: `user-invocable: false` cho 6 skill principles; `disallowed-tools: [Edit, Write, NotebookEdit]` cho 5 skill read-only; `argument-hint` cho ~8 skill có đầu vào rõ; `when_to_use` nhận khối trigger; `disable-model-invocation: true` cho 4 skill `*-init` `[Đề xuất]` (mất auto-route — chấp nhận vì chạy một lần) | S4 |
| P2.4 | Agent passthrough: `tools` allowlist (reviewer/auditor/investigator: `Read, Grep, Glob, Bash`; ops read-only: bỏ Bash ⇒ `Read, Grep, Glob`), `skills` preload tên trần (skill chính của agent), `maxTurns`, `model`/`effort` theo lớp, `permissionMode`, `isolation: worktree` cho implementer `[Đề xuất]`; Codex TOML chỉ key Codex hiểu | E3, W1, W2 |
| P2.5 | Marketplace lọc draft theo `_published.json` (cờ `--include-draft`); plugin.json thêm `homepage/repository/license`, `keywords` riêng; marketplace `owner.email/url`, `renames` | E8, E9 |
| P2.6 | Workflow risk ≥ high: `[Đề xuất]` giữ model-invocable nhưng thêm `argument-hint` + gate xác nhận ⏸ đầu (vì `disable-model-invocation` ẩn description → orchestrator không route được); tách nhánh hiếm sang `workflows/<slug>/references/` (adapter copy) | W5, W6 |

### Phase 3 — Hooks, eval, phân phối (M–L)

| # | Việc | Giải quyết |
|---|---|---|
| P3.1 | Chiếu `plugins/<id>/hooks/hooks.json` + script Node zero-dep vào `build/claude/plugins/<id>/hooks/`; skills-mode không phẳng hoá hooks (chỉ plugin-mode có `${CLAUDE_PLUGIN_ROOT}`) | E4 |
| P3.2 | Bộ hook an toàn tối thiểu trong `core`: H1 chặn `git push` lên protected/`--force`; H2 chặn `git commit -m` có non-ASCII (bắt dùng `-F`) + kiểm UTF-8 file; H3 chặn Read/Edit/Write/Bash chạm `.env*`, `*.jks`, `*.keystore`, `*.pem`, `id_rsa*`; `ops`: H4 chặn Bash biến đổi môi trường khi `agent_type` ∈ {ops-release-engineer, ops-incident-investigator}; H5 scope-lock Edit/Write theo `agent_type` (scribe → `docs/`, `CHANGELOG.md`; spec-analyst → `docs/`; test-writers → thư mục test) | W1, W3, W8 |
| P3.3 | `evals/` nguồn → copy vào build; 3 case đầu (`engineering-spec-writing`, `backend-code-review`, `workflow-bugfix`) với grader `file_exists`/`regex`/`tool_used`/`llm`; `npm run eval` chạy thủ công/nightly với `--max-cost-usd`, `--threshold`; dùng `claude plugin eval init` để xác thực schema `[Unverified]` | T5 |
| P3.4 | Phân phối: `[Đề xuất]` plugin-mode (marketplace) là đường chuẩn cho Claude; publish `build/claude` git-addressable (nhánh `dist` hoặc release artifact); skills-mode giữ cho chọn lẻ/Cowork; `aip install --provider claude` cảnh báo khi `claude plugin list` đã có plugin; bỏ nhánh `.mcp.json` chết | E7 |
| P3.5 | Codex: kiểm thực nghiệm `.agents/skills` vs `.codex/skills` rồi đổi đường cài; Antigravity: chiếu Skills native khi bật lại | §3.5 |

### Phụ thuộc giữa phase

`P0.1 → P2.1` (emitter an toàn trước khi thêm list/map) · `P1.6 allowlist → P2.1 fail-loud` · `P2.1/P2.2 → P2.3/P2.4` ·
`P3.1 → P3.2` · `P3.4` độc lập. Phase 1 có thể chạy song song Phase 0 trên branch khác (ít chạm chung: chỉ `conventions.mjs`).

---

## 6. Quyết định đã chốt 2026-10-08 (theo khuyến nghị)

| # | Quyết định | Khuyến nghị | Lý do |
|---|---|---|---|
| D1 | Ngưỡng description skill | ≤ 450 ký tự (`DESCRIPTION_MAX` 500) | tiết kiệm ≈35 % always-on phần skill; CL không có số, đây là số của audit |
| D2 | `disable-model-invocation` cho `*-init` | Có | chạy một lần, không agent nào preload; mất auto-route chấp nhận được |
| D3 | `disable-model-invocation` cho workflow risk ≥ high | **Không**; dùng gate ⏸ đầu + hook | ẩn description làm orchestrator không route được |
| D4 | Chính sách về hưu pin test | Về hưu pin câu chữ khi rule đã thành contract; giữ pin invariant an toàn | giảm giòn (66 % dòng validate hiện là pin) |
| D5 | Đường phân phối Claude | plugin-mode là chuẩn, skills-mode là fallback | khớp cách Claude Code tiêu thụ plugin; hooks/MCP chỉ có nghĩa ở plugin-mode |
| D6 | `isolation: worktree` cho implementer | Thử ở Phase 2, bật mặc định sau khi có eval | an toàn hơn nhưng đổi luồng commit của workflow |

---

## 7. Rủi ro & giả định

| Rủi ro | Giảm thiểu |
|---|---|
| Docs Claude Code đổi nhanh; checklist fetch 2026-10-07 | Mỗi phase mở đầu bằng re-fetch trang liên quan; test không ghim số từ docs ngoài trần 1.536 |
| Plugin agent có thể không dùng được `hooks`/`permissionMode` `[Unverified]` | P2.4 kiểm thực nghiệm 1 agent trước khi áp đại trà; H4/H5 có đường lui ở hook cấp plugin lọc `agent_type` |
| Viết lại 36 + 18 description làm đổi hành vi định tuyến | P1.1 đi kèm `npm run overlap` + 3 eval case ở P3.3 (hoặc kiểm tay cặp dễ nhầm) |
| Tách `validate.mjs` gây đỏ dây chuyền | Làm theo lô, không đổi hành vi, `npm test` sau mỗi lô |
| `[Inference]` số token (hệ số 0,26 tok/ký tự) sai ±15 % | Dùng `claude plugin details` đo lại sau Phase 1 |
