# Spec: install-lifecycle

Cập nhật: 2026-10-30

## Mục đích

`aip install/uninstall/update/check` đặt nội dung đã build vào project hoặc home của người dùng mà không làm mất file của họ, và gỡ đúng những gì đã đặt.

## Phạm vi

- Gồm: `cli/lib/install.mjs`, `cli/lib/paths.mjs`, `cli/lib/managed-block.mjs`; manifest `.ai-engineering/manifest.json`; khối managed trong `AGENTS.md`/`CLAUDE.md`.
- Không gồm: sinh file ở `build/` (`projection`), `aip init`, wizard và các lệnh `stats`/`mode` (`cli-wizard`), nội dung của `core/agents/AGENTS.template.md` (`baseline`).
- Không có request nào trong `docs/requests/` đưa ra năng lực này; mọi yêu cầu dưới đây được viết lại từ code và test hiện có, nên nguồn là đường dẫn code, không phải `design.md`.

## Yêu cầu

- **install-lifecycle/R1** — Mọi lệnh nhận scope `project` (mặc định, gốc = cwd) hoặc `global` (`-g`, gốc = home); biến `AIE_INSTALL_ROOT` ghi đè gốc scope. Nguồn: `cli/lib/paths.mjs` (`scopeRoot`), `test/install.test.mjs` [Unverified: request đã đưa ra].
- **install-lifecycle/R2** — Mỗi lần cài ghi vào `<scope-root>/.ai-engineering/manifest.json` các `files[]`, `links[]` và `managed[]` của entry; `uninstall` chỉ xoá đường dẫn có trong manifest, không xoá đích của link, và dọn thư mục cha vừa rỗng. Nguồn: `cli/lib/install.mjs` (`install`, `uninstall`, `removeFileAndPruneEmpty`) [Unverified: chưa chạy uninstall thật để kiểm "không xoá đích của link"].
- **install-lifecycle/R3** — Khi đặt file, `install` không đè file đã tồn tại mà không do lần cài của chính nó đặt: file đó bị bỏ qua và báo trong danh sách skipped. Nguồn: `cli/lib/install.mjs` (`copyFileRec`).
- **install-lifecycle/R4** — Ưu tiên symlink (junction cho thư mục trên Windows); khi `aip` chạy từ trong `node_modules` thì copy thay vì link, và `update` không `git pull` (chỉ pull khi gốc có `.git` và không nằm trong `node_modules`). Nguồn: `cli/lib/install.mjs` (`linkDisabledForRoot`, `shouldGitPull`), `test/install.test.mjs`.
- **install-lifecycle/R5** — Khối baseline nằm giữa marker `<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->` và `<!-- AI-ENGINEERING:END AGENTS_BASELINE -->`; `install` chỉ viết lại vùng giữa marker, giữ nguyên phần ngoài marker, và ghi file nhận khối vào `managed[]`. Nguồn: `cli/lib/managed-block.mjs` (`mergeManagedBlock`), `test/managed-block.test.mjs`.
- **install-lifecycle/R6** — `uninstall` chỉ gỡ khối managed khỏi một file khi không entry còn lại nào trong manifest cũng quản lý file đó (đếm tham chiếu). Nguồn: `cli/lib/install.mjs` (`managedFilesToClean`).
- **install-lifecycle/R7** — Khối managed không được ghi cho provider `cursor` và `antigravity` (governance đã inline; `AGENTS.md` của antigravity là symlink vào `build/`, ghi sẽ sửa build output). Nguồn: `cli/lib/install.mjs` (`instructionFiles`, chú thích dòng 107–110).
- **install-lifecycle/R8** — `antigravity` không nằm trong `PROVIDERS` mặc định: không hiện trong wizard và không được cài khi chọn `all`; chỉ cài khi truyền tường minh `--provider antigravity`. Nguồn: `cli/lib/paths.mjs` (chú thích PENDING).
- **install-lifecycle/R9** — Workflow chỉ được cài cho `claude` và `codex` (`WORKFLOW_PROVIDERS`); khi chọn workflow, skill mà nó cần được kéo theo qua `expandWorkflowDeps`. Nguồn: `cli/lib/workflows.mjs`, `cli/lib/install.mjs` (`stripUnsupportedWorkflows`) [Unverified: phần mở rộng phụ thuộc chỉ chưa đọc thân hàm `expandWorkflowDeps`].
- **install-lifecycle/R10** — `aip check` (doctor Claude) chỉ so version với nguồn cho bản ghi `claude plugin list --json` thuộc scope đang kiểm: bản ghi có `projectPath` khác gốc của scope (project khác) bị bỏ; bản ghi scope user và bản ghi của chính gốc đó được giữ. Cảnh báo "đã cài dạng plugin" của install skills-mode dùng cùng bộ lọc. Nguồn: [2026-10-30-part-mode-trial-gaps](../../requests/2026-10-30-part-mode-trial-gaps/design.md) (thêm); test `test/contract/60-versions.contract.mjs`.

## Lịch sử

| Ngày | Request | ID | Thêm/đổi/bỏ |
|---|---|---|---|
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R1 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R2 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R3 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R4 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R5 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R6 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R7 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R8 | thêm |
| 2026-10-23 | không có request gốc (backfill từ code) | install-lifecycle/R9 | thêm |
| 2026-10-30 | [2026-10-30-part-mode-trial-gaps](../../requests/2026-10-30-part-mode-trial-gaps/design.md) | install-lifecycle/R10 | thêm |
