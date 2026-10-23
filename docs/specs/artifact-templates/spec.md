# Spec: artifact-templates

Cập nhật: 2026-10-23

## Mục đích

Một nguồn template duy nhất cho các loại artifact của bộ, cùng validator `check-request.mjs` kiểm quy ước `docs/requests/<ngày>-<slug>/` và spec sống.

## Phạm vi

- Gồm: skill core `artifact-templates` (`SKILL.md` mục lục + `references/`), `scripts/check-request.mjs`, `scripts/check-partition.mjs`, việc `aip init --full` sinh `_TEMPLATE` từ template này.
- Không gồm: nội dung từng loại artifact do skill khác viết (`engineering-*`), luật baseline về vị trí docs (`baseline`), cơ chế hook (`hooks-gates`).

## Yêu cầu

- **artifact-templates/R1** — Skill `core/skills/artifact-templates/` có `SKILL.md` làm mục lục (loại → template → validator → nguồn) và `references/` chứa template của các loại workflow, skill, agent, requirement, design, plan, task, adr, handoff, spec, project-knowledge; mỗi template mở bằng khối `<!-- artifact-template … -->` có `type`, `version`, `validator`, `sources`, và khối này bị bỏ khi chép ra dùng. Nguồn: [2026-10-20-artifact-templates](../../requests/2026-10-20-artifact-templates/design.md) (thêm); `handoff` do [2026-10-21-long-session-context](../../requests/2026-10-21-long-session-context/design.md) thêm, `spec` do [2026-10-21-living-spec](../../requests/2026-10-21-living-spec/design.md) thêm.
- **artifact-templates/R2** — Template loại có validator (skill, agent, workflow, task) qua đúng validator đó khi điền giá trị mẫu; template loại chưa có validator được pin heading và mẫu dòng bắt buộc trong `test/contract/35-artifact-templates.contract.mjs`. Nguồn: [2026-10-20-artifact-templates](../../requests/2026-10-20-artifact-templates/design.md) (thêm)
- **artifact-templates/R3** — `aip init --full` sinh `docs/requests/_TEMPLATE/{requirement,design,plan}.md`, `docs/decisions/_TEMPLATE.md`, `docs/specs/_TEMPLATE.md` và `project-knowledge/` từ `references/` (khối chú thích bị bỏ) và không ghi đè file đã có. Nguồn: [2026-10-20-artifact-templates](../../requests/2026-10-20-artifact-templates/design.md), [2026-10-21-living-spec](../../requests/2026-10-21-living-spec/design.md) (thêm)
- **artifact-templates/R4** — Quy ước AC: ID `AC<n>.<m>` dạng Given/When/Then, nằm ở đúng một nơi (`requirement.md` hoặc mục "Tiêu chí chấp nhận" của `design.md`); `plan.md` có `**Goal:**`, `**Spec:**` và mỗi task ghi `**Phủ AC:**`; `check-request.mjs` cảnh báo W1 (không có nguồn AC), W2 (AC ở cả hai file), W3 (trùng ID), W4 (sai định dạng), W5 (plan thiếu header), W6 (AC chưa task nào phủ), mỗi dòng dạng `WARN <file>:<dòng> [W<n>] …`. Nguồn: [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md) (thêm)
- **artifact-templates/R5** — `check-request.mjs` trả exit 0 khi chỉ có cảnh báo, exit 1 khi có cảnh báo và truyền `--strict`, exit 2 khi đối số sai. Nguồn: [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md) (thêm), [2026-10-20-verification-gate](../../requests/2026-10-20-verification-gate/design.md) (đổi: thêm `--strict`)
- **artifact-templates/R6** — Khi `plan.md` có `**Files:**`, `check-request.mjs` quét các file test (hoặc đường dẫn `--tests`) tìm ID AC dạng `AC1.2`/`AC1_2`/`ac1_2`: W7 khi AC không được test nhắc tới, W8 khi `plan.md` không ghi file test nào, W9 khi file test được ghi chưa tồn tại; quét đệ quy bỏ `node_modules`, `.git`, `build`, `dist`, `target`, `.venv`. Nguồn: [2026-10-20-verification-gate](../../requests/2026-10-20-verification-gate/design.md) (thêm)
- **artifact-templates/R7** — `design.md` của request đặt tên `<yyyy-mm-dd>-<slug>` từ `2026-10-21` trở đi phải có mục `## Ảnh hưởng spec` (dòng `- <năng-lực>: thêm|đổi|bỏ R<n>` hoặc `Không ảnh hưởng: <lý do>`), thiếu thì W10; thư mục cũ hoặc không đặt tên theo ngày được miễn. `check-request.mjs` cũng báo W11 (năng lực không có `docs/specs/<tên>/spec.md`), W12 (`đổi`/`bỏ` ID không tồn tại, hoặc `bỏ` mà chưa gạch ngang kèm "đã bỏ bởi"), W13 (chỉ khi có `--base <ref>`: spec không đổi so với `<ref>`), W14 (ID sai định dạng hoặc trùng, tên năng lực lệch thư mục, link request trong Lịch sử không tồn tại). Nguồn: [2026-10-21-living-spec](../../requests/2026-10-21-living-spec/design.md) (thêm)
- **artifact-templates/R8** — `check-partition.mjs` đọc các nhóm `**Song song:**` của `plan.md` và chỉ cảnh báo (exit 0): P1 khi hai task cùng nhóm có `**Files:**` giao nhau, P2 khi task song song ghi file dùng chung bị cấm (`plugins/_versions.lock.json`, `*/.manifest.json`, `docs/specs/**`, `README*.md`); không có `**Song song:**` hoặc thiếu `**Files:**` thì không cảnh báo. Nguồn: [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) (thêm)

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-23 | [2026-10-20-artifact-templates](../../requests/2026-10-20-artifact-templates/design.md) | artifact-templates/R1 | thêm |
| 2026-10-23 | [2026-10-20-artifact-templates](../../requests/2026-10-20-artifact-templates/design.md) | artifact-templates/R2 | thêm |
| 2026-10-23 | [2026-10-20-artifact-templates](../../requests/2026-10-20-artifact-templates/design.md) | artifact-templates/R3 | thêm |
| 2026-10-23 | [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md) | artifact-templates/R4 | thêm |
| 2026-10-23 | [2026-10-20-verification-gate](../../requests/2026-10-20-verification-gate/design.md) | artifact-templates/R5 | đổi |
| 2026-10-23 | [2026-10-20-verification-gate](../../requests/2026-10-20-verification-gate/design.md) | artifact-templates/R6 | thêm |
| 2026-10-23 | [2026-10-21-living-spec](../../requests/2026-10-21-living-spec/design.md) | artifact-templates/R7 | thêm |
| 2026-10-23 | [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) | artifact-templates/R8 | thêm |
