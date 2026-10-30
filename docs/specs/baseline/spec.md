# Spec: baseline

Cập nhật: 2026-10-30

## Mục đích

Baseline `AGENTS.md` (managed block) đặt quy tắc làm việc chung cho agent: nơi viết docs, kiểm chứng, quyền, song song và điều hướng model/phiên.

## Phạm vi

- Gồm: nội dung `core/agents/AGENTS.template.md` và bản sao `AGENTS.md` ở gốc repo.
- Không gồm: cách khối được ghi vào project đích (`install-lifecycle`), hook thực thi quy tắc (`hooks-gates`), validator của quy ước docs (`artifact-templates`).
- Các quy tắc chung đầu file (Priority, Rules, Comments, Testing, Language, Definition of Done) không có request trong `docs/requests/` đưa ra riêng; spec này chưa ghi chúng.

## Yêu cầu

- **baseline/R1** — `AGENTS.md` ở gốc repo giống `core/agents/AGENTS.template.md` sau chuẩn hoá xuống dòng; contract test đỏ khi lệch. Nguồn: [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md) (thêm)
- **baseline/R2** — Mục `Docs location and format` đặt spec ở `docs/requests/<yyyy-mm-dd>-<slug>/design.md` (skill `engineering-spec-writing`), plan ở `plan.md` cùng thư mục (skill `engineering-plan-writing`), request lớn có thể chia part (`design.md` có `## Bảng part`, mỗi part có plan riêng ở `parts/<nn>-<part-slug>/plan.md`, `plan.md` gốc là phần nền chung), không nhắc skill ngoài bộ aip, quy ước AC `AC<n>.<m>` Given/When/Then, mỗi AC một nơi, task ghi `**Phủ AC:**`, spec bugfix có mục `Không đổi`, test phủ AC ghi ID AC trong tên hoặc comment (Python `ac1_2`). Nguồn: [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md), [2026-10-20-verification-gate](../../requests/2026-10-20-verification-gate/design.md) (thêm); [2026-10-23-workflow-self-sufficient](../../requests/2026-10-23-workflow-self-sufficient/design.md) (đổi); [2026-10-30-request-parts-aip-workspace](../../requests/2026-10-30-request-parts-aip-workspace/design.md) (đổi)
- **baseline/R3** — Bảng bộ nhớ chia ngắn hạn (`docs/requests/<…>/` cùng ledger trong `.aip/`) và dài hạn (`project-knowledge/`, `docs/decisions/`, `docs/contracts/`, `docs/specs/`, `AGENTS.md`/`CLAUDE.md`); ledger ngắn hạn là `.aip/runs/<request>/<part>/progress.md` ở gốc repo chính (không commit, chung mọi worktree; `.sdd/progress.md` cũ trong thư mục request chỉ còn được đọc khi request chưa có `.aip/runs/<request>/`); một thay đổi đã có thư mục request thì đọc `design.md`, `plan.md` và ledger rồi làm tiếp từ task chưa có dòng `complete` (ledger part có `Part: complete` là xong) (hook `session-start` nạp đuôi ledger), không tạo thư mục hay plan mới; có bước gộp spec (cập nhật `docs/specs/<năng-lực>/spec.md` theo `Ảnh hưởng spec`, thêm dòng Lịch sử, chạy `check-request.mjs`) trước khi kết thúc nhánh (`plan-execution`). Nguồn: [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md), [2026-10-21-living-spec](../../requests/2026-10-21-living-spec/design.md) (thêm); [2026-10-23-workflow-self-sufficient](../../requests/2026-10-23-workflow-self-sufficient/design.md) (đổi); [2026-10-30-request-parts-aip-workspace](../../requests/2026-10-30-request-parts-aip-workspace/design.md) (đổi)
- **baseline/R4** — Mục `Agents in CI` nêu `claude -p` với `--permission-mode dontAsk`, `--allowedTools` tường minh, `--max-turns`, `--max-budget-usd`, `--bare`, ghim action theo SHA. Nguồn: [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) (thêm)
- **baseline/R5** — Mục `Safety` có bullet về chế độ quyền `full`: hiệu lực khi `aip-gate.json` có `mode: "full"` và phiên `bypassPermissions`, bỏ các `ask` của `settings.json` và xác nhận hook cho file bí mật trong project, ghi bị nhốt trong root (heuristic), push nhánh bảo vệ vẫn hỏi theo `fullKeep`. Nguồn: [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) (thêm)
- **baseline/R6** — Mục `Parallel agents` chỉ song song giữa part, không trong một part (task của một part chạy tuần tự); các part cùng nhóm (cột Song song của `## Bảng part`) có tập file ghi không giao nhau, lấy từ `**Files:**` của task và kiểm bằng `check-partition.mjs` (P1–P4); nhánh `worktree-<slug>-p<nn>` trong `.claude/worktrees/<slug>-p<nn>/` cắt từ đỉnh `feature/<slug>` (sau mỗi merge cắt part kế từ đỉnh mới); file dùng chung làm một lần ở phiên chính sau gộp; gộp `--no-ff` ở phiên chính; không PR cho từng agent; dọn bằng `git worktree remove`. Nguồn: [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) (thêm); [2026-10-30-request-parts-aip-workspace](../../requests/2026-10-30-request-parts-aip-workspace/design.md) (đổi)
- **baseline/R7** — Mục `Model and session routing` chọn model theo tầng việc, không đổi model của phiên đã có context, xoay phiên theo gói việc hoặc khi context vượt ngưỡng mềm (~40%) / cứng (~60%) kèm `handoff.md`, nêu chỉ người hoặc statusline đọc được % context, báo cáo dài ghi file kèm tin một dòng; số liệu có link nguồn hoặc nhãn [Unverified]/[Inference]. Nguồn: [2026-10-21-model-session-routing](../../requests/2026-10-21-model-session-routing/design.md), [2026-10-21-long-session-context](../../requests/2026-10-21-long-session-context/design.md) (thêm); ADR [0002](../../decisions/0002-model-and-session-routing.md), [0003](../../decisions/0003-long-session-context.md).
- **baseline/R8** — Mục `Workflow defaults` giữ duyệt spec/design và duyệt plan là human gate (mặc định chỉ bỏ các câu hỏi sau hai gate này) và đặt mặc định quy trình là workflow aip: yêu cầu feature → `workflow-feature`, bugfix → `workflow-bugfix`; thực thi plan đã duyệt bằng skill `plan-execution` mà không hỏi lại cách thực thi; commit từng task trên nhánh `feature/` không dừng, người duyệt diff cả nhánh trước merge/push; chạy full suite các component bị chạm trước khi kết thúc; kết thúc nhánh mặc định "Keep the branch as-is", chỉ merge hoặc push sau khi người dùng xác nhận. Nguồn: [2026-10-23-workflow-self-sufficient](../../requests/2026-10-23-workflow-self-sufficient/design.md) (thêm); ADR [0004](../../decisions/0004-aip-workflows-replace-superpowers.md).

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-23 | [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md) | baseline/R1 | thêm |
| 2026-10-23 | [2026-10-20-superpowers-docs-standard](../../requests/2026-10-20-superpowers-docs-standard/design.md) | baseline/R2 | thêm |
| 2026-10-23 | [2026-10-21-living-spec](../../requests/2026-10-21-living-spec/design.md) | baseline/R3 | thêm |
| 2026-10-23 | [2026-10-21-agent-permissions](../../requests/2026-10-21-agent-permissions/design.md) | baseline/R4 | thêm |
| 2026-10-23 | [2026-10-22-permission-modes](../../requests/2026-10-22-permission-modes/design.md) | baseline/R5 | thêm |
| 2026-10-23 | [2026-10-22-parallel-agents](../../requests/2026-10-22-parallel-agents/design.md) | baseline/R6 | thêm |
| 2026-10-23 | [2026-10-21-model-session-routing](../../requests/2026-10-21-model-session-routing/design.md) | baseline/R7 | thêm |
| 2026-10-26 | [2026-10-23-workflow-self-sufficient](../../requests/2026-10-23-workflow-self-sufficient/design.md) | baseline/R2 | đổi |
| 2026-10-26 | [2026-10-23-workflow-self-sufficient](../../requests/2026-10-23-workflow-self-sufficient/design.md) | baseline/R3 | đổi |
| 2026-10-26 | [2026-10-23-workflow-self-sufficient](../../requests/2026-10-23-workflow-self-sufficient/design.md) | baseline/R8 | thêm |
| 2026-10-30 | [2026-10-30-request-parts-aip-workspace](../../requests/2026-10-30-request-parts-aip-workspace/design.md) | baseline/R2 | đổi |
| 2026-10-30 | [2026-10-30-request-parts-aip-workspace](../../requests/2026-10-30-request-parts-aip-workspace/design.md) | baseline/R3 | đổi |
| 2026-10-30 | [2026-10-30-request-parts-aip-workspace](../../requests/2026-10-30-request-parts-aip-workspace/design.md) | baseline/R6 | đổi |
