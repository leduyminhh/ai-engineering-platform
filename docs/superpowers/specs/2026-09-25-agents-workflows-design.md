# Thiết kế: Agent + bộ 12 Workflow + Orchestrator (Claude + Codex)

- Ngày: 2026-09-25
- Trạng thái: Bản nháp chờ chủ dự án duyệt. Chưa thực thi.
- Phạm vi giai đoạn 1: provider **claude** + **codex**. cursor/antigravity để giai đoạn sau (§9 P1).
- Vị trí nội dung:
  - **Agent** nằm trong plugin domain (`plugins/<id>/agents/`), vì agent gói skill của đúng domain đó.
  - **Workflow + Orchestrator** nằm ở thư mục cấp repo `workflows/`, tách hẳn khỏi danh sách plugin, vì workflow
    là nơi gọi xuyên nhiều plugin. Cách tổ chức theo khuôn `core/` đã có.
- Tầng **Rules** (coding/git/security/architecture/production) để spec riêng (§9 P7).

---

## 1. Mục tiêu & tiêu chí thành công

Repo hiện chỉ project **skill** (27 skill, gồm `core:git-workflow`; đều `pipeline: false`). Người dùng đóng 3 vai
(maintainer, developer fullstack, techlead) và phải tự nối skill bằng tay cho các việc lặp lại.

Giai đoạn này bổ sung 3 thành phần theo mô hình:

| Thành phần | Trả lời câu hỏi | Nguồn canonical |
|---|---|---|
| Agent | Ai làm | `plugins/<id>/agents/<agent-id>.md` |
| Workflow | Làm theo quy trình nào | `workflows/<slug>/WORKFLOW.md` |
| Orchestrator | Yêu cầu này dùng workflow nào | `workflows/orchestrator/WORKFLOW.md` |
| Skill (đã có) | Làm một capability ra sao | `plugins/<id>/skills/`, `core/skills/` |
| Evidence + Validation + DoD | Đã thật sự xong chưa | Contract §5 |

Tiêu chí thành công (đo được):

- `npm test` xanh. `validate.mjs` có contract cho agent, workflow, step, registry orchestrator (§7).
- `aip build` sinh:
  - agent: `build/claude/plugins/<id>/agents/<agent>.md`, `build/codex/<id>/agents/<agent>.toml`;
  - workflow: `build/claude/plugins/workflows/skills/<wf-id>/SKILL.md`, `build/codex/workflows/skills/<wf-id>/SKILL.md`.
- `aip install --provider claude|codex --plugin workflows` cài đủ 12 workflow + orchestrator, kéo theo skill và
  agent cần thiết (dependency closure), ghi manifest; `aip uninstall` gỡ sạch.
- Cài từ **gói npm** được đủ 12 workflow (nhờ publish `engineering` + `ops`, §8).
- Không đổi hành vi hay nội dung của 27 skill hiện có.

## 2. Đánh giá theo vai

| Vai | Việc lặp lại | Workflow phục vụ |
|---|---|---|
| Developer fullstack | Làm feature BE/FE, viết test, sửa bug, làm API, đổi schema | WF01, WF02, WF05, WF07, WF08 |
| Techlead | Review PR, refactor/đổi kiến trúc, security review, hiệu năng | WF03, WF04, WF06, WF09 |
| Maintainer | Release, xử lý sự cố, cập nhật tài liệu | WF10, WF11, WF12 |

## 3. Catalog agent (11)

`mode` là trường trung lập với provider. Adapter map:

- Claude: `read-only` → `disallowedTools: Edit, Write, NotebookEdit, Agent`; `write` → `disallowedTools: Agent`.
- Codex: `read-only` → `sandbox_mode = "read-only"`; `write` → `"workspace-write"`.

