---
name: artifact-templates
description: "Cấp template chuẩn cho artifact của bộ, kèm validator và nguồn tham chiếu của từng loại; mục lục nằm trong skill này. Dùng khi người dùng muốn \"lấy template artifact\", \"mẫu workflow chuẩn\", \"tạo khung từ template\", \"chuẩn hóa cấu trúc artifact\". Không dùng khi cần soạn nội dung spec yêu cầu → engineering-spec-writing; ghi quyết định kiến trúc → engineering-adr."
order: 4
title: "Artifact Templates — template chuẩn cho các loại artifact (dùng chung)"
runsIn: plan
invoke: per-request
---

# Artifact Templates (skill dùng chung)

Một nguồn duy nhất cho khung của các loại artifact trong bộ. `SKILL.md` là mục lục; mỗi loại có một file
`references/<loại>.template.md` mở đầu bằng khối `<!-- artifact-template … -->` ghi `type`, `version`, `validator`
và `sources`. Skill chỉ cấp khung và chỉ đường tới validator; nội dung artifact do người dùng hoặc skill gọi nó viết.

## Mục lục template

| Loại | Template | Validator | Nguồn |
|---|---|---|---|
| workflow | [workflow.template.md](references/workflow.template.md) + [workflow.graph.template.json](references/workflow.graph.template.json) | `cli/lib/workflows.mjs` → `checkWorkflowBody`, `missingAnchors` (chỉ có trong repo aip) | Anthropic building effective agents (workflow patterns); LangGraph interrupt (checkpoint người duyệt) |
| skill | [skill.template.md](references/skill.template.md) | `cli/lib/conventions.mjs` → `checkSkillBody`, `checkDescription`, `checkDescriptionStyle`, `checkSourceKeys` (chỉ có trong repo aip) | Anthropic skill best practices; agentskills.io |
| agent | [agent.template.md](references/agent.template.md) | `cli/lib/conventions.mjs` → `checkAgentTools`, `checkAgentDescription` (chỉ có trong repo aip) | Claude Code subagents; GitHub agents.md (2025-11) |
| requirement | [requirement.template.md](references/requirement.template.md) | `scripts/check-request.mjs` | EARS (Mavin et al. 2009); Gherkin Given-When-Then; docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2; docs/requests/2026-10-23-workflow-self-sufficient/design.md (R7) |
| design | [design.template.md](references/design.template.md) | `scripts/check-request.mjs` | docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2; docs/requests/2026-10-23-workflow-self-sufficient/design.md (R7) |
| plan | [plan.template.md](references/plan.template.md) | `scripts/check-request.mjs` | skill core plan-execution (header trỏ cách thực thi plan); docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2; docs/requests/2026-10-23-workflow-self-sufficient/design.md (R7) |
| task | [task.template.md](references/task.template.md) | `check-tasks.mjs` của `engineering-task-breakdown` (chỉ có khi cài plugin `engineering`) | Spec Kit tasks.md; Kiro tasks.md; check-tasks.mjs hiện có |
| adr | [adr.template.md](references/adr.template.md) | chưa có | MADR 4.0.0 (adr.github.io/madr); Nygard 2011 (Documenting Architecture Decisions) |
| handoff | [handoff.template.md](references/handoff.template.md) | chưa có | docs/requests/2026-10-21-long-session-context/design.md (D4); Claude Code prompt-caching (session rotation) |
| spec | [spec.template.md](references/spec.template.md) | `scripts/check-request.mjs` | docs/requests/2026-10-21-living-spec/design.md (P7); Kiro specs; GitHub Spec Kit; Thoughtworks Technology Radar "spec-anchored" |
| project-knowledge | [project-knowledge/](references/project-knowledge/) | chưa có | Chuyển nguyên từ templates/init/project-knowledge (giữ nội dung); tech-stack.yml không có khối header |

