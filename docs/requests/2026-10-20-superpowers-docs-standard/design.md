# Thiết kế: chuẩn hóa docs/spec cho luồng superpowers (project 1/5)

- Ngày: 2026-10-20
- Trạng thái: chờ người dùng duyệt
- Thuộc lộ trình: chuẩn hóa aip theo 9 xu hướng AI coding — project 1 (xu hướng 3 agentic engineering, 4 spec-driven development)

## 1. Vấn đề và lý do

- Người dùng (chủ repo) dùng superpowers hằng ngày. superpowers mặc định ghi spec vào `docs/superpowers/specs/<ngày>-<topic>-design.md` và plan vào `docs/superpowers/plans/<ngày>-<feature>.md`.
- aip có hệ docs riêng: `docs/requests/<yyyy-mm-dd>-<slug>/` với `requirement.md`, `plan.md`, `tasks.md` (skill `engineering-spec-writing`, `engineering-task-breakdown`, workflow `workflow-feature`).
- Hai hệ chạy song song. Một thay đổi có thể có hai bộ spec lệch nhau, và agent không biết đâu là nguồn sự thật.
- Template hiện tại của aip không có ID cho acceptance criteria (AC), nên không truy vết được AC → task → test.

## 2. Quyết định đã chốt (của người dùng)

| ID | Quyết định |
|---|---|
| D1 | superpowers là quy trình chính. `workflow-feature`/`workflow-bugfix` chỉ dùng khi project không cài superpowers. |
| D2 | aip là nơi định chuẩn docs/spec. Không sửa plugin superpowers. Chuẩn được đưa vào qua "preferences" trong managed block `AGENTS.md`. |
| D3 | Mỗi thay đổi một thư mục `docs/requests/<yyyy-mm-dd>-<slug>/`, gồm `requirement.md`, `design.md`, `plan.md` (thêm `tasks.md` khi dùng task-breakdown). |
| D4 | Mức spec-first: spec chỉ sống trong từng thay đổi. Chưa làm spec sống `docs/specs/`. |
| D5 | AC có ID. Spec cho bugfix có mục "Không đổi". |
| D6 | Claude first: Claude Code là provider chính. Codex, Cursor, Antigravity ở mức best-effort — nhận cùng baseline và template, nhưng không chặn thiết kế hay test. |
| D7 | Đặt tên rõ hai loại bộ nhớ (ngắn hạn theo thay đổi, dài hạn theo project) và coi checkbox `plan.md` + ledger superpowers là "thread" để resume (bài học từ LangGraph). |

Cơ sở kỹ thuật cho D2 (đã đọc trong superpowers 7.0.0 tại cache plugin):
- `brainstorming/SKILL.md`: vị trí spec mặc định là `docs/superpowers/specs/…`, kèm câu "Your human partner's preferences override both".
- `writing-plans/SKILL.md`: "(User preferences for plan location override this default)"; mọi plan PHẢI mở bằng header cố định (Goal, Architecture, Tech Stack, Spec, Global Constraints, Review Focus).
- `subagent-driven-development/scripts/sdd-workspace`: workspace đặt theo basename của plan và tự phân biệt khi hai plan cùng tên `plan.md` (dùng tên thư mục cha). Vì vậy đặt mọi plan tên `plan.md` không làm hỏng luồng thực thi.

## 3. Tiêu chí chấp nhận

AC của thiết kế này viết theo đúng quy ước mới (mục 4.2).

