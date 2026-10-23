# Spec sống theo năng lực

Mỗi năng lực của `aip` có một spec sống tại `docs/specs/<tên>/spec.md`. Template: `core/skills/artifact-templates/references/spec.template.md`.

| Năng lực | Mô tả | Spec |
|---|---|---|
| `projection` | Build, adapter, định dạng file theo provider | [`docs/specs/projection/spec.md`](projection/spec.md) |
| `install-lifecycle` | install/uninstall/update/check, manifest, managed block | [`docs/specs/install-lifecycle/spec.md`](install-lifecycle/spec.md) |
| `hooks-gates` | guard-bash/files, gate-stop, session-start, `aip-gate.json` | [`docs/specs/hooks-gates/spec.md`](hooks-gates/spec.md) |
| `workflows` | Workflow, orchestrator, graph | [`docs/specs/workflows/spec.md`](workflows/spec.md) |
| `artifact-templates` | Template, `check-request`, quy ước `docs/requests` | [`docs/specs/artifact-templates/spec.md`](artifact-templates/spec.md) |
| `baseline` | Baseline `AGENTS.md`: quy tắc, routing model/phiên | [`docs/specs/baseline/spec.md`](baseline/spec.md) |
| `cli-wizard` | init, wizard, stats, args | [`docs/specs/cli-wizard/spec.md`](cli-wizard/spec.md) |

Spec sống tạo dần: request chạm tới một năng lực thì cập nhật spec của nó ở bước gộp (tạo mới nếu năng lực chưa có). Mỗi yêu cầu có ID `<năng-lực>/R<n>`, và request chạm tới năng lực khai báo ảnh hưởng ở mục `## Ảnh hưởng spec` của `design.md`. Yêu cầu bị bỏ không bị xoá mà giữ lại dạng gạch ngang (`~~…~~`), kèm liên kết tới request đã bỏ nó. Request tạo năng lực mới cũng thêm dòng tương ứng vào bảng này ở bước gộp.

Backfill 2026-10-23: `projection`, `install-lifecycle`, `artifact-templates`, `baseline` được viết lại từ các `design.md` đã merge và từ code; `workflows` được mở rộng thêm graph. Yêu cầu không có request gốc (`install-lifecycle`, một phần `projection`) ghi nguồn là đường dẫn code và nhãn [Unverified] khi chưa kiểm. Spec `hooks-gates` chưa phủ `guard-bash`/`guard-files`/`gate-stop`/`session-start` ngoài các request đã nêu trong spec đó, và `cli-wizard` chưa phủ `aip init`/wizard/`args`.
