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
| workflow | [workflow.template.md](references/workflow.template.md) | `cli/lib/workflows.mjs` → `checkWorkflowBody`, `missingAnchors` | Anthropic building effective agents (workflow patterns); LangGraph interrupt (checkpoint người duyệt) |
| skill | [skill.template.md](references/skill.template.md) | `cli/lib/conventions.mjs` → `checkSkillBody`, `checkDescription`, `checkDescriptionStyle`, `checkSourceKeys` | Anthropic skill best practices; agentskills.io |
| agent | [agent.template.md](references/agent.template.md) | `cli/lib/conventions.mjs` → `checkAgentTools`, `checkAgentDescription` | Claude Code subagents; GitHub agents.md (2025-11) |
| requirement | [requirement.template.md](references/requirement.template.md) | chưa có | EARS (Mavin et al. 2009); Gherkin Given-When-Then; docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2 |
| design | [design.template.md](references/design.template.md) | chưa có | superpowers:brainstorming (design doc); docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2 |
| plan | [plan.template.md](references/plan.template.md) | chưa có | superpowers:writing-plans (header bắt buộc); docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2 |
| adr | [adr.template.md](references/adr.template.md) | chưa có | MADR 4.0.0 (adr.github.io/madr); Nygard 2011 (Documenting Architecture Decisions) |
| project-knowledge | [project-knowledge/](references/project-knowledge/) | chưa có | Chuyển nguyên từ templates/init/project-knowledge (giữ nội dung); tech-stack.yml không có khối header |

Cột Validator ghi `chưa có` khi loại đó chưa có kiểm tra máy; khi đó chỉ đối chiếu heading và mẫu dòng của template.
Dòng có Template là thư mục (`project-knowledge/`): mỗi file `.md` bên trong có khối header riêng; `tech-stack.yml` là YAML
nên không có khối header, nguồn của nó ghi ở cột Nguồn.

## Quy trình

1. **Chọn loại artifact** theo cột Loại của mục lục. Loại chưa có trong mục lục → dừng, báo thiếu template, không
   tự suy ra khung.
2. **Mở template** đúng file trong cột Template; chỉ nạp file của loại đang cần.
3. **Điền** placeholder `<…>` bằng nội dung thật. Giữ nguyên tên heading, tên trường và thứ tự mà validator đọc.
4. **Chạy validator** ở cột Validator nếu có; lỗi → sửa nội dung rồi chạy lại tới khi sạch. Validator `chưa có` →
   tự đối chiếu heading với template và nói rõ chưa kiểm bằng máy.
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
- Validator của loại đó đã chạy và sạch, hoặc đã ghi rõ loại đó chưa có validator.
- Frontmatter (nếu có) vẫn ở dòng 1 và đọc được.

## Bản đồ tài liệu

- [references/workflow.template.md](references/workflow.template.md): khung workflow 8 trường mỗi bước, checkpoint,
  rollback, Definition of Done, `workflow_result`.
- [references/skill.template.md](references/skill.template.md): khung SKILL.md (frontmatter, checklist quy trình, vòng
  validate → sửa, ranh giới an toàn, Verification, bản đồ tài liệu).
- [references/agent.template.md](references/agent.template.md): khung agent (frontmatter `tools`/`writeScope`, Phạm vi 3 tầng,
  `Khi được gọi:` + bước kiểm chứng, bảng Report trả về).
- [references/requirement.template.md](references/requirement.template.md): khung requirement (4 heading gốc, câu
  `Hệ thống PHẢI`, AC Given/When/Then, mục `Không đổi (bugfix)`).
- [references/design.template.md](references/design.template.md): khung design (vấn đề, quyết định, thiết kế, ngoài
  phạm vi, kiểm thử, để builder quyết, rủi ro).
- [references/plan.template.md](references/plan.template.md): khung plan (header bắt buộc của `superpowers:writing-plans`,
  `**Requirement:**`, `**Phủ AC:**` theo Task).
- [references/adr.template.md](references/adr.template.md): khung ADR theo MADR 4.0 tiếng Việt (metadata `Trạng thái`/`Ngày`/
  `Người quyết định`, bối cảnh, yếu tố quyết định, phương án, kết quả + hệ quả + xác nhận, ưu nhược từng phương án).
- [references/project-knowledge/](references/project-knowledge/): 5 khung `.md` (`project-overview`, `domain-context`,
  `architecture`, `source-structure`, `code-convention`) và `tech-stack.yml` (không có header) cho `project-knowledge/`.