- [ ] **AC1.1** — Given managed block trong `core/agents/AGENTS.template.md`, When đọc mục `Superpowers workflow defaults`, Then có quy định: spec của `brainstorming` ghi vào `docs/requests/<yyyy-mm-dd>-<slug>/design.md`, plan của `writing-plans` ghi vào `plan.md` cùng thư mục, và quy định này ghi đè mặc định `docs/superpowers/`.
- [ ] **AC1.2** — Given cùng mục đó, Then có quy ước: AC dạng `AC<n>.<m>` + Given/When/Then, mỗi thay đổi chỉ một nơi chứa AC, mỗi task trong plan ghi các AC nó phủ, spec bugfix có mục "Không đổi".
- [ ] **AC1.4** — Given cùng mục đó, Then có (a) bảng hai loại bộ nhớ như mục 4.6, (b) quy tắc resume: một thay đổi đã có thư mục `docs/requests/<…>/` thì tiếp tục từ task đầu tiên chưa tick trong `plan.md` (và ledger superpowers nếu có), không tạo thư mục hay plan mới.
- [ ] **AC1.3** — Given `AGENTS.md` ở gốc repo aip, Then nội dung giống byte-for-byte `core/agents/AGENTS.template.md` (ràng buộc sẵn có, vẫn phải giữ).
- [ ] **AC2.1** — Given `templates/init/docs/requests/_TEMPLATE/`, Then có đủ `requirement.md`, `design.md`, `plan.md` theo khung ở mục 4.2.
- [ ] **AC2.2** — Given `_TEMPLATE/plan.md`, Then mở bằng đúng header mà `writing-plans` yêu cầu và có chỗ ghi `Phủ AC` cho mỗi task.
- [ ] **AC2.3** — Given `_TEMPLATE/requirement.md`, Then giữ nguyên 4 heading gốc (`Yêu cầu gốc`, `Bối cảnh`, `Ràng buộc`, `Tiêu chí chấp nhận`) và thêm mục `Không đổi (bugfix)`.
- [ ] **AC3.1** — Given skill `engineering-spec-writing`, When viết spec, Then AC trong `requirement.md` có ID `AC<n>.<m>`; skill không còn dựng khung `plan.md` kiểu Phase.
- [ ] **AC3.2** — Given `workflow-feature` và `workflow-bugfix`, Then phần điều kiện tiên quyết ghi rõ: project đã cài superpowers → dùng luồng superpowers (D1); bảng routing của `workflows/orchestrator/WORKFLOW.md` ghi cùng ý. Description giữ nguyên các nhánh `→ <id>` hiện có (validator `cli/lib/conventions.mjs` chỉ nhận id có trong repo).
- [ ] **AC3.3** — Given nguồn yêu cầu đã có AC mang ID `AC<n>.<m>`, When `engineering-task-breakdown` phân rã, Then `tasks.md` dùng lại đúng các ID đó; skill chỉ tự đánh số `AC<uc>.<n>` khi nguồn chưa có ID.
- [ ] **AC4.1** — Given một thư mục request hợp lệ, When chạy script kiểm tra (mục 4.5), Then không có cảnh báo và exit 0.
- [ ] **AC4.2** — Given thư mục request có lỗi (không có nguồn AC, AC trùng ID, AC sai định dạng, AC nằm ở cả `requirement.md` lẫn `design.md`, `plan.md` thiếu dòng `**Goal:**`/`**Spec:**`, có `plan.md` hoặc `tasks.md` nhưng một AC không được task nào phủ), When chạy script, Then in một dòng cảnh báo cho mỗi lỗi dạng `WARN <file>:<dòng> <mô tả>` và exit 0.
- [ ] **AC4.3** — Given đối số sai (không có đường dẫn, đường dẫn không tồn tại), When chạy script, Then in cách dùng và exit 2.
- [ ] **AC5.1** — Given repo aip sau thay đổi, Then 15 spec và các plan cũ trong `docs/superpowers/` giữ nguyên; `CLAUDE.md` của repo trỏ tới vị trí mới cho việc từ nay.
- [ ] **AC5.2** — `npm test` xanh; version của `core`, `engineering`, `workflows` được bump; `plugins/_versions.lock.json` cập nhật bằng `node cli/lib/versions.mjs --lock`.

## 4. Thiết kế

### 4.1 Cấu trúc một thay đổi

```text
docs/requests/<yyyy-mm-dd>-<slug>/
├── requirement.md   # tùy chọn — yêu cầu mức BA, yêu cầu gốc từ người khác (engineering-spec-writing)
├── design.md        # superpowers:brainstorming
├── plan.md          # superpowers:writing-plans
└── tasks.md         # tùy chọn — engineering-task-breakdown (giữ nguyên định dạng hiện tại)
```