| Agent id | Plugin | Vai | mode | Skill gói | Dùng trong |
|---|---|---|---|---|---|
| `backend-implementer` | backend | Developer | write | backend-implement, backend-api-contract | WF01, WF07, WF08 |
| `backend-test-writer` | backend | Tester | write | backend-testing | WF01, WF02, WF03, WF05, WF08 |
| `backend-reviewer` | backend | Reviewer | read-only | backend-code-review, backend-api-contract (kiểm drift) | WF01–WF04, WF07–WF09 |
| `frontend-implementer` | frontend | Developer | write | frontend-implement | WF01, WF08 |
| `frontend-test-writer` | frontend | Tester | write | frontend-testing | WF01, WF02, WF03, WF05 |
| `frontend-reviewer` | frontend | Reviewer | read-only | frontend-code-review | WF01–WF04 |
| `engineering-quality-auditor` | engineering | Security/Quality | read-only | engineering-quality-gate, engineering-convention-enforce (chế độ kiểm) | WF01–WF04, WF06, WF11 |
| `engineering-spec-analyst` | engineering | Analyst | write (chỉ `docs/`) | engineering-spec-writing, engineering-adr, engineering-diagram | WF01, WF03, WF10, WF12 |
| `engineering-release-scribe` | engineering | Release | write (chỉ `docs/`, `CHANGELOG.md`) | engineering-release-notes | WF11 |
| `ops-incident-investigator` | ops | SRE | read-only | ops-incident-troubleshooting, ops-observability | WF10 |
| `ops-release-engineer` | ops | DevOps | read-only | ops-deploy-release, ops-observability | WF11 |

Không tách agent Security riêng: `engineering-quality-gate` đã phủ cả quality và security review source-first
(OWASP/ASVS/CWE, SCA, secrets); tách ra chỉ trùng lặp.

Nguyên tắc chung cho agent:

- Agent **không** commit, push hay tạo PR. Workflow ở session chính gọi `core:git-workflow` sau checkpoint.
- Agent **không** gọi agent khác (Claude: không cấp tool `Agent`). Chỉ workflow điều phối, để luồng phẳng, dễ audit.
- Agent trả **báo cáo có cấu trúc**: kết quả, `file:line`, residual risk; mọi khẳng định "đã chạy / đã pass" kèm
  evidence §5.1 (không chạy được → `not_run` + lý do). Reviewer/auditor trả finding theo schema §5.1.
- Agent **không** dùng frontmatter `skills:` của Claude, vì [Unverified] tên preload khác nhau giữa cài phẳng
  (`backend-code-review`) và cài plugin (`backend:backend-code-review`). Adapter chèn pointer nêu cả 2 dạng tên.

## 4. Bộ 12 workflow + Orchestrator

### 4.1 Catalog

Id có dạng `workflow-<slug>`, nguồn ở `workflows/<slug>/WORKFLOW.md`. Tiền tố `workflow-` tránh trùng tên với skill
khi cài phẳng vào `.claude/skills/` hoặc `.codex/skills/`.

Tier quyết định độ sâu nội dung: **Tier 1** viết sâu (nhiều gate, bảng lỗi chi tiết, DoD chặt); **Tier 2** đủ
template nhưng gọn; **Tier 3** gọn.

| Mã | Id | Tier | Risk | Thay cho (plan cũ) | Agent |
|---|---|---|---|---|---|
| WF01 | `workflow-feature` | 1 | medium | W1 + W2 + W3 | spec-analyst, BE/FE implementer, BE/FE test-writer, BE/FE reviewer, quality-auditor |
| WF02 | `workflow-bugfix` | 1 | medium | W11 | BE/FE test-writer, BE/FE reviewer, quality-auditor |
| WF03 | `workflow-refactor` | 1 | medium | W4a + W4b + W6 | BE/FE test-writer, BE/FE reviewer, spec-analyst, quality-auditor |
| WF04 | `workflow-code-review` | 1 | low | W5 | BE/FE reviewer, quality-auditor |
| WF05 | `workflow-testing` | 2 | low | mới | BE/FE test-writer |
| WF06 | `workflow-security-review` | 1 | high | W14 | quality-auditor |
| WF07 | `workflow-db-change` | 2 | high | W15 | backend-implementer, backend-reviewer |
| WF08 | `workflow-api` | 2 | medium | mới (tách từ bước contract W1) | backend-implementer, backend-test-writer, backend-reviewer, frontend-implementer |
| WF09 | `workflow-performance` | 3 | medium | W16 | backend-reviewer |
| WF10 | `workflow-incident` | 1 | critical | W9 | ops-incident-investigator, spec-analyst |
| WF11 | `workflow-release` | 2 | high | W8 | quality-auditor, release-scribe, release-engineer |
| WF12 | `workflow-docs` | 3 | low | W17 | spec-analyst |
| — | `workflow-orchestrator` | — | — | mới | không (session chính) |

