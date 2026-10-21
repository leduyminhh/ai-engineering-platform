# Thiết kế: template chuẩn cho mọi artifact, đặt trong core (project 1b)

- Ngày: 2026-10-20
- Trạng thái: **Đã duyệt và thực thi** — merge vào `master` = `c337dbc` (2026-10-20).
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P1b (xu hướng 5)
- Requirement: không có
- Liên quan: project 1 [`../2026-10-20-superpowers-docs-standard/design.md`](../2026-10-20-superpowers-docs-standard/design.md) — tạm dừng ở bước plan; làm sau project này và đọc template từ đây.

## Vấn đề và lý do

- Template nằm rải rác 4 nơi: `templates/skills/`, `templates/workflows/`, `templates/init/docs/…`, `plugins/engineering/skills/engineering-task-breakdown/references/`.
- Agent không có template. Khảo sát 16 agent (2026-10-20):
  - Khung H2 đồng nhất (validator ép).
  - Nhưng nội dung trong mục lệch nhau:
    - `Phạm vi` khi có 2, khi có 3 tầng.
    - 8/12 agent ghi không có `writeScope`.
    - Không agent nào khai `model` / `effort` / `maxTurns`.
    - `Report trả về` mỗi agent một kiểu.
- `templates/skills/skill.template.txt` đã lỗi thời: heading không khớp validator hiện tại (thiếu `## Quy trình…`, `## Ranh giới an toàn…`).
- Template chưa dựa trên nguồn uy tín.
- `templates/` không nằm trong plugin `core`, nên agent ở project đích không đọc được template khi viết artifact.

## Quyết định đã chốt (của người dùng)