Quy tắc:
- **Một nguồn AC:** có `requirement.md` thì AC chỉ nằm ở đó; `design.md` trỏ tới, không chép lại. Không có `requirement.md` thì AC nằm trong mục `Tiêu chí chấp nhận` của `design.md`.
- `plan.md` ghi `**Spec:**` trỏ tới `design.md` (theo header của `writing-plans`) và `**Requirement:**` trỏ tới `requirement.md` nếu có.
- `slug` kebab-case, ngắn, mô tả thay đổi. Một thay đổi đã có thư mục thì dùng lại, không tạo thư mục thứ hai.
- Việc nhỏ mà `brainstorming` xếp loại "small change" (mô tả trong chat) không cần thư mục. Quy tắc này lấy từ chính superpowers, aip không thêm ngưỡng riêng.

### 4.2 Template

`requirement.md` — giữ 4 heading gốc (ràng buộc sẵn có trong `references/spec-structure.md`), sửa mục AC và thêm mục bugfix:

```markdown
# Requirement: <tên yêu cầu>
## Yêu cầu gốc
<...>
## Bối cảnh
<...>
## Ràng buộc
<...>
## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given <tiền điều kiện> When <hành động> Then <kết quả đo được>
## Không đổi (bugfix)
- <hành vi phải giữ nguyên; bỏ mục này nếu không phải bugfix>
```

`design.md` — khung tối thiểu, khớp các phần mà `brainstorming` yêu cầu (ý định và lý do, mục tiêu/ngoài phạm vi/anti-goal, ràng buộc, quyết định, phần để builder):

```markdown
# Thiết kế: <tên>
- Ngày: <yyyy-mm-dd>
- Trạng thái: <chờ duyệt | đã duyệt>
- Requirement: <link requirement.md, hoặc "không có">
## Vấn đề và lý do
## Quyết định đã chốt
## Tiêu chí chấp nhận
<chỉ khi không có requirement.md; cùng định dạng AC như trên>
## Thiết kế
## Ngoài phạm vi và anti-goal
## Ràng buộc
## Kiểm thử
<AC nào được kiểm ở tầng nào>
## Để builder quyết
## Rủi ro và câu hỏi mở
```

`plan.md` — header bắt buộc của `writing-plans`, thêm `Requirement` và `Phủ AC`:

```markdown
# <Tên> Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** <...>
**Architecture:** <...>
**Tech Stack:** <...>
**Spec:** design.md
**Requirement:** requirement.md | không có

## Global Constraints
## Review Focus

### Task 1: <tên>
**Phủ AC:** AC1.1, AC1.2
**Files:** <...>
```

### 4.3 Managed block `AGENTS.md`

Mở rộng mục `### Superpowers workflow defaults` trong `core/agents/AGENTS.template.md` (tiếng Anh như phần còn lại của baseline) bằng các ý:
- Spec của `brainstorming` → `docs/requests/<yyyy-mm-dd>-<slug>/design.md`; plan của `writing-plans` → `plan.md` cùng thư mục. Hai dòng này ghi đè mặc định `docs/superpowers/`.
- Có `docs/requests/_TEMPLATE/design.md` thì theo template đó. Chỉ có `_TEMPLATE` kiểu cũ (Phase, không có `design.md`) thì bỏ qua template, theo quy ước viết thẳng trong baseline. Lý do: `aip init` không ghi đè file sẵn có, nên project đã init trước đây vẫn giữ template cũ; trỏ agent vào template đó sẽ mâu thuẫn với header bắt buộc của `writing-plans`.
- Quy ước AC (AC1.2), viết đủ trong baseline để không phụ thuộc template.
- Có skill `engineering-spec-writing` thì chạy script kiểm tra (4.5) sau khi viết `design.md` và sau khi viết `plan.md`. Không có thì bỏ qua (core không được phụ thuộc cứng vào plugin `engineering`).

### 4.4 Skill và workflow