Workflow chưa đưa vào bộ 12 (tương lai): `workflow-new-project` (W7 cũ), `workflow-dependency-upgrade`,
`workflow-onboarding`, `workflow-tech-debt-review` (§9).

**Skill gap không chặn workflow.** Trường `Thực hiện` của step cho phép `session chính`, nên phương pháp của bước
chưa có skill (debug, migration, profiling, docs-sync, CI) được viết thẳng trong body workflow. Skill gap (§9) làm
sau chỉ để đào sâu các bước đó.

### 4.2 Chuỗi bước từng workflow

Ký hiệu: `→` tuần tự, `∥` song song, `⏸` checkpoint người duyệt. Chi tiết mỗi bước theo step contract §6.

| Mã | Chuỗi bước | Ràng buộc đặc thù |
|---|---|---|
| WF01 | Phân tích yêu cầu + acceptance criteria + **nhận diện phạm vi BE/FE/fullstack** (spec-analyst) ⏸ → thiết kế/contract (backend-implementer nếu có API; ADR nếu ảnh hưởng kiến trúc) ⏸ → implement (BE ∥ FE implementer, chỉ phần có đụng) → test (BE ∥ FE test-writer) → review (reviewer ∥ quality-auditor), finding → sửa → test lại → docs (session chính) → commit ⏸ | Mỗi acceptance criterion có ít nhất 1 test; "compile được" không phải xong. Gap G1: FE chưa nối API → checkpoint "nối data thủ công" |
| WF02 | Hiểu bối cảnh → **tái hiện** (test-writer viết failing test) → thu evidence (log/stacktrace/metric/DB) → root cause (session chính) ⏸ → fix tối thiểu → regression test + chạy toàn bộ test → review ∥ gate ⏸ → commit | Cấm: sửa khi chưa tái hiện hoặc chưa có evidence mạnh; chỉ sửa triệu chứng; xoá/nới test cho qua |
| WF03 | Chọn chế độ `code` \| `architecture` → xác định nợ + invariant hành vi → (architecture: ADR bởi spec-analyst ⏸) → baseline XANH → characterization test (test-writer) → đổi từng bước nhỏ (`*-refactor` hoặc `*-migrate-architecture`), XANH sau mỗi bước → so hành vi trước/sau → review ∥ gate (architecture: thêm convention-enforce) ⏸ → commit theo lô | Không đổi hành vi quan sát được; đổi hành vi → chuyển WF01 |
| WF04 | Hiểu intent (mô tả PR, diff) → phân vùng diff BE/FE → (BE reviewer ∥ FE reviewer ∥ quality-auditor), chỉ phần có đụng → **validate findings** (đọc lại `file:line`, loại finding không tái lập được hoặc `confidence: low` không evidence) → gộp theo severity, dedupe → verdict | Chỉ đọc. Không commit. Report ghi số finding bị loại |
| WF05 | Phân tích code + yêu cầu → test strategy theo policy (feature: unit; API: integration + contract; luồng quan trọng: e2e) ⏸ → viết test (test-writer) → chạy → phân tích failure → coverage | Failure do lỗi code (không phải lỗi test) → dừng, đề xuất WF02. e2e chờ G5 |
| WF06 | Phạm vi + threat theo vùng rủi ro → source review + scan (quality-auditor) → validate findings → kế hoạch remediation ⏸ → sửa (session chính) → re-scan → report | Finding `blocker` chặn `completed`. Mask mọi secret trong report |
| WF07 | Data model + impact → thiết kế migration forward + rollback + tương thích ngược (expand/contract) ⏸ → implement migration (session chính) + code (backend-implementer) → review query/index (backend-reviewer) → chạy migration + rollback trên DB test → commit ⏸ | Cấm thay đổi phá huỷ dữ liệu khi chưa xác nhận; không chạy trên production. Migration tool chờ G2 |
| WF08 | Contract-first OpenAPI (backend-implementer, skill `backend-api-contract`) ⏸ → implement BE → integration + contract test (backend-test-writer) → kiểm drift contract↔code (backend-reviewer) → FE client (frontend-implementer, tuỳ chọn) → docs → commit ⏸ | Breaking change phải có versioning/deprecation |
| WF09 | Định nghĩa metric + mục tiêu → baseline → profile → giả thuyết ⏸ → tối ưu → benchmark + so sánh trước/sau → regression test → review (backend-reviewer) | Không có số đo trước/sau trên cùng điều kiện → không được `completed`. Tool đo chờ G10 |
| WF10 | Triage + blast radius (investigator) → evidence (log/metric/trace/deploy/infra/DB) → giả thuyết + kiểm chứng → **đề xuất** mitigation ⏸ → xác minh phục hồi → RCA + postmortem (spec-analyst) → nối tiếp WF02 | Agent chỉ đọc; mitigation do người thực hiện hoặc xác nhận. Output có `incident` block (summary, timeline, impact, root_cause, mitigation, prevention) |
| WF11 | Gate (quality-auditor) ⏸ → release notes (release-scribe) ⏸ → deploy checklist + điều kiện rollback (release-engineer) → hậu kiểm health/observability (release-engineer) → đề xuất tag qua `git-workflow` ⏸ | Tag/push chỉ đề xuất lệnh, chờ xác nhận. CI chờ G6 |
| WF12 | Diff → phát hiện tài liệu bị ảnh hưởng (README, API docs, ADR, runbook, `project-knowledge/`, `AGENTS.md`) → cập nhật (spec-analyst cho ADR/diagram; session chính cho phần còn lại) → kiểm link/ví dụ → commit ⏸ | Không sửa vùng managed block của `AGENTS.md`/`CLAUDE.md`. Docs-sync sâu chờ G11 |

