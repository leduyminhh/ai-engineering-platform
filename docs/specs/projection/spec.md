# Spec: projection

Cập nhật: 2026-10-23

## Mục đích

Chiếu nội dung canonical (`plugins/`, `core/`, `workflows/`) thành file native của từng provider qua adapter thuần, và giữ phiên bản projected nhất quán với nội dung.

## Phạm vi

- Gồm: `cli/build.mjs`, `adapters/*/adapter.mjs`, `adapters/_shared/`, khoá `model`/`effort` của agent khi chiếu, việc ship `graph.json`, cổng phiên bản (`plugins/_versions.lock.json`).
- Không gồm: cài file đã build vào project đích (`install-lifecycle`), nội dung workflow và `graph.json` (`workflows`), hook của core (`hooks-gates`).
- Phạm vi spec: các request `docs/requests/` chỉ chạm một phần projection; R1, R6, R7 không có request gốc nên nguồn là code và test (xem chú thích từng dòng).

## Yêu cầu

- **projection/R1** — Mỗi adapter trong `adapters/<provider>/adapter.mjs` là hàm thuần `build(plugins, ctx) → fileEntry[]`; `cli/build.mjs` tự phát hiện adapter theo quy ước thư mục và là nơi duy nhất ghi file ra `build/<provider>/`. Nguồn: không có request gốc; xác minh ở `cli/build.mjs`, `adapters/` [Unverified: request đã đưa ra].
- **projection/R2** — Mọi agent nguồn khai `model` (`sonnet|opus|haiku|fable|inherit` hoặc ID `claude-*`) và `effort`; validator báo lỗi nêu tên agent khi thiếu `model`, `model` ngoài tập, `sonnet` mà `effort` khác `high`, `opus` mà `effort` khác `medium`/`high`, hoặc `inherit` mà body không nêu lý do. Nguồn: [2026-10-21-model-session-routing](../../requests/2026-10-21-model-session-routing/design.md) (thêm)
- **projection/R3** — Build Claude ghi `model` và `effort` của agent vào frontmatter; build Codex chỉ ghi `model_reasoning_effort` khi agent không có `model` hoặc là `inherit`, nên effort của tầng model Claude không sang Codex. Nguồn: [2026-10-21-model-session-routing](../../requests/2026-10-21-model-session-routing/design.md) (thêm)
- **projection/R4** — `graph.json` của workflow được chiếu byte-for-byte cạnh `SKILL.md` của workflow ở build Claude và Codex (`WORKFLOW_PROVIDERS`); Cursor và Antigravity không có. Nguồn: [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) (thêm)
- **projection/R5** — `aip build` thoát mã 1 khi `graph.json` của một workflow không hợp lệ theo `checkGraph`/`checkGraphAgainstBody`. Nguồn: [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) (thêm) [Unverified: design không có AC riêng cho mã thoát; xác minh ở `cli/build.mjs:104` và commit 4afeaa7]
- **projection/R6** — `node cli/lib/versions.mjs --lock` từ chối ghi `plugins/_versions.lock.json` khi hash build của một plugin đổi mà `version` trong `.manifest.json` chưa bump, và không ghi khi build thiếu plugin đã có trong lock; `npm test` đỏ nếu lock lệch build. Nguồn: không có request gốc; xác minh ở `cli/lib/versions.mjs` (`planLock`, `lockDecision`) và `test/contract/60-versions.contract.mjs` [Unverified: request đã đưa ra].
- **projection/R7** — Skill draft (chưa có trong `plugins/_published.json`) build vào `build/claude/drafts/<plugin>/…` thay vì cây chính, trừ khi truyền `--include-draft`. Nguồn: không có request gốc; xác minh ở `cli/build.mjs` [Unverified: request đã đưa ra; hành vi `_published.json` ở phía wizard thuộc `cli-wizard`/`install-lifecycle`, chưa kiểm].

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-23 | [2026-10-21-model-session-routing](../../requests/2026-10-21-model-session-routing/design.md) | projection/R2 | thêm |
| 2026-10-23 | [2026-10-21-model-session-routing](../../requests/2026-10-21-model-session-routing/design.md) | projection/R3 | thêm |
| 2026-10-23 | [2026-10-20-workflow-graph](../../requests/2026-10-20-workflow-graph/design.md) | projection/R4 | thêm |
| 2026-10-23 | [2026-10-23-supervisor-worker-contract](../../requests/2026-10-23-supervisor-worker-contract/design.md) | projection/R5 | thêm |