- `engineering-spec-writing`: AC có ID; bỏ bước dựng khung `plan.md` kiểu Phase (plan do `writing-plans` hoặc `engineering-task-breakdown` làm); cập nhật `references/spec-structure.md` mục "Map vào `_TEMPLATE`"; thêm script ở 4.5 và bước Verification gọi script.
- `engineering-task-breakdown`: regex AC hiện có (`AC\d+\.\d+` trong `check-tasks.mjs`) đã khớp định dạng mới. Sửa `references/analysis.md` để dùng lại ID AC của nguồn (AC3.3), và đọc được AC từ `design.md` khi không có `requirement.md`.
- `workflow-feature`, `workflow-bugfix`: thêm điều kiện D1 vào phần điều kiện tiên quyết; description không đổi nhánh `→ <id>` (AC3.2). Bảng routing trong `workflows/orchestrator/WORKFLOW.md` cập nhật theo. Khi không có superpowers, hai workflow này vẫn ghi `requirement.md` (+ `tasks.md` nếu phân rã) như hiện tại; không bắt buộc sinh `design.md`/`plan.md`.
- `CLAUDE.md` của repo aip: mục "Superpowers workflow defaults" thêm dòng vị trí docs mới (AC5.1).

### 4.5 Script kiểm tra thư mục request

- Vị trí đề xuất: `plugins/engineering/skills/engineering-spec-writing/scripts/check-request.mjs`, cùng kiểu `check-tasks.mjs`.
- Đầu vào: đường dẫn một thư mục `docs/requests/<…>/`.
- Kiểm tra: các lỗi liệt kê ở AC4.2. Quy tắc:
  - **Không có file bắt buộc theo tên.** Thư mục hợp lệ khi có đúng một nguồn AC (`requirement.md` hoặc `design.md`). `plan.md` và `tasks.md` là tùy chọn. Nhờ vậy script chạy được ngay sau khi viết `design.md` và ở luồng không có superpowers.
  - **Độ phủ AC** chỉ kiểm khi có `plan.md` hoặc `tasks.md`. Một AC tính là được phủ khi xuất hiện trong dòng `**Phủ AC:**` của `plan.md` HOẶC cột AC của `tasks.md`.
  - **Heading:** chỉ kiểm mục `Tiêu chí chấp nhận` trong file nguồn AC, và dòng `**Goal:**`/`**Spec:**` trong `plan.md`. Không kiểm các heading khác, để spec superpowers viết theo cấu trúc riêng không bị cảnh báo thừa.
- Đầu ra: mỗi lỗi một dòng `WARN <file>:<dòng> <mô tả>`; luôn exit 0 khi chạy được (mức cảnh báo, chưa chặn); exit 2 khi đối số sai.
- Chỉ dùng `node:*` để chạy được ở project đích mà không cài gì.

### 4.6 Bộ nhớ và resume

Hai loại bộ nhớ, ghi vào baseline (AC1.4):

| Loại | Phạm vi | Nơi lưu | Ai cập nhật |
|---|---|---|---|
| Ngắn hạn ("thread" của một thay đổi) | Một thay đổi, từ spec tới merge | `docs/requests/<yyyy-mm-dd>-<slug>/` (requirement, design, plan, tasks) + ledger `.superpowers/sdd/<plan>/` | Agent trong lúc làm thay đổi |
| Dài hạn | Toàn project, qua mọi thay đổi | `project-knowledge/`, `docs/decisions/` (ADR), `docs/contracts/`, `AGENTS.md`/`CLAUDE.md` | Người duyệt; agent chỉ đề xuất |

Quy tắc resume:
- Phiên mới làm tiếp một thay đổi đã có thư mục: đọc `design.md` + `plan.md`, tiếp tục từ task đầu tiên chưa tick (`- [ ]`). Có ledger superpowers thì theo ledger (superpowers đã xử lý việc này).
- Không tạo thư mục, design hay plan thứ hai cho cùng thay đổi.
- Kiến thức rút ra trong lúc làm mà còn đúng sau khi thay đổi kết thúc (quyết định kiến trúc, quy ước) → đề xuất đưa vào bộ nhớ dài hạn (ADR, `project-knowledge/`), không để lại chỉ trong `design.md`.