### 4.3 Orchestrator (`workflow-orchestrator`)

Nguồn `workflows/orchestrator/WORKFLOW.md`, `kind: orchestrator`. Chạy ở session chính, không dispatch agent,
không sửa code. Dùng cùng template 7 heading.

**Registry**: bảng viết tay trong body, mỗi dòng một workflow.

| Cột | Nội dung |
|---|---|
| `id` | `workflow-<slug>` |
| `Tín hiệu` | từ khoá VI/EN + loại đầu vào điển hình (vd "stacktrace", "prod down", "PR #", "migration") |
| `Risk` | `low` \| `medium` \| `high` \| `critical` — phải bằng `risk` trong frontmatter của workflow |
| `Nối tiếp` | workflow có thể chạy sau (vd incident → bugfix → docs) |
| `Không dùng khi` | ranh giới với workflow gần giống (vd refactor ≠ đổi hành vi) |

**Các bước:**

1. **Phân loại**: so yêu cầu với cột `Tín hiệu` → 1 workflow, hoặc tối đa 2 ứng viên. Trùng nhiều workflow thì
   ưu tiên: incident > security-review > bugfix > db-change > api > feature > refactor > performance > testing >
   code-review > release > docs.
2. **Kiểm cài**: workflow chưa cài → in lệnh `aip install …`, dừng. Không tự cài.
3. **Xác nhận ⏸**: nêu workflow chọn, lý do, risk, chuỗi nối tiếp. Mơ hồ → hỏi người dùng chọn 1 trong 2 ứng viên.
   Risk `high`/`critical` → bắt buộc xác nhận rõ ràng.
4. **Chạy**: gọi skill workflow đã chọn. Chuỗi nối tiếp chạy **tuần tự**, tối đa 3 workflow, ⏸ giữa mỗi workflow.
5. **Tổng hợp**: gom `workflow_result` từng workflow → `orchestrator_result`.

