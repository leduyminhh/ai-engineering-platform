# Spec sống theo năng lực

Mỗi năng lực của `aip` có (hoặc sẽ có) một spec sống tại `docs/specs/<tên>/spec.md`. Template: `core/skills/artifact-templates/references/spec.template.md`.

| Năng lực | Mô tả | Đường dẫn dự kiến |
|---|---|---|
| `projection` | Build, adapter, định dạng file theo provider | `docs/specs/projection/spec.md` |
| `install-lifecycle` | install/uninstall/update/check, manifest, managed block | `docs/specs/install-lifecycle/spec.md` |
| `hooks-gates` | guard-bash/files, gate-stop, session-start, `aip-gate.json` | `docs/specs/hooks-gates/spec.md` |
| `workflows` | Workflow, orchestrator, graph | `docs/specs/workflows/spec.md` |
| `artifact-templates` | Template, `check-request`, quy ước `docs/requests` | `docs/specs/artifact-templates/spec.md` |
| `baseline` | Baseline `AGENTS.md`: quy tắc, routing model/phiên | `docs/specs/baseline/spec.md` |
| `cli-wizard` | init, wizard, stats, args | `docs/specs/cli-wizard/spec.md` |

Spec sống chỉ được tạo khi một request kế tiếp chạm tới năng lực đó; không viết trước hàng loạt. Mỗi yêu cầu có ID `<năng-lực>/R<n>`, và request chạm tới năng lực khai báo ảnh hưởng ở mục `## Ảnh hưởng spec` của `design.md`. Yêu cầu bị bỏ không bị xoá mà giữ lại dạng gạch ngang (`~~…~~`), kèm liên kết tới request đã bỏ nó. Request tạo năng lực mới cũng thêm dòng tương ứng vào bảng này ở bước gộp.

`hooks-gates` là năng lực đầu tiên có spec sống, được tạo bởi request 2026-10-21-agent-permissions; `cli-wizard` là spec sống thứ hai, được tạo bởi request 2026-10-22-cost-tracking.
