# Spec sống theo năng lực

Điểm vào để biết `aip` **đang có** gì. Mỗi năng lực có một spec sống tại `docs/specs/<tên>/spec.md`. Template: `core/skills/artifact-templates/references/spec.template.md`.

| Năng lực | Mô tả | Spec |
|---|---|---|
| `projection` | Build, adapter, định dạng file theo provider | [`docs/specs/projection/spec.md`](projection/spec.md) |
| `install-lifecycle` | install/uninstall/update/check, manifest, gỡ khối baseline legacy, cảnh báo check | [`docs/specs/install-lifecycle/spec.md`](install-lifecycle/spec.md) |
| `hooks-gates` | guard-bash/files, gate-stop, session-start, `aip-gate.json` | [`docs/specs/hooks-gates/spec.md`](hooks-gates/spec.md) |
| `workflows` | Workflow, orchestrator, graph | [`docs/specs/workflows/spec.md`](workflows/spec.md) |
| `artifact-templates` | Template, `check-request`, quy ước `docs/requests` | [`docs/specs/artifact-templates/spec.md`](artifact-templates/spec.md) |
| `baseline` | Baseline `AGENTS.md`: quy tắc, routing model/phiên | [`docs/specs/baseline/spec.md`](baseline/spec.md) |
| `cli-wizard` | init, wizard, stats, args | [`docs/specs/cli-wizard/spec.md`](cli-wizard/spec.md) |
| `skill-quality` | Đo routing skill tất định, case eval phải im lặng | [`docs/specs/skill-quality/spec.md`](skill-quality/spec.md) |

Spec sống tạo dần: request chạm tới một năng lực thì cập nhật spec của nó ở bước gộp (tạo mới nếu năng lực chưa có). Mỗi yêu cầu có ID `<năng-lực>/R<n>`, và request chạm tới năng lực khai báo ảnh hưởng ở mục `## Ảnh hưởng spec` của `design.md`. Yêu cầu bị bỏ không bị xoá mà giữ lại dạng gạch ngang (`~~…~~`), kèm liên kết tới request đã bỏ nó. Request tạo năng lực mới cũng thêm dòng tương ứng vào bảng này ở bước gộp.

Lịch sử: backfill tay 2026-10-23 dựng `projection`, `install-lifecycle`, `artifact-templates`, `baseline` từ `design.md` đã merge và code; `hooks-gates` chưa phủ `guard-bash`/`guard-files`/`gate-stop`/`session-start` ngoài các request đã nêu trong spec đó, `cli-wizard` chưa phủ wizard/`args`. Phần còn thiếu đối chiếu được bằng skill `engineering-spec-backfill` (chạy lại trên repo đã có spec chỉ báo lệch).

## Bản đồ docs

| Câu hỏi | Nơi trả lời |
|---|---|
| Hệ thống làm gì | `docs/specs/` (file này và spec từng năng lực) |
| Cấu trúc ra sao | `CLAUDE.md` mục Architecture (repo chưa có ARD hay `project-knowledge/`) |
| Vì sao chọn như vậy | `docs/decisions/` (ADR) |
| Các phần giao tiếp thế nào | chưa có `docs/contracts/`; định dạng file chiếu ra provider nằm ở spec `projection` |
| Chạy và vận hành | `README.md` / `README_VI.md` (lệnh `aip`), `CLAUDE.md` mục Commands |
| Đang làm dở | lệnh `aip status --requests` (request trong `docs/requests/` chưa `merged`/`abandoned`) |