| ID | Quyết định |
|---|---|
| D1 | Chuẩn hóa template trước, đưa vào `core`. Áp dụng cho nội dung hiện có (16 agent, skill, workflow) là project sau. |
| D2 | Template cho 9 loại: skill, agent, workflow, requirement, design, plan, task, ADR, project-knowledge. |
| D3 | Cơ chế: skill core `artifact-templates` (`SKILL.md` = mục lục, `references/<loại>.template.md` = template). `aip init` đọc template từ đây — một nguồn duy nhất. |
| D4 | Tiến hóa template hiện có, không viết lại từ đầu; thay đổi chính theo bảng ở mục Thiết kế §3. |
| D5 | Template dựa trên nguồn uy tín (mục Nguồn). |
| D6 | Skill/agent **đọc hoặc mô tả** template được sửa luôn trong project này để trỏ về core (một nguồn, không mâu thuẫn): `engineering-adr`, `engineering-spec-analyst`, `engineering-spec-writing` (spec-structure), `engineering-task-breakdown`, và ADR ví dụ `0001`, `0002`. |

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given `core/skills/artifact-templates/`, Then có `SKILL.md` và đủ 9 template trong `references/` (project-knowledge là thư mục con giữ các file hiện có).
- [ ] **AC1.2** — Given `SKILL.md` của skill, Then có bảng mục lục: mỗi loại → file template → validator (hoặc "chưa có") → nguồn tham chiếu; skill qua mọi validator skill hiện có (khung H2, description, frontmatter).
- [ ] **AC1.3** — Given mỗi file template, Then mở đầu bằng khối chú thích `<!-- artifact-template … -->` có `type`, `version`, `validator`, `sources`, và ghi rõ khối này bị bỏ khi chép ra dùng.
- [ ] **AC2.1** — Given `agent.template.md` sau khi điền mẫu (fixture trong test), Then qua `checkAgentTools`, `checkAgentDescription`, `checkSourceKeys('agent', …)` và kiểm khung 4 heading agent hiện có.
- [ ] **AC2.2** — Given `agent.template.md`, Then `Phạm vi` có 3 tầng `Luôn làm` / `Hỏi trước` / `Không bao giờ`; `Quy trình` mở bằng `Khi được gọi:` và có bước kiểm chứng; `Report trả về` là bảng với các dòng `Kết quả`, `Evidence`, `File đã đổi`, `Rủi ro còn lại`; frontmatter mẫu khai `tools` và `writeScope`.
- [ ] **AC2.3** — Given `skill.template.md` sau khi điền mẫu, Then qua `checkSkillBody`, `checkDescription`, `checkDescriptionStyle`, `checkSourceKeys('skill', …)`; template có chỗ cho checklist quy trình, vòng validate → sửa, và ghi giới hạn SKILL.md dưới 500 dòng, reference sâu một tầng.
- [ ] **AC2.4** — Given `workflow.template.md` sau khi điền mẫu, Then qua `checkWorkflowBody` + dòng neo khung hiện có (`WF_ANCHORS`, 8 trường/bước). Khung bước không đổi trong project này.
- [ ] **AC2.5** — Given `task.template.md` sau khi điền mẫu dạng `tasks.md`, Then `check-tasks.mjs` (`parseTasks` + `checkTasks`) trả 0 lỗi.
- [ ] **AC2.6** — Given `requirement.template.md`, Then giữ 4 heading gốc (`Yêu cầu gốc`, `Bối cảnh`, `Ràng buộc`, `Tiêu chí chấp nhận`), câu requirement dạng `Hệ thống PHẢI …`, AC dạng `**AC<n>.<m>** — Given … When … Then …`, có mục `Không đổi (bugfix)`.
- [ ] **AC2.7** — Given `design.template.md` và `plan.template.md`, Then đúng khung trong design project 1 §4.2 (plan mở bằng header bắt buộc của `superpowers:writing-plans`, có `**Phủ AC:**`).
- [ ] **AC2.8** — Given `adr.template.md`, Then có các mục theo MADR 4.0 viết tiếng Việt: Bối cảnh và vấn đề, Yếu tố quyết định, Các phương án, Kết quả quyết định (Hệ quả, Xác nhận), Ưu nhược từng phương án; metadata `Trạng thái`, `Ngày`, `Người quyết định`.
- [ ] **AC3.1** — Given `aip init --full` ở thư mục trống, Then `docs/requests/_TEMPLATE/` (requirement, design, plan), `docs/decisions/_TEMPLATE.md` và `project-knowledge/` được sinh từ `core/skills/artifact-templates/references/` (khối chú thích bị bỏ), không còn từ `templates/init/docs/…` / `templates/init/project-knowledge/`.
- [ ] **AC3.2** — Given các skill `*-init`, Then cây `templates` ship kèm vẫn đủ file như trước (nội dung docs/project-knowledge lấy từ nguồn mới).
- [ ] **AC3.3** — Given repo sau thay đổi, Then `templates/skills/skill.template.txt`, `templates/workflows/workflow.template.md`, `templates/init/docs/requests/_TEMPLATE/`, `templates/init/docs/decisions/_TEMPLATE.md`, `templates/init/project-knowledge/` không còn; mọi chỗ tham chiếu (CLAUDE.md, README, test, `plugins.mjs`, `init.mjs`) trỏ nguồn mới.
- [ ] **AC3.4** — Given `engineering-adr` (SKILL.md, description, `references/adr-structure.md`) và agent `engineering-spec-analyst`, Then mô tả ADR theo MADR 4.0, trỏ tới template `adr.template.md` của skill core `artifact-templates`; không còn yêu cầu "đủ mục Nygard".
- [ ] **AC3.5** — Given `engineering-spec-writing/references/spec-structure.md`, Then mục "Map vào `_TEMPLATE`" mô tả `plan.md` theo template plan của core (header `writing-plans`), không còn "khung Phase/Task".
- [ ] **AC3.6** — Given `engineering-task-breakdown`, Then khung `tasks.md` chung (output-formats §3 + `task-template-common.md`) chỉ còn ở `task.template.md` của core; skill trỏ tới đó; template chi tiết BE (B1–B10) / FE (F1–F9) vẫn ở skill; `check-tasks.mjs` không đổi.
- [ ] **AC3.7** — Given `templates/init/docs/decisions/0001-…`, `0002-…`, Then viết theo khung MADR 4.0 tiếng Việt.
- [ ] **AC4.1** — `npm test` xanh; bump version `core` và `engineering`; `node cli/lib/versions.mjs --lock` cập nhật; `npm run pack:verify` xanh.

## Thiết kế

### 1. Cấu trúc

```text
core/skills/artifact-templates/
├── SKILL.md
└── references/
    ├── skill.template.md
    ├── agent.template.md
    ├── workflow.template.md
    ├── requirement.template.md
    ├── design.template.md
    ├── plan.template.md
    ├── task.template.md
    ├── adr.template.md
    └── project-knowledge/          # chuyển nguyên từ templates/init/project-knowledge/
```

- Reference chỉ sâu một tầng từ `SKILL.md` (theo Anthropic).
- `SKILL.md` theo khung skill của repo (`## Quy trình…`, `## Ranh giới an toàn…`), dưới 500 dòng. Quy trình: xác định loại artifact → mở template tương ứng → điền → chạy validator nếu có → bỏ khối chú thích.
- Còn ở `templates/`: khung project không phải artifact — `templates/init/` (CLAUDE.md, README.md, CONTRIBUTING.md, TODO.md, `src/`, `tests/`, `docs/contracts/.gitkeep`, ADR ví dụ `0001`, `0002`) và `templates/init-minimal/`.

### 2. Khung chung của một template