aip không tự xây cơ chế lưu trạng thái; phần này chỉ là quy ước trên các file và ledger đã có.

## 5. Ngoài phạm vi và anti-goal

Ngoài phạm vi:
- Spec sống `docs/specs/` (D4).
- Kiểm tra AC ↔ test (project 2 của lộ trình).
- Migrate 15 spec cũ trong `docs/superpowers/`.
- Sửa plugin superpowers.
- Chặn bằng hook (script chỉ cảnh báo).

Anti-goal (làm xong mà dính những điều này là hỏng):
- Docs phình ra: việc nhỏ cũng bị ép đủ ba file.
- Agent nhận hai chỉ dẫn mâu thuẫn (mặc định superpowers và baseline) mà baseline không nói rõ cái nào thắng.
- `aip install`/`update` làm hỏng file người dùng đã có trong `docs/requests/`.

## 6. Ràng buộc

- Zero runtime dependency, ESM, UTF-8 không BOM, LF.
- Thiết kế này dựa trên commit `271a12e` (branch `chore/superpowers-automation-defaults`, chưa merge, chưa push), vì cùng sửa mục `Superpowers workflow defaults`. Branch mới tách từ branch đó hoặc làm sau khi nó được merge.
- Version gate: bump `core/.manifest.json`, `plugins/engineering/.manifest.json`, `workflows/.manifest.json`; chạy `node cli/lib/versions.mjs --lock`.
- `test/contract/30-templates.contract.mjs` đang liệt kê file bắt buộc của `templates/init` — thêm `design.md`.
- Baseline viết tiếng Anh; nội dung skill viết tiếng Việt có dấu.

## 7. Kiểm thử

Theo mục Testing của AGENTS.md (mỗi hành vi một test, ở tầng thấp nhất bắt được lỗi):

| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1, AC1.2, AC1.4 | Contract (operational contract: đường dẫn, định dạng ID) | Pin trong `test/contract/` hoặc `test/content/` |
| AC1.3 | Contract sẵn có | Test byte-identical hiện tại |
| AC2.1–AC2.3 | Contract | Mở rộng `30-templates.contract.mjs` |
| AC3.1–AC3.3 | Content pin | `test/content/` |
| AC4.1–AC4.3 | Unit, một test tham số hóa | Fixture thư mục request hợp lệ/lỗi |
| AC5.1, AC5.2 | Chạy `npm test` + kiểm tra tay | — |

Hành vi của LLM (agent có thật sự ghi vào vị trí mới hay không) không kiểm được bằng test xác định. Có thể thêm một eval case trong `evals/` (chạy tay, tốn lượt gọi model) — để builder quyết.

## 8. Để builder quyết

- Câu chữ cụ thể trong baseline, template, skill.
- Bố cục fixture cho test script.
- Có thêm eval case hay không.

Quyết định do agent đưa ra sau vòng review của builder (người dùng chưa duyệt riêng từng mục):
- Script không ép file nào theo tên; độ phủ AC chỉ kiểm khi có `plan.md`/`tasks.md` (4.5).
- Baseline chỉ trỏ tới template khi có `_TEMPLATE/design.md`; không làm lệnh nâng cấp template cho project đã init (4.3).
- `<n>` trong `AC<n>.<m>` là số thứ tự requirement trong spec; task-breakdown dùng lại ID có sẵn (AC3.3).
- Không thêm `→ superpowers` vào description để tránh sửa validator; điều kiện D1 nằm ở phần điều kiện tiên quyết (AC3.2).
- Luồng không có superpowers giữ đầu ra như hiện tại (4.4).

## 9. Rủi ro và câu hỏi mở

- Bản superpowers mới có thể đổi header plan hoặc vị trí mặc định → template lệch. Giảm rủi ro: người dùng ghim version superpowers; script cảnh báo khi header thiếu.
- Agent có thể bỏ qua preference trong baseline → script cảnh báo ở bước verify.
- Plan cũ chưa thực thi trong `docs/superpowers/plans/` (ví dụ `2026-10-13-git-release-skill.md`, đang untracked) giữ nguyên chỗ cũ.
