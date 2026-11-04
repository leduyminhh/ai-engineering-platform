# Thiết kế: khối baseline thuộc `aip init` ở project, bỏ khỏi `aip install`
- Ngày: 2026-11-04
- Trạng thái: approved (G1 2026-11-04, nhánh feature/project-baseline-init)
- Requirement: không có
## Vấn đề và lý do
Hôm nay `aip install` ghi khối baseline (vùng `<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->`..`END`, trích từ `core/agents/AGENTS.template.md`) vào hai nơi: file global (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`) khi cài `-g`, và `AGENTS.md`/`CLAUDE.md` của project khi cài ở scope project. `aip init` chỉ chép nguyên template thành `AGENTS.md` khi file chưa có và không bao giờ ghi đè (`cli/lib/init.mjs`), nên một project đã init không có cách nào làm mới khối khi template đổi.

Hệ quả đo được (số đo do session chính cung cấp trên máy người dùng, [Unverified] — chưa tự kiểm trong request này): 3 project có `AGENTS.md` đã commit, import qua `@AGENTS.md`, giữ khối baseline cũ khoảng 318 dòng trong khi `~/.claude/CLAUDE.md` có khối mới 200 dòng (kết quả của request `2026-11-03-baseline-slim`). Docs Claude Code ([memory](https://code.claude.com/docs/en/memory), đọc 2026-11-04): `~/.claude/CLAUDE.md` là "Personal preferences for all projects" và "All discovered files are concatenated into context rather than overriding each other"; nên một phiên trong project đó nạp cả hai khối, `calc: 318 + 200 = 518` dòng baseline. Docs Codex ([AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md), đọc 2026-11-04): file global ở Codex home được nạp trước file project, dừng khi tổng chạm `project_doc_max_bytes` (mặc định 32 KiB), nên khối nhân đôi ăn vào ngân sách đó.

Ba chỗ trong code là gốc của vấn đề (đã đọc):
1. `cli/lib/install.mjs` `instructionFiles` / `applyManagedBlock`: cả plugin-mode (khoảng dòng 776) lẫn skills-mode (khoảng dòng 808) đều ghi khối, nên global và project cùng có khối.
2. `cli/lib/init.mjs`: `if (fs.existsSync(dest)) { skipped.push(rel); continue; }` áp cho cả `AGENTS.md`; chỉ cảnh báo khi `CLAUDE.md` có sẵn thiếu `@AGENTS.md`.
3. `check()` (khoảng dòng 900 của `install.mjs`) không xem khối baseline nào, nên khối cũ hoặc nạp trùng không lộ ra.

## Quyết định đã chốt
Người dùng chốt (session chính, 2026-11-04), không bàn lại:
1. **Bỏ khối khỏi global.** `aip install -g` (claude và codex) không ghi khối; lần cài lại hoặc `aip update -g` gỡ khối đang có ở `~/.claude/CLAUDE.md` / `~/.codex/AGENTS.md` mà manifest cũ đã ghi trong `managed[]`. Project chưa init thì không có baseline (chấp nhận).
2. **Làm mới bằng chạy lại `aip init`.** Init idempotent: chưa có `AGENTS.md` thì tạo từ template; đã có thì chỉ thay vùng BEGIN..END bằng khối của template hiện tại (chưa có marker thì append khối), giữ nguyên mọi thứ ngoài marker; các file khác của init vẫn không ghi đè.
3. **Khối luôn nằm ở `AGENTS.md`**; `CLAUDE.md` có `@AGENTS.md`: init tạo `CLAUDE.md` như hiện tại hoặc, nếu `CLAUDE.md` có sẵn thiếu import, chèn dòng `@AGENTS.md` ở đầu file.
4. **`aip install`/`uninstall` ở scope project không ghi/gỡ khối nữa**; khối thuộc init. Uninstall không gỡ khối do init ghi.

Hướng đã cân nhắc và bị loại:

| Hướng | Nội dung | Đánh đổi | Kết luận |
|---|---|---|---|
| A. Một khối ở project do init sở hữu, bỏ global | Quyết định 1–4 ở trên | Phải chạy lại `aip init` ở từng project để làm mới; project chưa init không có baseline | **Chọn** (người dùng chốt) |
| B. Tách template thành khối team (repo) + khối aip runtime (global) | Hai khối, hai nơi ghi | Phức tạp hơn: hai template, hai marker, hai vòng đời; vẫn nạp từ hai nơi | Loại (người dùng chọn đơn giản hơn: một khối ở project) |
| C. `aip update -g` quét registry các project đã init và làm mới hàng loạt | Cần registry project ở home, ghi vào nhiều repo một lúc | Ghi ngoài cwd, vào repo người dùng không nhắc tới; phải xử lý repo đã xoá, repo có thay đổi chưa commit | Loại (người dùng chọn chạy lại init) |
| D. Giữ global làm opt-in `--global-baseline` | Cờ bật khối global | Giữ lại đường nạp trùng và toàn bộ mã `managed[]` của install | Loại (người dùng chọn bỏ hẳn) |
| E. Làm mới qua cờ riêng `aip init --refresh`, init mặc định vẫn không đụng file có sẵn (hướng do agent thêm) | Hai chế độ của init | Người dùng phải biết cờ mới; chạy init không cờ trên project cũ vẫn để khối cũ | Loại (quyết định của agent: người dùng đã chọn init idempotent mặc định) |

**Quyết định của agent** (người dùng duyệt ở bước duyệt design):
1. **Dọn khối khỏi `CLAUDE.md`.** `CLAUDE.md` của project đang chứa khối baseline (install cũ ghi vào `CLAUDE.md` khi chưa import `AGENTS.md`) → init gỡ khối khỏi `CLAUDE.md` khi `@AGENTS.md` đã có ở đó, để không nạp hai lần. Chỉ làm khi `AGENTS.md` được init xử lý (không phải symlink/junction); ngược lại giữ `CLAUDE.md` nguyên và cảnh báo, vì gỡ khối khi `AGENTS.md` không chắc chứa khối thì mất baseline.
2. **Manifest cũ có `managed[]`.** Scope global: gỡ khối khỏi mọi file trong `managed[]` khi entry bị thay hoặc gỡ (kể cả nhánh `plugin-refresh` của `update`, không đi qua `uninstallEntries`), bỏ đếm tham chiếu vì không entry mới nào còn ghi `managed[]`. Scope project: bỏ qua `managed[]`, KHÔNG sửa file (init đã sở hữu khối). Entry còn lại sau `update` không giữ `managed[]` cũ.
3. **Fail loud khi marker hỏng.** `AGENTS.md` có marker hỏng (BEGIN không có END, hoặc END đứng trước BEGIN) → init ném lỗi nêu tên file, tính toàn bộ kế hoạch trước và không ghi gì. `CLAUDE.md` có marker hỏng thì không ném: giữ nguyên phần khối và cảnh báo (file này chỉ cần import, không cần khối).
4. **Symlink/junction.** `AGENTS.md` hoặc `CLAUDE.md` là symlink/junction → init bỏ qua file đó kèm cảnh báo (như `applyManagedBlock` hiện tại); gỡ khối global gặp file chỉ dẫn là link cũng bỏ qua kèm cảnh báo.
5. **`aip check` cảnh báo, chỉ đọc, thoát mã 0.** (a) Ở mọi scope: `~/.claude/CLAUDE.md` hoặc `~/.codex/AGENTS.md` (gốc `scopeRoot('global')`) còn khối baseline → nạp trùng, gợi ý `aip update -g` (mọi scope vì nạp trùng ảnh hưởng phiên project). (b) Scope project: `AGENTS.md` có khối khác template (so sau chuẩn hoá `\r\n`) → "cũ, chạy `aip init`"; `CLAUDE.md` có sẵn mà thiếu `@AGENTS.md`, hoặc còn chứa khối → gợi ý `aip init`; marker hỏng → báo, không ném. Project chưa có `AGENTS.md`, hoặc `AGENTS.md` không có marker: không cảnh báo (theo quyết định 1). Chỉ chạy khi `doctor: true` (đường CLI `aip check`), không chạy trong lời gọi `check()` của wizard.
6. **Kết quả init phân biệt bốn trạng thái:** `created` (file ghi mới), `refreshed` (file có sẵn bị ghi lại nội dung: khối `AGENTS.md`, import hoặc gỡ khối ở `CLAUDE.md`), `unchanged` (file có sẵn, đã đúng, không ghi byte nào), `skipped` (file có sẵn không được đụng: file khác của init, symlink/junction). `AGENTS.md` và `CLAUDE.md` không còn vào `skipped` trừ khi là link.
7. **Vị trí mã.** Trích khối từ template dùng chung cho init, `check` và (nếu còn cần) dọn global: đưa `baselineBlock()` ra khỏi `install.mjs` thành hàm thuần ở `managed-block.mjs` nhận nội dung template. `instructionFiles`, `planManagedBlock`, `applyManagedBlock` bị xoá khỏi `install.mjs`; `cleanManagedBlock` giữ cho dọn legacy ở scope global.

## Tiêu chí chấp nhận
Mọi ca dùng sandbox riêng (`AIE_INSTALL_ROOT`, thư mục tạm); không `rm -rf` sandbox có junction, dọn bằng `fs.rmSync`.

**Init idempotent (R1).**
- [ ] **AC1.1** — Given thư mục không có `AGENTS.md` và `CLAUDE.md` When `init({root})` Then `AGENTS.md` tạo từ `core/agents/AGENTS.template.md` nguyên văn (kể cả preamble trước BEGIN), `CLAUDE.md` tạo từ `templates/init-minimal`, và kết quả có cả hai trong `created`.
- [ ] **AC1.2** — Given `AGENTS.md` có nội dung của người dùng ở trước và sau cặp marker, vùng giữa marker khác template When `init` Then vùng BEGIN..END bằng khối của template hiện tại, mọi byte ngoài marker không đổi, kết quả có `AGENTS.md` trong `refreshed`.
- [ ] **AC1.3** — Given `AGENTS.md` đã có khối bằng template (so sau chuẩn hoá `\r\n`) When `init` chạy lần hai Then nội dung file không đổi byte, không ghi file, kết quả có `AGENTS.md` trong `unchanged` và không có trong `refreshed`.
- [ ] **AC1.4** — Given `AGENTS.md` có nội dung nhưng không có marker nào When `init` Then khối template được nối sau nội dung cũ (cách bằng một dòng trống), phần cũ giữ nguyên, kết quả `refreshed`.
- [ ] **AC1.5** — Given `AGENTS.md` có marker hỏng (BEGIN không END, hoặc END trước BEGIN) When `init` (kể cả `--full`) Then ném lỗi nêu `AGENTS.md`, và không file nào được tạo hay ghi (kể cả `CLAUDE.md`, `templates/init`, `.claude/settings.json`).
- [ ] **AC1.6** — Given `AGENTS.md` hoặc `CLAUDE.md` là symlink/junction trỏ ra ngoài root When `init` Then file đích của link không đổi byte, tên file nằm trong `skipped`, có cảnh báo nêu tên file.
- [ ] **AC1.7** — Given `init --full` trên project đã có `docs/requests/_TEMPLATE/plan.md` và `.claude/settings.json` When `init` Then hai file đó vẫn bị giữ nguyên và nằm trong `skipped` như trước request này (các test AC1.2–AC1.4 của init `--full` hiện có không đổi kết quả).

**`CLAUDE.md` import và dọn khối trùng (R2).**
- [ ] **AC2.1** — Given `CLAUDE.md` có sẵn, chưa import `@AGENTS.md` (đã soát bằng `importsAgentsMd`), không có khối When `init` Then dòng đầu tiên của `CLAUDE.md` là `@AGENTS.md`, nội dung cũ giữ nguyên sau đó, `importsAgentsMd` trả true, kết quả `refreshed`, và không còn cảnh báo "chưa import".
- [ ] **AC2.2** — Given `CLAUDE.md` đã import `@AGENTS.md` và không có khối When `init` Then `CLAUDE.md` không đổi byte và nằm trong `unchanged`.
- [ ] **AC2.3** — Given `CLAUDE.md` chứa khối baseline với marker hợp lệ (dạng install cũ để lại), có hoặc chưa có import When `init` Then khối bị gỡ khỏi `CLAUDE.md`, `@AGENTS.md` có mặt, văn bản ngoài marker giữ nguyên, `AGENTS.md` có khối của template, và tổng số marker BEGIN trong `AGENTS.md` cộng `CLAUDE.md` bằng 1.
- [ ] **AC2.4** — Given `AGENTS.md` là symlink/junction (init bỏ qua) và `CLAUDE.md` có sẵn thiếu import hoặc chứa khối When `init` Then `CLAUDE.md` không đổi byte và có cảnh báo nêu rằng không làm mới khối vì `AGENTS.md` là link.

**`install`/`uninstall` không còn ghi khối; dọn global (R3).**
- [ ] **AC3.1** — Given project (scope project) chưa init, hoặc đã init với `AGENTS.md`/`CLAUDE.md` có khối When `install` claude (skills-mode và plugin-mode), codex, cursor, antigravity Then `AGENTS.md` và `CLAUDE.md` không đổi byte (không tồn tại thì không được tạo) và entry manifest mới không có phần tử nào trong `managed`.
- [ ] **AC3.2** — Given sandbox global When `install -g` claude và codex Then `<root>/.claude/CLAUDE.md` và `<root>/.codex/AGENTS.md` không chứa khối baseline (không được tạo nếu chưa có), entry manifest không có `managed`.
- [ ] **AC3.3** — Given manifest global cũ có entry (skills-mode hoặc plugin-mode) với `managed: [".claude/CLAUDE.md"]` và file đó có nội dung của người dùng quanh khối When `install -g` lại hoặc `update -g` Then vùng khối bị gỡ, phần ngoài marker giữ nguyên; file chỉ còn khối thì bị xoá; entry sau đó không giữ `managed[]` cũ. Với entry plugin-mode, `update` (nhánh `plugin-refresh`) cũng thực hiện việc này.
- [ ] **AC3.4** — Given manifest project cũ có entry với `managed: ["AGENTS.md"]` hoặc `["CLAUDE.md"]` When `install`, `update` hoặc `uninstall` ở scope project Then file đó không đổi byte (kể cả khối do init ghi vẫn còn) và manifest không còn `managed[]` của entry bị thay hoặc gỡ.
- [ ] **AC3.5** — Given manifest global cũ có entry với `managed[]` When `uninstall -g` Then khối bị gỡ khỏi file đó như AC3.3; file chỉ dẫn là symlink/junction thì bị bỏ qua kèm cảnh báo và file đích không đổi byte; file có marker hỏng thì không ném, file giữ nguyên và có cảnh báo.

**`aip check` cảnh báo (R4).**
- [ ] **AC4.1** — Given `<global root>/.claude/CLAUDE.md` hoặc `.codex/AGENTS.md` còn khối baseline When `check({scope, doctor: true})` ở scope project và ở scope global Then kết quả có cảnh báo nêu file và gợi ý `aip update -g`; file không có khối hoặc không tồn tại thì không cảnh báo.
- [ ] **AC4.2** — Given project có `AGENTS.md` mà khối khác template (khác sau chuẩn hoá `\r\n`) When `check({scope: 'project', doctor: true})` Then có cảnh báo "cũ" kèm gợi ý `aip init`; khối bằng template (kể cả file dùng CRLF) thì không cảnh báo.
- [ ] **AC4.3** — Given project có `CLAUDE.md` thiếu `@AGENTS.md`, hoặc còn chứa khối baseline When `check({scope: 'project', doctor: true})` Then có cảnh báo tương ứng kèm gợi ý `aip init`; `CLAUDE.md` đã import và không có khối thì không cảnh báo.
- [ ] **AC4.4** — Given file kiểm có marker hỏng, hoặc project chưa có `AGENTS.md`, hoặc `AGENTS.md` không có marker When `check` Then không ném: ca marker hỏng có dòng cảnh báo nêu file, hai ca còn lại không cảnh báo.
- [ ] **AC4.5** — Given bất kỳ ca nào ở AC4.1–AC4.4 When `check` chạy Then không file nào bị tạo hay sửa và tiến trình `aip check` thoát mã 0.

**Báo kết quả init (R5).**
- [ ] **AC5.1** — Given `init` chạy trên project có `AGENTS.md` cũ, `CLAUDE.md` thiếu import, file khác của init đã có When đọc kết quả `init()` Then có bốn mảng `created`, `refreshed`, `unchanged`, `skipped` và mỗi file nằm đúng một mảng theo định nghĩa ở "Quyết định của agent" mục 6.
- [ ] **AC5.2** — Given `aip init` chạy qua CLI khi khối được làm mới When đọc stdout Then có dòng nêu `AGENTS.md` thuộc nhóm làm mới (khác nhóm tạo mới và giữ nguyên) và nhắc vùng giữa marker do aip quản lý; nhãn mục `init` của wizard nói init tạo hoặc làm mới `AGENTS.md` + `CLAUDE.md`.

**Tài liệu, spec, kiểm cuối (R6).**
- [ ] **AC6.1** — Given `README.md`, `README_VI.md` và `CLAUDE.md` của repo When `grep` các câu nói `install` ghi managed block vào `AGENTS.md`/`CLAUDE.md`, đếm tham chiếu managed block, hoặc bảng provider ghi "baseline block → `AGENTS.md`/`CLAUDE.md`" Then 0 kết quả; các chỗ đó nói khối thuộc `aip init` (chạy lại để làm mới), `install` chỉ gỡ khối legacy ở global.
- [ ] **AC6.2** — Given bước gộp spec When đọc `docs/specs/install-lifecycle/spec.md` và `docs/specs/cli-wizard/spec.md` Then khớp mục "Ảnh hưởng spec" bên dưới (kèm dòng bảng Lịch sử) và `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-04-project-baseline-init/ --base master` không còn W10–W14.
- [ ] **AC6.3** — Given nhánh `feature/project-baseline-init` sau mọi task When `npm test` Then exit 0; nếu thay đổi chạm `core/` hoặc `plugins/` (nội dung được chiếu) thì `.manifest.json` tương ứng đã tăng version và `node cli/lib/versions.mjs --lock` đã chạy.

## Thiết kế
### Hành vi theo lệnh
| Lệnh | Trước | Sau |
|---|---|---|
| `aip init` | Tạo `AGENTS.md` (nguyên template) nếu chưa có, không bao giờ đụng file có sẵn | Tạo nếu chưa có; có sẵn thì thay vùng giữa marker hoặc nối khối; bảo đảm `CLAUDE.md` import `@AGENTS.md` và không chứa khối; file khác của init không ghi đè |
| `install` project | Ghi khối vào `AGENTS.md` hoặc `CLAUDE.md` theo provider (claude/codex) | Không ghi file chỉ dẫn |
| `install -g` | Ghi khối vào `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md` | Không ghi; gỡ khối legacy của entry bị thay |
| `uninstall` project | Gỡ khối khi không entry nào còn dùng (đếm tham chiếu) | Không đụng file chỉ dẫn |
| `uninstall -g` | Như trên | Gỡ khối khỏi file trong `managed[]` của entry bị gỡ |
| `update -g` | Cài lại entry skills-mode (ghi khối); plugin-mode chỉ refresh qua `claude` CLI | Cài lại không ghi khối; cả hai nhánh gỡ khối legacy và bỏ `managed[]` |
| `check` (doctor) | Không xem khối | Thêm cảnh báo (a), (b) ở "Quyết định của agent" mục 5 |

### Thuật toán init
1. **Lập kế hoạch, chưa ghi.** Đọc template, trích khối (hàm thuần mới ở `managed-block.mjs`). `AGENTS.md`: không có → `create` từ template; là link → `skip` + cảnh báo; có → `mergeManagedBlock(existing, block, 'AGENTS.md')` (ném khi marker hỏng, đúng hàm hiện có), so với nội dung cũ để chia `refreshed`/`unchanged`. `CLAUDE.md`: không có → `create` từ khung của `templates/init-minimal` hoặc `templates/init`; là link → `skip` + cảnh báo; có và `AGENTS.md` không bị `skip` → gỡ khối nếu marker hợp lệ (`removeManagedBlock`), chèn `@AGENTS.md` làm dòng đầu nếu `importsAgentsMd` sai; có và `AGENTS.md` bị `skip` → giữ nguyên + cảnh báo.
2. **Ghi theo kế hoạch.** Các file khác của init chạy như hiện tại (không ghi đè). Bước 1 ném thì chưa có byte nào được ghi (AC1.5).
3. **`removeManagedBlock` trả chuỗi rỗng khi chỉ còn khối**; ở `CLAUDE.md` việc chèn import chạy trước nên file không rỗng.

`AGENTS.md` của chính repo này giống template từng byte nên chạy init ở repo này ra `unchanged`.

### Install, uninstall, update
- `install()`: bỏ `planManagedBlock` (đầu vòng provider) và `applyManagedBlock` (hai nhánh); entry mới không có `managed`. Phần của R11 về "kiểm managed block trước khi gỡ bản cũ" thành thừa; phần "ghi manifest sau từng provider" giữ nguyên.
- `uninstallEntries(m, root, predicate)` cần biết scope (hoặc nhận cờ) để chỉ dọn `managed[]` ở global. Dọn = `cleanManagedBlock` cho từng file trong `managed[]` của entry bị gỡ; link thì bỏ qua + cảnh báo; marker hỏng thì không ném (`removeManagedBlock` đã trả nguyên văn).
- `update()` nhánh `plugin-refresh`: entry được giữ lại, nên dọn `managed[]` của riêng entry đó (global) rồi xoá trường và `writeManifest`; project: chỉ xoá trường.
- `managedFilesToClean` (đếm tham chiếu) mất ý nghĩa; builder xoá hoặc đơn giản hoá, kèm test của nó nếu có.

### `aip check`
`check()` thêm `baseline: { warnings: string[] }` khi `doctor: true`; `reportCheck` in từng dòng. Chỉ đọc: `fs.readFileSync` trong `try`, so khối bằng khối template sau chuẩn hoá `\r\n`. File global lấy từ `scopeRoot('global')` để test cô lập được bằng `AIE_INSTALL_ROOT`.

### Điểm chạm
- Sửa: `cli/lib/init.mjs`, `cli/lib/install.mjs`, `cli/lib/managed-block.mjs`, `cli/index.mjs` (`reportInit`, `reportCheck`), `cli/lib/wizard.mjs` (nhãn mục `init`).
- Test sẽ đổi vì hành vi cũ không còn: `test/init.test.mjs` ("init không ghi đè file đã có, cảnh báo khi CLAUDE.md có sẵn chưa import"), `test/install.test.mjs` (đoạn "claude + CLAUDE.md import @AGENTS.md: khối baseline chuyển sang AGENTS.md", đoạn antigravity regression managed-block symlink, đoạn audit 2026-11-03 AC6.1/AC7.1), `test/managed-block.test.mjs` (nếu thêm hàm trích khối).
- Test bảo vệ (AGENTS.md mục Testing): hai test của audit `2026-11-03-audit-mustfix` AC6.1 và AC7.1 nay kiểm hành vi đã chuyển. Phần "ghi manifest sau từng provider" của AC6.1 phải còn một test (kích lỗi bằng cách khác, vd entry hỏng ở provider sau); phần "không ghi xuyên symlink vào `build/`" của AC7.1 được AC3.1 (install không ghi file chỉ dẫn) và AC1.6 (init bỏ qua link) phủ lại. Builder nêu tên test thay thế trong commit khi sửa.
- Tài liệu: `README.md`, `README_VI.md` (mục CLI `aip init`, dòng nói `install` ghi khối, dòng "reference-counts the shared managed block", bảng provider ở khoảng dòng 493–496 của `README.md`), `CLAUDE.md` của repo (đoạn State and ownership, đoạn Scope câu "The managed block is not written for cursor/antigravity …" và dòng lệnh `aip init`), `docs/specs/README.md` (mô tả cột `install-lifecycle` còn nhắc "managed block"). Tìm bằng `grep`, số dòng ở đây chỉ để định hướng.

### Spec sống
`docs/specs/install-lifecycle/spec.md`: R5 (khối baseline: install không còn ghi, chỉ gỡ legacy ở global), R6 (bỏ đếm tham chiếu: gỡ `managed[]` của entry bị thay/gỡ ở global), R7 (không provider nào ghi khối; link bị bỏ qua khi gỡ), R11 (bỏ vế "kiểm managed block trước khi gỡ bản cũ"), thêm R13 (`aip check` cảnh báo khối baseline). Mục Phạm vi dòng "Không gồm: … `aip init` …" giữ đúng vì init chuyển sang `cli-wizard`; dòng "khối managed trong `AGENTS.md`/`CLAUDE.md`" ở mục Gồm đổi thành "gỡ khối legacy ở global và cảnh báo khi check". `docs/specs/cli-wizard/spec.md`: thêm R8 (`aip init` idempotent và làm mới khối), sửa dòng Phạm vi "Không gồm: hành vi cũ của `init`" để nêu phần init thuộc request này. `docs/specs/baseline/spec.md`: không đổi yêu cầu nào; dòng Phạm vi "cách khối được ghi vào project đích (`install-lifecycle`)" đổi sang `cli-wizard` (chỉ chữ ở Phạm vi, nên không liệt kê trong mục Ảnh hưởng spec). Khi gộp, thêm dòng vào bảng Lịch sử của từng spec.

### Phát hành
Thay đổi nằm ở `cli/`, không chiếu ra project đích, nên không bắt buộc bump version. [giả định] Nếu builder sửa file dưới `core/` hoặc `plugins/` (vd nhắc `aip init` trong một skill) thì bump `.manifest.json` của plugin chứa nó rồi `node cli/lib/versions.mjs --lock` sau `npm run build`. Project đích đã init cần chạy lại `aip init` để làm mới khối; đây là cách làm mới duy nhất.

## Ảnh hưởng spec
- install-lifecycle: đổi R2, đổi R5, đổi R6, đổi R7, đổi R11, thêm R13
- cli-wizard: thêm R8
## Ngoài phạm vi và anti-goal
- Không đổi nội dung `core/agents/AGENTS.template.md` và `AGENTS.md` của chính repo (baseline/R1).
- Không đổi adapter cursor/antigravity, `installOne` hay cách đặt skill; không đổi ngữ nghĩa `mergeManagedBlock`/`removeManagedBlock` ngoài việc dùng lại.
- Không registry project, không `aip update` ghi vào repo khác, không cờ `--global-baseline`, không cờ `--refresh` của init.
- Không để `init --full` ghi đè `.claude/settings.json` hay khung `templates/init` đã có.
- Không thêm cơ chế tự phát hiện khối cũ khi chạy `install` (chỉ `aip check` cảnh báo).
## Ràng buộc
- Zero dependency, Node 20; UTF-8 không BOM, LF; chuỗi hiển thị cho người dùng tiếng Việt có dấu.
- Mỗi task một commit trên `feature/project-baseline-init`; không push, không merge.
- Hành vi cũ của `init` ở các file khác giữ nguyên (AC1.7); không `rm -rf` sandbox test có junction (dọn bằng `fs.rmSync`).
## Không đổi
- Nội dung template baseline, marker `AI-ENGINEERING:BEGIN/END AGENTS_BASELINE`, và việc cursor/antigravity không nhận khối.
- Cách `install` đặt skill, symlink/copy, manifest `files[]`/`links[]`, đếm tham chiếu marketplace; ghi manifest sau từng provider.
- `init --full` vẫn chỉ tạo `.claude/settings.json` khi chưa có; mọi file khác của init vẫn không bị ghi đè.
- Việc `aip init` không đổi gì ngoài root truyền vào và không cài skill.
## Kiểm thử
- `test/init.test.mjs`: AC1.1–AC1.7, AC2.1–AC2.4, AC5.1 (hàm `init()` với thư mục tạm; ca nhiều đầu vào của cùng một hành vi gộp thành một test tham số hoá, vd AC1.5 hai dạng marker hỏng, AC1.6 hai file link).
- `test/install.test.mjs`: AC3.1–AC3.5 (sandbox `AIE_INSTALL_ROOT`, manifest cũ dựng sẵn cho ca legacy; plugin-mode dùng seam fake của `claude` CLI đã có trong file này), AC4.1–AC4.5 (`check({doctor:true})` đọc file thật trong sandbox).
- `test/managed-block.test.mjs`: hàm trích khối thuần nếu được thêm (một ca: template thiếu marker thì ném).
- AC5.2: một test spawn `node cli/index.mjs init` trên thư mục tạm kiểm stdout; nhãn wizard kiểm bằng test wizard hiện có nếu đã pin nhãn, nếu không thì chỉ rà tay.
- AC6.1: `grep`; AC6.2: `check-request.mjs … --base master`; AC6.3: `npm test` (+ `versions.mjs --lock` nếu chạm nội dung được chiếu).
- Không viết test cho văn xuôi tài liệu ngoài các lệnh và tên file vận hành (AGENTS.md mục Testing).
## Để builder quyết
Chữ cụ thể của cảnh báo và dòng stdout của init; tên hàm và file đặt hàm trích khối; xử lý EOL khi chèn khối vào file CRLF (đề xuất: đổi EOL của khối theo EOL chiếm đa số của file, giữ AC1.2 "ngoài marker không đổi byte"); chèn `@AGENTS.md` kèm một dòng trống và vị trí khi file bắt đầu bằng BOM; `AGENTS.md` rỗng hoặc chỉ khoảng trắng coi là có sẵn (merge) hay như chưa có; xoá hay đơn giản hoá `managedFilesToClean`; cách truyền scope vào `uninstallEntries`.
## Rủi ro và câu hỏi mở
Rủi ro:
- Project đã init bản cũ giữ khối cũ tới khi người dùng chạy lại `aip init` ở từng project (hướng C bị loại). `aip check` cảnh báo nhưng không tự sửa; người không chạy check không biết.
- Init ghi vào file đã commit của người dùng: chỉnh sửa tay bên trong marker bị thay (đúng thiết kế, vùng giữa marker do aip quản lý); phần ngoài marker giữ nguyên. Người dùng xem được diff qua git; init in nhắc điều này (AC5.2).
- Project không init (hoặc chỉ cài skill) không còn baseline; Codex không có `~/.codex/AGENTS.md` mang khối thì mất baseline ở project chưa init. Người dùng đã chấp nhận (quyết định 1).
- Bỏ đếm tham chiếu ở global: một entry cũ còn lại trong manifest và vẫn liệt kê file đã bị gỡ khối thì cho qua êm (`removeManagedBlock` không có gì để gỡ); chỉ hại nếu có entry ghi khối lại, mà sau request này không đường nào ghi.
- Gỡ khối khỏi `CLAUDE.md` là sửa file người dùng ngoài phạm vi "AGENTS.md"; giới hạn ở khối nằm trong marker hợp lệ và chỉ khi `AGENTS.md` được init xử lý (quyết định của agent 1).
- Số dòng 318/200 do session chính đo trên máy người dùng ngày 2026-11-04; hành vi nối file và giới hạn Codex lấy từ docs đã dẫn ở trên, chưa kiểm bằng chạy thật.
- Chưa có ADR cho quyết định "một khối ở project, bỏ global" (không thuộc phạm vi giao); nên có một ADR `Status: Proposed` khi người dùng duyệt design.

[giả định] cần người xác nhận:
1. `aip check` cảnh báo khối global ở cả scope project lẫn scope global, và chỉ ở `doctor: true`.
2. Cảnh báo `check` phủ thêm `CLAUDE.md` còn chứa khối (ngoài hai ca người dùng nêu).
3. `CLAUDE.md` có marker hỏng không làm init ném (chỉ `AGENTS.md` ném).
4. Không bump version core vì thay đổi nằm ở `cli/`; chỉ bump nếu builder chạm nội dung được chiếu.
5. `AGENTS.md` bị bỏ qua vì là link thì `CLAUDE.md` cũng giữ nguyên (không chèn import, không gỡ khối).
6. Bỏ đếm tham chiếu `managed[]` ở global là chấp nhận được.