```markdown
<!-- artifact-template
type: agent
version: 1
validator: cli/lib/conventions.mjs → checkAgentTools, checkAgentDescription
sources: Claude Code subagents; GitHub agents.md (2.500 repo)
Bỏ khối này khi chép template ra dùng.
-->
<khung để điền: placeholder <…> + ví dụ ngắn; không giảng giải>
```

- Nội dung tiếng Việt có dấu; key frontmatter, field, lệnh giữ tiếng Anh.
- `version` của template tăng khi khung đổi; ghi vào cột mục lục trong `SKILL.md`.

### 3. Thay đổi theo từng loại

| Loại | Khung (tóm tắt) | Thay đổi chính so với hiện tại | Nguồn |
|---|---|---|---|
| Skill | Frontmatter `name`, `description` (một câu hành động + `Dùng khi …` 3–5 trigger + `Không dùng khi … → id`), `order`, `title`, `runsIn`, `invoke`; `## Quy trình…` có checklist; vòng validate → sửa; `## Ranh giới an toàn…`; `## Verification`; `## Bản đồ tài liệu` | Thay `skill.template.txt` lỗi thời; thêm checklist, feedback loop, giới hạn 500 dòng, reference 1 tầng | Anthropic skill best practices; agentskills.io |
| Agent | Frontmatter `name`, `description` (≤ 260 ký tự, kết thúc `Dùng khi …`), `mode`, `skills`, `tools` (luôn khai), `writeScope` (bắt buộc khi `mode: write`), `maxTurns` (tùy chọn); `## Vai trò` (1–2 câu + đầu vào bắt buộc); `## Phạm vi` (Luôn làm / Hỏi trước / Không bao giờ); `## Quy trình` (`Khi được gọi:` + bước kiểm chứng); `## Report trả về` (bảng chung) | Template mới | Claude Code subagents; GitHub agents.md |
| Workflow | Khung hiện có (8 trường/bước, ⏸) giữ nguyên | Chỉ chuyển vị trí + thêm khối chú thích nguồn. ID bước, `depends_on`, schema gate để project 2 làm cùng validator graph — thêm trường bây giờ sẽ phá `WF_ANCHORS` ("đủ 8 trường") và làm đỏ 4 workflow thật | Anthropic workflow patterns; LangGraph interrupt (cho project 2) |
| Requirement | 4 heading gốc + `Hệ thống PHẢI …` + AC `AC<n>.<m>` Given/When/Then + `Không đổi (bugfix)` | ID AC, câu requirement kiểu EARS | Kiro (EARS); OpenSpec |
| Design | Như design project 1 §4.2 | Template mới | superpowers brainstorming; Kiro `design.md` |
| Plan | Header `writing-plans` + `**Requirement:**` + `**Phủ AC:**` | Thay khung Phase | superpowers writing-plans |
| Task | Template chung dạng `tasks.md` mà `check-tasks.mjs` đọc được; giữ quy ước ID `UC<nn>-<loại>-<nn>` của aip; cột AC | Đưa khung chung ra core (một nguồn, D6). Template chi tiết BE (B1–B10) / FE (F1–F9) vẫn ở `engineering-task-breakdown`. Mục lục ghi validator là `check-tasks.mjs` của `engineering-task-breakdown` — chỉ có khi cài plugin `engineering` | Spec Kit / Kiro `tasks.md`; check-tasks hiện có |
| ADR | MADR 4.0 bằng tiếng Việt | Thay khung ADR rút gọn hiện tại | MADR 4.0.0 |
| Project knowledge | Giữ nguyên file hiện có | Chỉ đổi vị trí | — |

### 4. Template phải qua validator của chính nó

- Thêm module contract `test/contract/35-artifact-templates.contract.mjs`.
- Với loại có validator (skill, agent, workflow, task): điền placeholder bằng giá trị mẫu cố định trong test rồi chạy validator. Template không qua thì test đỏ.
- Với loại chưa có validator (requirement, design, plan, ADR): pin heading và mẫu dòng bắt buộc. Project 1 sẽ thêm `check-request.mjs` cho requirement/design/plan.
- Quy tắc agent mới (3 tầng Phạm vi, `tools` bắt buộc, `writeScope` cho agent ghi, bảng Report) chỉ kiểm trên **template** trong project này. Bật kiểm trên 16 agent thật là việc của project áp dụng (D1) — nếu bật ngay, `npm test` đỏ.

### 5. `aip init` và skill `*-init`

