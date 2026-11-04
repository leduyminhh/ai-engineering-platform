# Spec: install-lifecycle

Cập nhật: 2026-11-04

## Mục đích

`aip install/uninstall/update/check` đặt nội dung đã build vào project hoặc home của người dùng mà không làm mất file của họ, và gỡ đúng những gì đã đặt.

## Phạm vi

- Gồm: `cli/lib/install.mjs`, `cli/lib/paths.mjs`, `cli/lib/managed-block.mjs`; manifest `.ai-engineering/manifest.json`; gỡ khối baseline legacy ở file chỉ dẫn global và cảnh báo khối baseline khi `check`.
- Không gồm: sinh file ở `build/` (`projection`), `aip init`, wizard và các lệnh `stats`/`mode` (`cli-wizard`), nội dung của `core/agents/AGENTS.template.md` (`baseline`).
- Không có request nào trong `docs/requests/` đưa ra năng lực này; mọi yêu cầu dưới đây được viết lại từ code và test hiện có, nên nguồn là đường dẫn code, không phải `design.md`.

## Yêu cầu

- **install-lifecycle/R1** — Mọi lệnh nhận scope `project` (mặc định, gốc = cwd) hoặc `global` (`-g`, gốc = home); biến `AIE_INSTALL_ROOT` ghi đè gốc scope. Nguồn: `cli/lib/paths.mjs` (`scopeRoot`), `test/install.test.mjs` [Unverified: request đã đưa ra].
- **install-lifecycle/R2** — Mỗi lần cài ghi vào `<scope-root>/.ai-engineering/manifest.json` các `files[]` và `links[]` của entry (`managed[]` chỉ còn ở manifest do bản cũ ghi, xem R6); `uninstall` chỉ xoá đường dẫn có trong manifest, không xoá đích của link, và dọn thư mục cha vừa rỗng. Nguồn: `cli/lib/install.mjs` (`install`, `uninstall`, `removeFileAndPruneEmpty`) [Unverified: chưa chạy uninstall thật để kiểm "không xoá đích của link"]; [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) (đổi)
- **install-lifecycle/R3** — Khi đặt file, `install` không đè file đã tồn tại mà không do lần cài của chính nó đặt: file đó bị bỏ qua và báo trong danh sách skipped. Nguồn: `cli/lib/install.mjs` (`copyFileRec`).
- **install-lifecycle/R4** — Ưu tiên symlink (junction cho thư mục trên Windows); khi `aip` chạy từ trong `node_modules` thì copy thay vì link, và `update` không `git pull` (chỉ pull khi gốc có `.git` và không nằm trong `node_modules`). Nguồn: `cli/lib/install.mjs` (`linkDisabledForRoot`, `shouldGitPull`), `test/install.test.mjs`.
- **install-lifecycle/R5** — `install`, `uninstall` và `update` không ghi khối baseline vào file chỉ dẫn ở mọi scope. Khối nằm giữa marker `<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->` và `<!-- AI-ENGINEERING:END AGENTS_BASELINE -->`, do `aip init` ghi (`cli-wizard/R8`). Nguồn: `cli/lib/install.mjs` (không còn đường ghi khối), `cli/lib/init.mjs` (nơi ghi khối), `test/install.test.mjs`; [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) (đổi)
- **install-lifecycle/R6** — `managed[]` do bản cũ ghi chỉ được gỡ ở scope global, khi entry bị thay hoặc gỡ (`uninstallEntries`) hoặc ở nhánh `plugin-refresh` của `update`; ở project không sửa file: entry bị thay hoặc gỡ mất cả entry, entry plugin-mode qua `update` bỏ trường `managed`, entry khác giữ `managed[]` tới khi bị đụng (không đường nào đọc trường này ở project). Không còn đếm tham chiếu. Nguồn: `cli/lib/install.mjs` (`cleanLegacyManaged`, `uninstallEntries`); [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) (đổi)
- **install-lifecycle/R7** — Khi gỡ khối baseline legacy ở scope global, file chỉ dẫn là symlink/junction bị bỏ qua kèm cảnh báo và file đích không đổi byte; file có marker hỏng được giữ nguyên kèm cảnh báo, không ném. Mọi provider, kể cả `cursor` và `antigravity`, đều không nhận khối khi install (governance đã inline; `AGENTS.md` của antigravity là symlink vào `build/`, ghi sẽ sửa build output). Nguồn: `cli/lib/install.mjs` (`cleanLegacyManaged`); [2026-11-03-audit-mustfix](../../requests/2026-11-03-audit-mustfix/design.md) (đổi); [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) (đổi)
- **install-lifecycle/R8** — `antigravity` không nằm trong `PROVIDERS` mặc định: không hiện trong wizard và không được cài khi chọn `all`; chỉ cài khi truyền tường minh `--provider antigravity`. Nguồn: `cli/lib/paths.mjs` (chú thích PENDING).
- **install-lifecycle/R9** — Workflow chỉ được cài cho `claude` và `codex` (`WORKFLOW_PROVIDERS`); khi chọn workflow, skill mà nó cần được kéo theo qua `expandWorkflowDeps`. Nguồn: `cli/lib/workflows.mjs`, `cli/lib/install.mjs` (`stripUnsupportedWorkflows`) [Unverified: phần mở rộng phụ thuộc chỉ chưa đọc thân hàm `expandWorkflowDeps`].
- **install-lifecycle/R10** — `aip check` (doctor Claude) chỉ so version với nguồn cho bản ghi `claude plugin list --json` thuộc scope đang kiểm: bản ghi có `projectPath` khác gốc của scope (project khác) bị bỏ; bản ghi scope user và bản ghi của chính gốc đó được giữ. Cảnh báo "đã cài dạng plugin" của install skills-mode dùng cùng bộ lọc. Nguồn: [2026-10-30-part-mode-trial-gaps](../../requests/2026-10-30-part-mode-trial-gaps/design.md) (thêm); test `test/contract/60-versions.contract.mjs`.
- **install-lifecycle/R11** — Manifest hỏng (JSON lỗi, hoặc không có mảng `installs`) làm lệnh ném lỗi nêu manifest và giữ nguyên file, không bị coi là trống; manifest ghi qua file tạm rồi rename. `install` ghi manifest sau từng provider, nên lỗi ở provider sau không làm mất dấu provider đã xong. Nguồn: [2026-11-03-audit-mustfix](../../requests/2026-11-03-audit-mustfix/design.md) (thêm); [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) (đổi)
- **install-lifecycle/R12** — Cờ `--provider`, `--plugin`, `--skill`, `--target` thiếu giá trị (hết đối số, giá trị bắt đầu bằng `-`, hoặc dạng `=` rỗng) bị `parse` từ chối thay vì rơi về "không lọc". Nguồn: [2026-11-03-audit-mustfix](../../requests/2026-11-03-audit-mustfix/design.md) (thêm)
- **install-lifecycle/R13** — `aip check` (doctor) chỉ đọc, không ném và thoát mã 0; cảnh báo khi: file global `~/.claude/CLAUDE.md` hoặc `~/.codex/AGENTS.md` còn khối baseline (ở mọi scope; gợi ý `aip update -g`, lệnh này chỉ gỡ được khi manifest global còn entry ghi file đó trong `managed[]`, không thì xoá tay vùng giữa marker); ở scope project, `AGENTS.md` có khối khác template (so sau chuẩn hoá `\r\n`, gợi ý `aip init`), `CLAUDE.md` thiếu `@AGENTS.md` hoặc còn khối (chỉ khi `AGENTS.md` có marker và không phải link, gợi ý `aip init`); marker hỏng ở các file trên (kể cả `CLAUDE.md` khi chưa có `AGENTS.md`). Project chưa có `AGENTS.md`, hoặc `AGENTS.md` không có marker, thì không có cảnh báo nào khác. Nguồn: [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) (thêm); `test/install.test.mjs`.

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
| 2026-11-03 | [2026-11-03-audit-mustfix](../../requests/2026-11-03-audit-mustfix/design.md) | install-lifecycle/R7 | đổi |
| 2026-11-03 | [2026-11-03-audit-mustfix](../../requests/2026-11-03-audit-mustfix/design.md) | install-lifecycle/R11 | thêm |
| 2026-11-03 | [2026-11-03-audit-mustfix](../../requests/2026-11-03-audit-mustfix/design.md) | install-lifecycle/R12 | thêm |
| 2026-11-04 | [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) | install-lifecycle/R2 | đổi |
| 2026-11-04 | [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) | install-lifecycle/R5 | đổi |
| 2026-11-04 | [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) | install-lifecycle/R6 | đổi |
| 2026-11-04 | [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) | install-lifecycle/R7 | đổi |
| 2026-11-04 | [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) | install-lifecycle/R11 | đổi |
| 2026-11-04 | [2026-11-04-project-baseline-init](../../requests/2026-11-04-project-baseline-init/design.md) | install-lifecycle/R13 | thêm |