Cột Validator ghi `chưa có` khi loại đó chưa có kiểm tra máy; khi đó chỉ đối chiếu heading và mẫu dòng của template.
Validator ghi `chỉ có trong repo aip` hoặc `chỉ có khi cài plugin …` thì chỉ chạy được khi file đó tồn tại; không có thì áp
dòng trên.
Validator `scripts/check-request.mjs` (requirement, design, plan, và spec sống qua mục `Ảnh hưởng spec`) nằm ngay trong skill này nên có ở mọi project đã cài core;
chạy `node <thư-mục-skill>/scripts/check-request.mjs <docs/requests/ngày-slug> [--tests <path>…] [--base <ref>] [--strict]` — chỉ cảnh báo, exit 0 khi chạy được, exit 2 khi sai đối số; `--strict` đổi thành exit 1 nếu còn cảnh báo.
`scripts/check-partition.mjs <thư-mục-request> [--strict]` cảnh báo giữa các part cùng nhãn ở cột Song song của `## Bảng part`: P1 ghi trùng file, P2 ghi file chung, P4 `Consumes` (tên trong backtick) thứ part cùng nhóm `Produces`; P3 khi plan còn `**Song song:**` cấp task (đã bỏ). Tập file của part = hợp `**Files:**` mọi task của part. Chọn tham gia: không có Bảng part và không có `**Song song:**` thì im.
Request chia part (`design.md` gốc có `## Bảng part`, mỗi part một `parts/<nn>-<part-slug>/plan.md`): `check-request.mjs` kiểm W5/W8/W9/W16/W17/W18 cho từng plan part (cảnh báo nêu đúng `parts/<nn>-<part-slug>/plan.md`), W6/W7 tính trên hợp các plan và `tasks.md`; mới: W19 Bảng part lệch (part không có `plan.md`, thư mục `parts/<x>/` ngoài bảng, Phụ thuộc trỏ part không có hoặc tự phụ thuộc, tên trùng hoặc sai định dạng, Trạng thái ngoài `chưa làm | đang làm | merged <hash> | bỏ`), W20 AC xuất hiện trong `parts/*/design.md`, W21 dòng `**TDD:**` sai (không phải `có` hoặc `không — <lý do>`, hoặc `có` với kind ngoài `BE`/`TOOLING`). Request không có `parts/`, Bảng part và `**TDD:**` thì không có W19–W21.
W7: AC chưa có file test nào nhắc tới (ID `AC<n>.<m>`, `ac<n>_<m>` hoặc `Ac<n>_<m>` trong nội dung file). Phạm vi test là các file test ghi trong `**Files:**` của plan.md (dòng `- Test:` hoặc đường dẫn kiểu `test/`, `*.test.*`, `*_test.*`); W8: plan có `**Files:**` nhưng không ghi file test nào; W9: file test ghi trong plan chưa tồn tại. Plan không có `**Files:**` thì bỏ qua W7–W9. Ngay sau khi lập plan, các file test chưa được viết nên W9 là bình thường và W7 được bỏ qua (khi không đọc được file test nào của plan); không xoá `**Files:**` hay mục test để cho im. Chạy lại sau khi test đã viết xong; `--strict` trong CI chỉ dùng từ lúc đó.
`--tests <path>…` (file hoặc thư mục, quét đệ quy, bỏ `node_modules`, `.git`, `build`, `dist`, `target`, `.venv`) thay phạm vi lấy từ plan.
W10–W14 kiểm spec sống (`docs/specs/<năng-lực>/spec.md`): W10 design thiếu hoặc rỗng mục `## Ảnh hưởng spec` (chỉ với thư mục request tên `<yyyy-mm-dd>-<slug>` có ngày từ 2026-10-21 trở đi; thư mục cũ hơn hoặc không có tiền tố ngày được miễn); W11 tên năng lực không hợp lệ hoặc spec không tồn tại; W12 ID `<năng-lực>/R<n>` không có trong spec, hoặc `bỏ` mà dòng chưa gạch `~~` kèm `đã bỏ bởi`; W13 (chỉ với `--base <ref>`) spec bị ảnh hưởng không đổi so với ref; W14 cấu trúc/liên kết của spec sai. W15–W16 kiểm dòng `- Trạng thái:` của design.md (chỉ khi có dòng này): W15 token đầu không thuộc `draft | approved | in-progress | merged | abandoned`; W16 request `merged`/`abandoned` còn `plan.md`. Vẫn chỉ cảnh báo.
Dòng có Template là thư mục (`project-knowledge/`): mỗi file `.md` bên trong có khối header riêng; `tech-stack.yml` là YAML
nên không có khối header, nguồn của nó ghi ở cột Nguồn.

## Quy trình

1. **Chọn loại artifact** theo cột Loại của mục lục. Loại chưa có trong mục lục → dừng, báo thiếu template, không
   tự suy ra khung.
2. **Mở template** đúng file trong cột Template; chỉ nạp file của loại đang cần.
3. **Điền** placeholder `<…>` bằng nội dung thật. Giữ nguyên tên heading, tên trường và thứ tự mà validator đọc.
4. **Chạy validator** ở cột Validator nếu có (requirement/design/plan: `node <thư mục skill artifact-templates>/scripts/check-request.mjs <thư-mục-request> [--tests <path>…] [--base <ref>] [--strict]`,
   thư mục là `docs/requests/<ngày>-<slug>/`); lỗi → sửa nội dung rồi chạy lại. Với W7/W9 do file test chưa tồn tại (lúc mới lập plan) thì giữ nguyên `**Files:**` và chạy lại sau khi viết test, không xoá mục để cho sạch. Validator `chưa có`, hoặc
   validator `chỉ có trong repo aip` mà project hiện tại không có file đó → bỏ qua bước chạy, tự đối chiếu heading và
   mẫu dòng với template, và nói rõ chưa kiểm bằng máy.
5. **Bỏ khối `<!-- artifact-template … -->`** khỏi bản đã điền; frontmatter (nếu có) giữ nguyên ở dòng 1.

Khối header nằm ngay sau frontmatter nếu template có frontmatter, ngược lại nằm ở đầu file.

## Ranh giới an toàn