- `cli/lib/init.mjs`: khi `--full`, ngoài `templates/init/` còn sinh từ `core/skills/artifact-templates/references/`: `docs/requests/_TEMPLATE/{requirement,design,plan}.md`, `docs/decisions/_TEMPLATE.md`, `project-knowledge/*`. Bỏ khối `<!-- artifact-template … -->` khi ghi. Giữ quy tắc không ghi đè file có sẵn.
- `cli/lib/plugins.mjs` (`initAssets`): cây `templates` ship kèm skill `*-init` được ghép từ hai nguồn trên, kết quả giống `aip init --full` (AC3.2).

## Ngoài phạm vi và anti-goal

Ngoài phạm vi:
- Chuyển 16 agent và các skill/workflow **không đọc template** sang khung mới (project sau). Skill/agent đọc template thuộc phạm vi (D6).
- Validator máy đọc workflow graph (project 2).
- `check-request.mjs` và quy ước superpowers (project 1).
- Template cho hook, eval case, command.

Anti-goal:
- Template dài, giảng giải điều Claude đã biết (trái nguyên tắc "concise" của Anthropic).
- Hai nguồn template song song (cũ trong `templates/` và mới trong core) cùng tồn tại sau thay đổi.
- `npm test` đỏ vì quy tắc mới áp lên nội dung chưa chuyển đổi.

## Ràng buộc

- Zero runtime dependency, ESM, UTF-8 không BOM, LF.
- `core` ship trong gói npm: `npm run pack:verify` phải xanh. `core/` đã thuộc `allowTop`; không cần sửa `pack.config.json`.
- Version gate: bump `core/.manifest.json` và `plugins/engineering/.manifest.json` (D6); plugin có skill `*-init` (backend, frontend, data) đổi asset ship kèm thì bump theo kết quả `versions.mjs --lock`.
- Description skill mới theo quy ước repo (≤ 500 ký tự, `Dùng khi "…"` 3–5 trigger, `Không dùng khi … → id`), không trùng trigger của skill khác.
- Baseline viết tiếng Anh không bị ảnh hưởng; template viết tiếng Việt.
- Không phụ thuộc commit chưa merge ngoài `271a12e` (branch hiện tại `feature/superpowers-docs-standard` đã tách từ đó). Builder quyết làm trên branch này hay branch mới.

## Kiểm thử

| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1–AC1.3 | Contract | `35-artifact-templates.contract.mjs` |
| AC2.1, AC2.3–AC2.5 | Contract | Điền mẫu + chạy validator (một test tham số hóa theo loại) |
| AC2.2, AC2.6–AC2.8 | Contract | Pin heading / mẫu dòng |
| AC3.1 | Integration | `test/init.test.mjs` (đã có test `init --full`) |
| AC3.2 | Contract build | `30-templates.contract.mjs` mục 6b |
| AC3.3 | Contract | Kiểm file cũ không còn + `30-templates` cập nhật danh sách `must` |
| AC3.4–AC3.7 | Content pin | Sửa pin hiện có khóa wording cũ (Nygard, Phase, `task-template-common.md`) trong `test/content/13-task-breakdown.pin.mjs` và pin liên quan; thêm pin mới |
| AC4.1 | Chạy `npm test`, `pack:verify` | — |

Quyết định do agent đưa ra sau vòng review của builder (người dùng chưa duyệt riêng từng mục):
- Template workflow giữ nguyên khung 8 trường; ID bước, `depends_on`, schema gate để project 2 (tránh phá `WF_ANCHORS`).
- Template task giữ quy ước ID `UC<nn>-<loại>-<nn>` để qua `check-tasks.mjs`; không tổng quát hóa validator.
- Ngoài phạm vi đã ghi "áp dụng cho nội dung hiện có" chỉ còn: chuyển 16 agent và các skill/workflow không đọc template sang khung mới.

## Để builder quyết

- Câu chữ trong template và `SKILL.md`.
- Giá trị mẫu dùng để điền template trong test.
- Cách ghép hai nguồn trong `init.mjs` / `plugins.mjs` (miễn kết quả đúng AC3.1, AC3.2).
- Thứ tự commit.

## Rủi ro và câu hỏi mở

- Project 1 phải cập nhật AC2.x và Task 1 của plan: template lấy từ core thay vì `templates/init/docs/requests/_TEMPLATE/`.
- Mô tả Claude Code về field agent có thể đổi theo version; template chỉ dùng field đã có trong `SOURCE_KEYS` của repo.

## Nguồn

- [Claude Code — Subagents](https://code.claude.com/docs/en/sub-agents)
- [GitHub — How to write a great agents.md (2025-11)](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/)
- [Anthropic — Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Agent Skills](https://agentskills.io)
- [Anthropic — Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Kiro — Feature specs](https://kiro.dev/docs/specs/feature-specs/)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec)
- [MADR 4.0.0](https://adr.github.io/madr/)