```yaml
orchestrator_result:
  request: "<tóm tắt yêu cầu>"
  classified: workflow-bugfix
  reason: "<tín hiệu khớp>"
  chain: [workflow-bugfix, workflow-docs]
  results: [ <workflow_result>, … ]
  status: completed        # completed | failed | blocked — trạng thái xấu nhất trong chain
```

Không làm: chạy workflow song song, tự cài workflow, gọi lồng orchestrator, phân loại bằng máy ở CLI.

## 5. Contract đầu ra

Các contract là **định dạng đầu ra mà body yêu cầu model tuân theo**, không phải dữ liệu CLI parse. Không cần mở
rộng parser frontmatter.

### 5.1 Evidence, finding, result

**Evidence** cho mỗi lệnh kiểm chứng (build/test/lint/scan):

```yaml
- command: "mvn test"
  exit_code: 0
  status: passed        # passed | failed | not_run
  summary: "142 tests, 142 passed, 0 failed, 0 skipped"
  reason: ""            # bắt buộc khi not_run
```

**Finding** (reviewer, quality-auditor). Severity giữ thang của skill `*-code-review`:

```yaml
- severity: blocker     # blocker | major | minor | nit
  category: correctness # correctness | architecture | security | performance | testing | readability
  location: "src/.../OrderService.java:42"
  evidence: "<trích đoạn hoặc lý do quan sát được>"
  impact: "<hậu quả nếu không sửa>"
  recommendation: "<cách sửa>"
  confidence: high      # high | medium | low
```

**Result contract**: mọi workflow kết thúc bằng:

```yaml
workflow_result:
  workflow: <workflow-id>
  status: completed     # completed | failed | blocked
  summary: "<1–3 câu>"
  changes: { added: [], modified: [], deleted: [] }
  validation: [ <evidence> ]
  findings: [ <finding> ]    # nếu workflow có bước review
  remaining_risks: []
  docs_updated: []
  next_actions: []
```

### 5.2 Quy tắc chung

- `status: completed` chỉ khi mọi mục Definition of Done có evidence `passed`. Mục `not_run` ghi vào
  `remaining_risks`; mục bắt buộc mà `not_run` → `blocked`.
- Không kết luận về hiệu năng nếu không có số đo trước/sau trên cùng điều kiện.

## 6. Khung workflow, step contract, template

### 6.1 Khung 7 heading

1. **Mục tiêu & đầu vào**
2. **Điều kiện tiên quyết**: skill/agent/artifact phải có sẵn
3. **Các bước**: mỗi bước theo step contract §6.2
4. **Checkpoint ⏸**: bảng `Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi`
5. **Xử lý lỗi & rollback**: bảng `Tình huống | Hành động` (tối thiểu: build fail, test fail, yêu cầu mơ hồ,
   finding blocker), điều kiện dừng, cách rollback
6. **Definition of Done**: checklist riêng, mỗi mục trỏ tới evidence
7. **Report cuối**: khối `workflow_result` §5.1

Fallback khi không có subagent: session chính chạy tuần tự skill tương ứng.

### 6.2 Step contract

Mỗi bước là heading `### Bước <n> — <tên>` dưới `## Các bước`, `<n>` tăng liên tục từ 1, có đủ 8 trường:

| Trường | Nội dung |
|---|---|
| `Thực hiện` | agent `<plugin>-<agent>` \| skill `<id>` \| `session chính`; song song ghi `agent A ∥ agent B` |
| `Đầu vào` | artifact từ bước trước hoặc đầu vào workflow |
| `Hành động` | việc cụ thể phải làm |
| `Ràng buộc` | phạm vi được sửa, điều cấm |
| `Đầu ra` | artifact / file / report |
| `Gate` | điều kiện kiểm chứng được để qua bước |
| `Khi fail` | chẩn đoán → sửa → chạy lại \| hỏi lại \| dừng workflow |
| `Evidence` | lệnh + exit code / `file:line` / artifact (định dạng §5.1) |