- Không sửa file template để vừa với một artifact cụ thể; muốn đổi khung thì đổi template, tăng `version` trong
  header và cập nhật mục lục.
- Không chép khối header sang artifact đã điền.
- Không ghi đè file đích đã có; file đã tồn tại thì báo và để người dùng quyết định.
- Không nới hoặc bỏ validator để template "qua"; template không qua validator của chính nó là lỗi của template.

## Verification (trước khi báo hoàn thành)

- Artifact đã điền không còn placeholder `<…>` và không còn khối `artifact-template`.
- Validator của loại đó đã chạy và sạch, hoặc đã ghi rõ loại đó chưa có validator hoặc validator không có trong project này.
- Frontmatter (nếu có) vẫn ở dòng 1 và đọc được.

## Bản đồ tài liệu

- [references/workflow.template.md](references/workflow.template.md): khung workflow 8 trường mỗi bước, checkpoint,
  rollback, Definition of Done, `workflow_result`.
- [references/workflow.graph.template.json](references/workflow.graph.template.json): khung `graph.json` 2 bước đi kèm workflow
  (luồng máy đọc được: `next`, `on_fail`, gate human); sao thành `workflows/<slug>/graph.json`.
  Nghĩa schema v1 (đi kèm plugin, không cần đọc spec của repo aip): `done` = hoàn thành; `blocked` = dừng và báo người dùng;
  `ask_user` = hỏi người dùng rồi chạy lại chính bước đó hoặc bước người dùng chỉ định; `when` = điều kiện dạng văn bản
  (không phải biểu thức); `after` = id phải xong trước trong cùng bước; `on_fail` không bao giờ trỏ `done`.
- [references/skill.template.md](references/skill.template.md): khung SKILL.md (frontmatter, checklist quy trình, vòng
  validate → sửa, ranh giới an toàn, Verification, bản đồ tài liệu).
- [references/agent.template.md](references/agent.template.md): khung agent (frontmatter `tools`/`writeScope`, Phạm vi 3 tầng,
  `Khi được gọi:` + bước kiểm chứng, bảng Report trả về).
- [references/requirement.template.md](references/requirement.template.md): khung requirement (4 heading gốc, câu
  `Hệ thống PHẢI`, AC Given/When/Then, mục `Không đổi (bugfix)`).
- [references/design.template.md](references/design.template.md): khung design (vấn đề, quyết định, thiết kế, `## Bảng part` tuỳ chọn, ngoài
  phạm vi, kiểm thử, để builder quyết, rủi ro).
- [references/plan.template.md](references/plan.template.md): khung plan (header "For agentic workers" trỏ skill `plan-execution`,
  `**Requirement:**`, `**Phủ AC:**` theo Task).
- [references/task.template.md](references/task.template.md): khung `tasks.md` chung (Use case, Bảng tổng task, Chi tiết task với
  header task, Câu hỏi mở); phụ lục có 6 loại task, quy ước ID `UC<nn>-<loại>-<nn>`, mục `CT`/`DB`/`E2E`, quy tắc điền.
  Template chi tiết BE (B1–B10) và FE (F1–F9) ở skill `engineering-task-breakdown`.
- [references/adr.template.md](references/adr.template.md): khung ADR theo MADR 4.0 tiếng Việt (metadata `Trạng thái`/`Ngày`/
  `Người quyết định`, bối cảnh, yếu tố quyết định, phương án, kết quả + hệ quả + xác nhận, ưu nhược từng phương án).
- [references/handoff.template.md](references/handoff.template.md): khung bàn giao phiên (nhánh + HEAD, đã xong, đang dở, bước kế, câu hỏi chờ, ràng buộc, run-log, context từng phiên) cho việc xoay phiên không kế thừa hội thoại.
- [references/spec.template.md](references/spec.template.md): khung spec sống theo năng lực (`docs/specs/<năng-lực>/spec.md`: mục đích, phạm vi, yêu cầu `<năng-lực>/R<n>` kèm dòng yêu cầu bị bỏ, lịch sử).
- [references/project-knowledge/](references/project-knowledge/): 5 khung `.md` (`project-overview`, `domain-context`,
  `architecture`, `source-structure`, `code-convention`) và `tech-stack.yml` (không có header) cho `project-knowledge/`.
- [scripts/check-request.mjs](scripts/check-request.mjs): validator cho requirement/design/plan; kiểm thư mục request (nguồn AC,
  ID AC, `**Goal:**`/`**Spec:**` của plan, độ phủ AC bởi plan.md/tasks.md, AC chưa có test nhắc tới W7–W9, ảnh hưởng spec W10–W14, `--base <ref>`), mỗi lỗi một dòng `WARN <file>:<dòng> [<mã>] …`; `--strict` → exit 1 khi có cảnh báo.
- [scripts/check-partition.mjs](scripts/check-partition.mjs): `<thư-mục-request> [--strict]` cảnh báo P1/P2/P4 giữa các part cùng nhãn Song song của Bảng part, P3 khi còn `**Song song:**` cấp task; chọn tham gia, không có Bảng part thì im.