- Bước kết thúc bằng checkpoint gắn `⏸` cuối tên bước và có dòng trong bảng `## Checkpoint`.
- Agent nêu trong `Thực hiện` phải có trong frontmatter `agents`; skill nêu phải có trong `requires` hoặc là skill
  của một agent trong `agents`.

### 6.3 Template

`templates/workflows/workflow.template.md`: khung WORKFLOW.md đầy đủ (frontmatter + 7 heading + step contract +
`workflow_result`). Mọi workflow và orchestrator viết từ template này. Không có code nào tự quét `templates/workflows/`.

## 7. Kiến trúc kỹ thuật

### 7.1 Nguồn canonical

```
plugins/<id>/agents/<agent-id>.md     # frontmatter: name, description, mode, skills, model?, effort?, color?
workflows/
├── .manifest.json                     # {id: "workflows", name, description, version}
├── orchestrator/WORKFLOW.md           # kind: orchestrator, chứa registry
└── <slug>/
    ├── WORKFLOW.md                    # kind: workflow
    ├── checklist.md                   # tuỳ chọn
    └── examples/                      # tuỳ chọn
templates/workflows/workflow.template.md
```

Frontmatter WORKFLOW.md: `name` (= `workflow-<slug>`), `description` (có trigger VI), `order`, `title`,
`kind` (`workflow` | `orchestrator`), `tier` (`1` | `2` | `3`; orchestrator bỏ trống), `risk`, `agents`, `requires`,
`runsIn: execute`, `invoke: per-request`, `pipeline: false`, `next: null`. Danh sách là chuỗi phân tách bằng dấu phẩy
(parser chỉ nhận scalar, giống `sharedAssets`); phần tử có dạng `plugin/skill` hoặc `plugin-agent`.

### 7.2 Loader (`cli/lib/plugins.mjs`)

- `loadAgents(pluginDir)` → `{ id, description, mode, skills[], model, effort, color, body, file }`.
- `loadWorkflows()` → object hình dạng plugin như `loadCore()`: `{ id: 'workflows', name, version, description,
  stages: [...], agents: [] }`. Mỗi stage đọc từ `WORKFLOW.md` bằng cùng parser frontmatter, thêm `kind`, `tier`,
  `risk`, `agents[]`, `requires[]`.
- `loadPlugins()` không đổi (vẫn chỉ quét `plugins/`), gắn thêm `agents`.

### 7.3 Projection

| | Claude | Codex |
|---|---|---|
| Agent | `build/claude/plugins/<id>/agents/<agent>.md` (`name`, `description`, `disallowedTools`, `model`?, `effort`?, `color`?) + pointer skill/principles | `build/codex/<id>/agents/<agent>.toml` (`name`, `description`, `developer_instructions`, `sandbox_mode`, `model_reasoning_effort`?) |
| Workflow | Plugin `workflows` trong marketplace: `plugins/workflows/.claude-plugin/plugin.json` (`dependencies`: `core` + plugin có mặt trong build mà workflow `requires`) + `plugins/workflows/skills/<wf-id>/SKILL.md` (từ WORKFLOW.md) + preamble dispatch Claude | `workflows/skills/<wf-id>/SKILL.md` + preamble dispatch Codex |
| Cursor / Antigravity | Không sinh ở giai đoạn 1 (§9 P1) | |
| Cowork | Không đưa vào `_cowork.json` (Cowork không có subagent, §9 P6) | |

Preamble dispatch nêu tên subagent cả 2 dạng (`<agent>` / `<plugin>:<agent>` trên Claude) và fallback tuần tự.

Nguồn đối chiếu (đọc ngày 2026-09-25):

- Claude: `code.claude.com/docs/en/sub-agents`. Plugin subagent bỏ qua `hooks`, `mcpServers`, `permissionMode`;
  `name` không chứa `:`.
- Codex: `learn.chatgpt.com/docs/agent-configuration/subagents`. Agent project ở `.codex/agents/`, cá nhân ở
  `~/.codex/agents/`.
- [Unverified] Codex có nhận `-` trong `name` hay không (ví dụ tài liệu dùng snake_case). Nếu không → adapter đổi
  `-` → `_`, preamble nêu tên đã đổi.
- `model` **không** map sang Codex.

### 7.4 Install

Workflow đi qua cơ chế chọn có sẵn, không thêm flag CLI:

```bash
aip install --provider claude --plugin workflows
aip install --provider claude --skill workflows/workflow-feature,workflows/workflow-bugfix
aip install --provider codex -g --skill workflows/workflow-code-review
aip install --provider claude --as-plugin --plugin workflows
aip uninstall --skill workflows/workflow-feature
```

Luồng:

```text
resolveSelection      skillCatalog xếp 'workflows' như 'core' (khối cấp repo); không tự thêm như core
      ↓
expandWorkflowDeps    với mỗi workflow đã chọn: + requires + skill của mọi agent trong agents; đệ quy, dedupe
      ↓               in: [aip] workflow-feature kéo theo: backend/backend-implement, …
effectiveSkills       closure được SUY RA mỗi lần (không lưu) → gỡ workflow thì gỡ luôn phần kéo theo,
      ↓               trừ skill được chọn tường minh hoặc do workflow khác còn lại kéo
installOne            đặt skill-dir từ build/<provider>/…/workflows/skills/ (code hiện có, không đổi)
      ↓               + đặt agent vào .claude/agents/ hoặc .codex/agents/ (agent active khi MỌI skill của nó hiệu lực)
manifest.json         ghi lựa chọn + files[] + links[] như hiện tại
```

- Closure trỏ tới skill không có trong catalog (vd plugin chưa ship) → **ném lỗi** liệt kê skill thiếu, không cài
  một nửa.
- `effectiveSkills` bỏ qua generated `<id>-principles` cho `workflows` (giống `core`).
- Wizard: nhóm `workflows` trong cây chọn, ngang các plugin; ẩn workflow có closure không thoả.

## 8. Đóng gói & publish

- `plugins/_published.json`: thêm `engineering`, `ops`. `data` giữ draft (không workflow nào bắt buộc skill `data-*`).
- `package.json` `files`: thêm `workflows/`, `plugins/engineering/`, `plugins/ops/`.
- `pack.config.json` `allowTop`: thêm `workflows`.
- Bump version minor: `plugins/engineering/.manifest.json`, `plugins/ops/.manifest.json`, `workflows/.manifest.json`
  khởi tạo `1.0.0`. Version `package.json` do chủ dự án quyết khi release.

Kết quả: cài từ npm được đủ 12 workflow + orchestrator.

## 9. Gap & phát triển sau

### Skill gap (đào sâu bước do session chính làm)

| # | Skill | Plugin | Workflow hưởng lợi |
|---|---|---|---|
| G1 | `frontend-data-integration`: nối UI với API theo contract (client/type từ OpenAPI, React Query, loading/error/empty) | frontend | WF01, WF08 |
| G2 | `backend-migrate-db` (Flyway ↔ Liquibase); spec `2026-09-07-backend-migrate-db-design.md` đã duyệt | backend | WF07 |
| G3 | `engineering-dependency-upgrade` | engineering | workflow-dependency-upgrade |
| G4 | `engineering-bugfix`: tái hiện → evidence → failing test → root cause → fix tối thiểu | engineering | WF02 |
| G5 | `frontend-e2e-testing` (Playwright) | frontend | WF05 |
| G6 | `ops-ci-pipeline`: GitHub Actions / GitLab CI / Jenkins | ops | WF11 |
| G7 | `engineering-codebase-onboarding` (brownfield → `project-knowledge/`) | engineering | workflow-onboarding |
| G8 | `engineering-tech-debt-audit` | engineering | workflow-tech-debt-review |
| G9 | `engineering-task-breakdown`: spec → task có ước lượng, phụ thuộc | engineering | WF01 |
| G10 | `backend-performance-testing` (k6/JMeter/Gatling) | backend | WF09 |
| G11 | `engineering-docs-sync` | engineering | WF12 |

### Workflow tương lai

`workflow-new-project`, `workflow-dependency-upgrade` (G3), `workflow-onboarding` (G7),
`workflow-tech-debt-review` (G8).

### Provider / nền tảng

| # | Hạng mục | Ghi chú |
|---|---|---|
| P1 | Agent/workflow cho cursor, antigravity | Antigravity có thể chiếu sang `.agent/workflows/` native, cursor `.cursor/commands/` [Unverified] |
| P2 | Claude native workflow `.js` | Fan-out tất định (vd WF04 nhiều module); tốn token, người dùng opt-in |
| P3 | Hooks (vd pre-commit gọi quality-auditor) | Hook trong plugin subagent bị bỏ qua; phải đặt ở `settings.json` project |
| P4 | `[agents]` trong `.codex/config.toml` | Persistent config, cần người dùng xác nhận |
| P6 | Workflow cho Cowork | Cowork không có subagent; chỉ đưa vào nếu có fallback tuần tự |
| P7 | **Tầng Rules** (coding/git/security/architecture/production) | Spec riêng. Hiện rule nằm rải: `core/principles`, `shared/principles.md`, `AGENTS.md`, `git-workflow`, `code-convention.md`. Thiếu rule Production (deploy/incident) |

## 10. Rủi ro còn lại

- [Unverified] Chỉ kiểm chứng được khi chạy thật trên client:
  - Claude plugin-mode resolve pointer skill từ bên trong subagent;
  - Claude plugin `workflows` khai `dependencies` nhiều plugin cùng marketplace (hiện adapter mới dùng `["core"]`);
  - Codex nhận `.codex/agents/` khi cài scope project.
- [Inference] Contract §5 và phân loại của orchestrator chỉ là chỉ dẫn trong body; CLI không kiểm được model có tuân
  thủ. Mức tuân thủ chỉ đánh giá được khi chạy thật.
- Closure WF01/WF03 kéo cả skill BE lẫn FE dù project chỉ có một phía; chấp nhận để giữ một điểm vào.
- Publish `engineering` + `ops` đưa nội dung đang draft vào gói npm; cần rà soát nội dung trước release.
- Chạy song song (WF01, WF04) làm token tăng theo số agent.

## 11. Đối chiếu đề xuất bên ngoài (2026-09-25)

Đối chiếu với đề xuất "developer agent: 10 capability + 12 workflow + workflow template + orchestrator" (hội thoại
ChatGPT do chủ dự án cung cấp) và sơ đồ AGENTS / WORKFLOWS / RULES → SKILLS → TOOLS → EVIDENCE → VALIDATION → DoD.

Đã áp dụng: bộ 12 workflow (§4), orchestrator dạng skill có registry (§4.3), thư mục `workflows/` tách khỏi plugin
(§7.1), evidence/result contract + finding schema (§5), step contract + template (§6), agent DevOps (§3).

Áp dụng có điều chỉnh / không áp dụng:

| Đề xuất | Quyết định |
|---|---|
| `workflow.yaml` máy đọc + registry YAML | Không. Registry là bảng Markdown trong orchestrator, validate ép đồng bộ (§7). Parser giữ scalar-only, zero-dep |
| Orchestrator/Task Classifier dạng runtime | Điều chỉnh: orchestrator là skill ở session chính, model phân loại theo registry |
| Thư mục phẳng `agents/ skills/ rules/` | Không. Agent/skill giữ trong plugin (publish, pack-guard theo plugin); chỉ `workflows/` tách ra |
| State machine PENDING → … → COMPLETED | Không. Không có runtime để ép; checkpoint ⏸ + `status` của result đảm nhận |
| Agent theo vai thuần (Developer/Reviewer/Tester/Security/DevOps) | Điều chỉnh: agent theo domain × vai; Security dùng quality-auditor, DevOps thêm `ops-release-engineer` |
| Tầng RULES | Để spec riêng (P7) |
| TOOLS | Ngoài phạm vi; skill tự gọi CLI/MCP như hiện tại |
