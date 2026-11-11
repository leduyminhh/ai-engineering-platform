# Thiết kế: một luồng đọc và một chính sách tin cậy cho aip-gate.json
- Ngày: 2026-11-11
- Trạng thái: approved
- Requirement: [requirement.md](requirement.md)

## Vấn đề và lý do

Đã đọc trong code (mọi mô tả "hiện tại" dựa vào các điểm này):
- `core/hooks/scripts/gate-config.mjs`: `readState` (12–19) và `resolveGate` (24–43) là bản đọc gốc; `gateTracked` (68–84) kiểm git có icase và symlink; `fullEffective` (88–92) là nơi duy nhất đòi "file không bị theo dõi"; `envFilesAllowed` (108–110) đọc `allowEnvFiles` mà không kiểm tracked.
- `core/hooks/scripts/gate-stop.mjs:106–116` đọc `stopGate` và `exemptAgents` từ `readGateConfig` không kiểm tracked; dòng 148–149 mời người dùng tắt bằng `"stopGate": false`.
- `core/hooks/scripts/session-start.mjs:36–41` có `trackedByGit` riêng cho handoff: không icase, không symlink, git lỗi thì coi là chưa theo dõi (R19).
- `cli/lib/mode.mjs:76–91` có `locateGate` và `readText` riêng, parse lại ở 138–144; `cli/lib/autonomy.mjs:24–50` có `readAt` và `gateOf` (bản đọc thứ hai trong CLI, kèm kiểm file hỏng của repo chính); `cli/lib/init.mjs:25–30` `readAllowEnvFiles` đọc thẳng file, lỗi nào cũng về `false`, không kiểm tracked.
- `core/skills/plan-execution/scripts/autonomy.mjs`: `trackedByGit` (21–32, bản chép rút gọn của `gateTracked`), `readGateAt` (35–39, file hỏng → `{}`), `locate` (41–48), `resolveAutonomy` (51–69), `setRunner` (82–118, tự đọc/ghi file). Script này chạy ở project đích, nơi skills mode không cài cây hook.
- `cli/lib/status.mjs:30,337` đọc `statusStaleMinutes` qua `readGateConfig`; `guard-bash.mjs:416` và `guard-files.mjs:97` nhận `envFilesAllowed` làm dependency.
- Các spec liên quan: `docs/specs/hooks-gates/spec.md` (R4, R6, R9, R15, R19), `docs/specs/cli-wizard/spec.md` (R4, R6, R8).

Hệ quả đo được trong code: ba khoá nới quyền không theo cùng một luật. `mode` và `autonomy` từ file đã commit bị bỏ qua; `allowEnvFiles`, `stopGate`, `exemptAgents` từ file đã commit vẫn có hiệu lực, nên một repo clone tự tắt được guard `.env` và Stop gate của người dùng. Mỗi khoá mới lại thêm một bản đọc và một cách quyết riêng.

[Inference] Không làm thì mỗi khoá tiếp theo vẫn phải sửa nhiều nơi, và chỗ lệch ở trên tồn tại tiếp.

## Quyết định đã chốt

Người dùng đã duyệt brief ([brief.md](brief.md), `route-đã-duyệt: workflow-feature`):
- Hướng 1: module gốc trong core, bản sao commit cho script plan-execution, test giữ byte-identical.
- Khoá nới quyền chỉ có hiệu lực từ file không bị git theo dõi; khoá siết hoặc trung tính đọc được từ file đã commit.
- File hỏng: hook và script coi như không có cấu hình (vẫn che file repo chính); lệnh CLI báo lỗi, không ghi.
- Khoá lạ hoặc sai kiểu: lệnh status của CLI liệt kê; hook im lặng.
- Non-goal: lệnh `aip config` mới, đổi `policy.json`, đổi tên hay cú pháp khoá, thêm cảnh báo trong hook.

*Quyết định của agent* (người dùng chưa xét riêng; soát và đảo được ở lúc duyệt design):
- **A1** — API của `gate-file.mjs` (zero-dep, chỉ import `node:`): `readGateAt(root)` → `null` | `{ invalid: true }` | `{ config }` (bỏ BOM, phải là đối tượng); `locateGate(cwd, { git })` → `{ inRepo, top, main, roots, file, config, source, mainInvalid }` với `source` ∈ `'worktree' | 'main' | 'worktree-invalid' | null`; `gateTracked(file, { run })` chuyển từ `gate-config.mjs` sang (giữ icase, symlink, cache, cùng hành vi R6); `GATE_KEYS`; `trustedValue(gate, key, { tracked })`; `lintGate(config)` → `{ unknown, badType }`. Ngoài repo git `locateGate` đọc thẳng `<cwd>/.claude/aip-gate.json` và đặt `inRepo: false`.
- **A2** — Danh sách `trust: 'untracked'` (nới quyền): `mode`, `autonomy`, `allowEnvFiles`, `stopGate`, `exemptAgents`. 13 khoá còn lại `trust: 'any'`: `fullKeep`, `fullRoots`, `fullReadRoots` (chỉ dùng khi `full` hiệu lực, mà `full` đã đòi file chưa commit), `mcpAllow`, `mcpDeny`, `testCommands`, `bootstrapInject`, `handoffInject`, `ledgerInject`, `resumeWarn`, `handoffPath`, `handoffMaxAgeHours`, `statusStaleMinutes`. Mức tin cậy tính theo cả khoá, không theo hướng của giá trị.
- **A3** — `trustedValue` chỉ hỏi git khi khoá `untracked` thật sự có trong config (phiên thường không spawn git). `inRepo === false` hoặc `tracked === false` → trả giá trị; `tracked === true` hoặc `null` → `undefined`, consumer rơi về mặc định của khoá. Trạng thái `unknown` theo chính sách có sẵn (R6, R15): trong repo git, khoá nới quyền bị bỏ qua.
- **A4** — `gateTracked` được tổng quát hoá một dòng: nhánh `.claude` là symlink hiện hỏi `ask(root, '.claude')`; đổi thành hỏi thư mục cha trực tiếp của file (`ask(dirname(dirname(file)), basename(dirname(file)))`). Với file cấu hình kết quả không đổi, và `session-start` dùng được cho `handoff.md`.
- **A5** — `session-start` dùng `gateTracked` cho handoff (ledger vẫn không kiểm tracked, như hiện nay); `null` (không xác định) coi là chưa theo dõi (giữ R19, vì handoff là dữ liệu, không phải quyền). Hệ quả: so tên handoff bắt đầu không phân biệt hoa/thường và đi qua symlink (xem Rủi ro).
- **A6** — Bản sao `core/skills/plan-execution/scripts/gate-file.mjs` commit trong cây nguồn; test contract kiểm byte-identical (như cặp `AGENTS.md` ↔ `core/agents/AGENTS.template.md`). Chạy từ source vẫn được, không thêm bước build.
- **A7** — Lệnh ghi (`aip mode full|ask`, `aip autonomy high|safe`) chép khoá từ file repo chính sang file worktree mới (`cli/lib/mode.mjs` qua `applyFull`/`applyAsk`, `cli/lib/autonomy.mjs:66–69`). Khoá `untracked` mà `trustedValue` bỏ qua ở file nguồn (bị theo dõi hoặc không xác định) không được chép sang, áp cho cả 5 khoá `untracked` (gồm `autonomy`, kể cả gợi ý `partRunner`/`planRunner` bên trong); file nguồn không bị theo dõi thì các khoá này được chép như hiện nay; `mode` vẫn luôn bị bỏ như hiện nay. Lý do: không có bước này, chép `allowEnvFiles`/`stopGate`/`exemptAgents` từ file đã commit vào file worktree chưa theo dõi sẽ đưa lại hiệu lực cho khoá vừa bị bỏ qua (cùng kiểu lỗ hổng mà `droppedMode` đã chặn cho `mode`).
- **A8** — `lintGate` chỉ xét tên khoá và kiểu (`string`, `boolean`, `number`, `array`, `object`), không xét miền giá trị (vd `mode: "foo"` không bị báo; consumer đã coi giá trị lạ như mặc định) và không xét khoá con của `autonomy`.
- **A9** — Khi `gate-stop` chặn, đoạn gợi ý `"stopGate": false` chỉ hiện nếu file không tồn tại hoặc không bị theo dõi; hỏi git lúc dựng thông điệp (lúc chặn, hiếm) chứ không phải mỗi lượt.
- **A10** — Hook không thêm cảnh báo mới (theo lựa chọn của người dùng ở brief). Người dùng chỉ thấy khoá bị bỏ qua qua `aip mode status` và `aip autonomy status`.
- **A11** — Không viết ADR riêng: quyết định nằm trọn trong request này và spec `hooks-gates/R20`; viết ADR nếu người duyệt muốn lưu chính sách tin cậy ở `docs/decisions/`.
- **A12** — `fullEffective` không đi qua `trustedValue`: giữ nguyên code và seam `tracked(gate.file)` hiện có, vì nó đã đòi file không bị theo dõi cho `mode`.
- **A13** — `mcpAllow` xếp `any` vì nó chỉ siết: `guard-mcp` từ chối server ngoài danh sách, còn `full` hiệu lực thì bỏ qua danh sách (`guard-mcp.mjs:44`); không đường nào khiến `mcpAllow` nới quyền.

*Builder check* (một subagent mới đọc requirement + design): 10 câu, không câu nào cần người dùng; 3 câu nằm ở A1/A2/A13 (đã trả lời), 7 câu nhỏ do agent chốt: A5 (ledger không kiểm tracked), A7 (áp cho cả 5 khoá, file nguồn không bị theo dõi thì chép như cũ), A12, AC1.2 (kiểm theo tên hàm cũ), AC2.3 (chỉ đếm `git ls-files`), handoff `null` → chưa theo dõi không lỏng hơn hiện nay (trước đây git lỗi cũng coi là chưa theo dõi), số test `98` còn trống.

## Hướng đã cân nhắc

1. **Được chọn — module gốc trong core + bản sao commit cho script.** Module đọc và bảng khoá đặt cạnh `gate-config.mjs`; hook và CLI import thẳng, script dùng bản sao cạnh nó. Một contract test chạy cùng bộ vector (thiếu file, hỏng, worktree che repo chính, tracked/untracked/unknown, khoá lạ) trên module. Đánh đổi: có một file sao chép, đổi lại có đúng một nguồn sự thật và không thêm bước build.
2. **Loại — một thư viện chung cả hook lẫn script import theo đường dẫn tương đối.** Skills mode không cài cây hook, nên script gãy ở project đích.
3. **Dự phòng — giữ các bản riêng, chỉ thêm bộ vector test chung.** Ít đổi code nhất, nhưng mỗi khoá mới vẫn sửa nhiều nơi và bảng chính sách không có chỗ đặt. Dùng khi hướng 1 vướng ở build.

## Thiết kế

### Bản đồ file

- Mới: `core/hooks/scripts/gate-file.mjs` (nguồn); `core/skills/plan-execution/scripts/gate-file.mjs` (bản sao); test contract mới `test/contract/98-gate-file.contract.mjs` (vector `locateGate`/`trustedValue`/`lintGate`, byte-identical, chỉ `node:` import, script chạy khi vắng `core/hooks`, quét AC1.2) — tên file là tạm.
- `core/hooks/scripts/gate-config.mjs`: bỏ `readState`, `gateTracked`, `lsFiles`, cache; `resolveGate` dựa trên `locateGate` (ngoài repo vẫn trả `null` cho hook, như R4); re-export `gateTracked` để `guard-bash`/`guard-files` và test hiện có không đổi import; `envFilesAllowed` dùng `trustedValue(…, 'allowEnvFiles')`; `fullEffective` giữ nguyên logic.
- `core/hooks/scripts/gate-stop.mjs`: `stopGate`, `exemptAgents` qua `trustedValue`; thông điệp chặn theo A9.
- `core/hooks/scripts/session-start.mjs`: bỏ `trackedByGit`, dùng `gateTracked` với `null` → chưa theo dõi (A5).
- `cli/lib/mode.mjs`: bỏ `locateGate`/`readText` riêng, dùng `locateGate` của module; hỏng → exit 1; `status` in thêm khoá bị bỏ qua, khoá lạ, khoá sai kiểu; ghi theo A7.
- `cli/lib/autonomy.mjs`: bỏ `readAt`/`gateOf`, dùng `locateGate`; `bad` suy ra từ `source === 'worktree-invalid'` hoặc `mainInvalid`; `status` in như `mode`; ghi theo A7.
- `cli/lib/init.mjs` `readAllowEnvFiles`: `locateGate` + `trustedValue`; file hỏng → ném lỗi trước mọi ghi (kế hoạch được dựng trước vòng ghi file).
- `core/skills/plan-execution/scripts/autonomy.mjs`: import bản sao cạnh nó; bỏ `trackedByGit`, `readGateAt`, `locate`; `resolveAutonomy` và `setRunner` giữ hành vi R15 (kể cả `--set`).
- `cli/lib/status.mjs`: không đổi (khoá `any`).
- Test hiện có phải đổi: ca `JSON hỏng` ở `test/init.test.mjs:304` (hiện kỳ vọng `false`, sẽ kỳ vọng lỗi); các test của hook có kiểm `allowEnvFiles`/`stopGate` trong file đã commit (nếu có) đổi theo bảng ở mục Rủi ro.
- Spec sống (bước gộp): `docs/specs/hooks-gates/spec.md`, `docs/specs/cli-wizard/spec.md`.
- Version: `core/.manifest.json` (core, content đổi) rồi `node cli/lib/versions.mjs --lock` sau `npm run build`.

### Hành vi từng consumer

| Consumer | Đọc | Khoá tin cậy | Khi file hỏng | Khi tracked/unknown |
|---|---|---|---|---|
| `guard-bash`, `guard-files` | `readGate` → `resolveGate` | `allowEnvFiles` (`untracked`) | config `none`, im lặng | guard `.env` bật |
| `gate-stop` | `readGateConfig` | `stopGate`, `exemptAgents` (`untracked`); `testCommands` (`any`) | config `none`, im lặng | Stop gate bật, `exemptAgents` = `DEFAULT_EXEMPT_AGENTS` |
| `guard-bash`/`guard-files`/`guard-mcp` (`full`) | `fullEffective` | `mode` (`untracked`), `fullKeep`/`fullRoots`/`fullReadRoots`/`mcpAllow`/`mcpDeny` (`any`) | `ask` | chạy như `ask` (R6, không đổi) |
| `session-start` | `readGateConfig` | khoá `any`; handoff dùng `gateTracked` | config `none` | handoff tracked bị bỏ; `null` coi chưa theo dõi |
| `aip mode`, `aip autonomy` | `locateGate` | cả hai in khoá bị bỏ qua | stderr, exit 1, không ghi | `status` liệt kê khoá bị bỏ qua |
| `aip init --full` | `locateGate` + `trustedValue` | `allowEnvFiles` | ném lỗi, không ghi gì | giữ quy tắc `.env` trong `settings.json` |
| `autonomy.mjs` | bản sao `gate-file.mjs` | `autonomy` | mặc định an toàn, exit 0 (`--set`: exit 1) | khoá `autonomy` bị bỏ qua (R15) |

Ngoài repo git: hook không có cấu hình (R4); CLI và script đọc `<cwd>/.claude/aip-gate.json` như thường và coi khoá `untracked` là đáng tin vì không có clone nào để nghi.

### Bảng khoá (nội dung cho spec hooks-gates/R20)

| Khoá | Kiểu | Mức tin cậy | Mặc định khi thiếu, sai kiểu hoặc bị bỏ qua |
|---|---|---|---|
| `mode` | string | `untracked` | `ask` |
| `autonomy` | object | `untracked` | `{ mergeLocal: false, cleanup: false, partRunner: "session", planRunner: "subagent" }` |
| `allowEnvFiles` | boolean | `untracked` | `false` (guard `.env` bật) |
| `stopGate` | boolean | `untracked` | bật (chỉ `false` mới tắt) |
| `exemptAgents` | array | `untracked` | `DEFAULT_EXEMPT_AGENTS` |
| `fullKeep`, `fullRoots`, `fullReadRoots` | array | `any` | `["push"]`, `[]`, `[]` |
| `mcpAllow`, `mcpDeny` | array | `any` | không lọc |
| `testCommands` | array | `any` | không có mẫu thêm |
| `bootstrapInject`, `handoffInject`, `ledgerInject`, `resumeWarn` | boolean | `any` | bật |
| `handoffPath` | string | `any` | tự tìm handoff |
| `handoffMaxAgeHours`, `statusStaleMinutes` | number | `any` | 24, 30 |

Hai khoá nghiêng về siết (`mcpDeny`, `testCommands`) hay trung tính vẫn xếp `any` vì file đã commit chỉ làm hook chặt hơn hoặc đổi thông tin hiển thị, không nới quyền.

## Ảnh hưởng spec
- hooks-gates: thêm R20, đổi R19
- cli-wizard: đổi R4, đổi R6, đổi R8

R20 (hooks-gates), viết ở bước gộp: bảng khoá của `aip-gate.json` (tên, kiểu, mức tin cậy, mặc định); khoá `untracked` chỉ có hiệu lực khi file không bị git theo dõi (hoặc ngoài repo git cho CLI và script), bị theo dõi hoặc không xác định thì rơi về mặc định; khoá `any` đọc từ mọi file; file hỏng thì hook và script coi như không có cấu hình; module `gate-file.mjs` là nơi đọc duy nhất, bản sao ở `plan-execution/scripts` giữ byte-identical. R19 đổi: handoff dùng cùng hàm kiểm tracked (icase, symlink). cli-wizard: R4 và R6 thêm các dòng `status` (khoá bị bỏ qua, khoá lạ, khoá sai kiểu) và quy tắc không chép khoá `untracked` bị bỏ qua sang file worktree; R8 thêm hành vi `aip init --full` với file hỏng hoặc `allowEnvFiles` trong file đã theo dõi. R15 không đổi nội dung (đã mô tả đúng hành vi cho `autonomy`; có thể dẫn chiếu R20).

Ghi chú lệch với đề bài giao: cli-wizard thêm R8 ngoài R4/R6 vì `aip init --full` đổi hành vi (xem AC4.1, AC4.4); bỏ dòng này nếu người duyệt muốn giữ R8 nguyên.

## Ngoài phạm vi và anti-goal
- Không thêm lệnh `aip config`; không đổi `policy.json` hay cách `aip init --full` sinh `settings.json`; không đổi tên hay cú pháp khoá; không thêm cảnh báo trong hook; không kiểm miền giá trị hay khoá con của `autonomy` (A8).
- Anti-goal: hạ mức bảo vệ ở bất kỳ nhánh nào (khoá trước đây bị bỏ qua thì không được bắt đầu có hiệu lực, gồm cả đường chép khoá sang worktree, A7); để script plan-execution phụ thuộc vào cây hook.

## Ràng buộc
- Zero-dependency, chỉ `node:` built-in trong `gate-file.mjs`.
- Hai bản `gate-file.mjs` giống hệt byte; sửa một nơi thì chép sang nơi kia (contract test báo lệch).
- Không bước build mới; bump `core/.manifest.json` và `node cli/lib/versions.mjs --lock` (Claude Code cache plugin theo version).
- Tiếng Việt có dấu, UTF-8 không BOM, LF; comment trong code theo quy tắc của `AGENTS.md`.
- Không merge, không push khi người dùng chưa xác nhận.

## Kiểm thử
- Tầng thấp nhất cho từng hành vi, một test tham số cho nhiều đầu vào:
  - AC1.1, AC2.1–AC2.4, AC5.1, AC5.2: contract test mới trên module (`locateGate`, `trustedValue` 5 khoá × 4 trạng thái bằng seam `tracked`/`run`, đếm lời gọi git, `lintGate`, byte-identical, quét import, chạy `autonomy.mjs` từ bản sao ở thư mục tạm).
  - AC1.2: quét nguồn trong cùng contract test.
  - AC3.1–AC3.4: `test/contract/90-hooks.contract.mjs` (allowEnvFiles, stopGate, gate-stop reason, session-start handoff) và `93`/`94` (file hỏng che repo chính, `full`) với seam `tracked` có sẵn; chỉ thêm ca chưa có.
  - AC3.5, AC3.6: ca của `90` và `94` hiện có, giữ xanh.
  - AC4.1–AC4.5: `test/mode.test.mjs` và `test/init.test.mjs` (repo git tạm: file hỏng ở worktree và repo chính, tracked, unknown qua seam `run`, chép khoá sang worktree).
  - AC5.3: `test/content/34-autonomy-gates.pin.mjs` và `48-ask-execution-mode.pin.mjs` giữ xanh, không thêm pin song song.
  - AC6.1: `check-request.mjs … --base master`; AC6.2: `npm run build`, `versions.mjs --lock`, `npm test`.
- Không có API, không contract, không e2e. `calc:` chỉ ở AC2.1. Chưa có trial thật; hook chạy trong phiên Claude Code thật chưa được kiểm.

## Để builder quyết
- Tên và vị trí contract test mới; cách chia test hiện có thành ca tham số.
- Chữ chính xác của các dòng `status` (khoá bị bỏ qua, khoá lạ, khoá sai kiểu) miễn nêu tên khoá và lý do/kiểu cần có.
- Cách giữ seam hiện có (`deps.git`, `deps.tracked` của `autonomy.mjs`; `loadConfig`, `resolveRoots` của `gate-stop`; `run` của `gitStateOf`) khi chuyển sang module.
- Có cần `mainInvalid` trả thêm đường dẫn hay chỉ cờ boolean (CLI cần đường dẫn để in lỗi).
- Tên hằng/hàm export của `gate-file.mjs` ngoài các tên nêu ở A1.

## Rủi ro và câu hỏi mở
- **Đổi hành vi bảo mật (có chủ đích):** `allowEnvFiles: true`, `stopGate: false` và `exemptAgents` trong file đã bị git theo dõi (hoặc không xác định được trạng thái git, trong repo git) mất hiệu lực: guard `.env` bật, Stop gate bật, `exemptAgents` về `DEFAULT_EXEMPT_AGENTS`. Project nào đang dựa vào các khoá này trong file đã commit sẽ thấy hook hỏi và chặn trở lại; cách khắc phục là `git rm --cached .claude/aip-gate.json` và gitignore file, như `aip mode status` đã gợi ý cho `full`. Không khoá nào trước đây bị bỏ qua lại bắt đầu có hiệu lực.
- **Handoff chặt hơn một chút:** kiểm tracked của handoff chuyển sang icase và symlink; một `handoff.md` được commit dưới tên khác hoa/thường hoặc qua symlink đã commit, trước kia vẫn nạp, giờ bị bỏ. Git lỗi vẫn coi là chưa theo dõi.
- **Bản sao lệch nguồn** nếu sửa một bên: contract test fail; không có bước build nào chép hộ.
- **Phiên hook cũ:** hook chạy từ bản plugin đã cài (Claude cache theo version), nên project chưa `aip update` vẫn chạy luật cũ cho tới khi cập nhật; không chặn được từ phía source.
- [giả định] Không project nào dựa vào `allowEnvFiles: true` hoặc `stopGate: false` trong file đã commit (từ brief); chưa kiểm project nào.
- [giả định] Module đọc đủ nhỏ để chép nguyên vào skill mà không kéo theo phần riêng của hook (`classifyPath`, root chỉ-đọc…); nếu không, chỉ phần đọc + kiểm tracked + bảng khoá được tách ra. Nguồn: brief; đã giữ `classifyPath` và `fullReadRoots` ở `gate-config.mjs`.
- [giả định] `lintGate` chỉ xét kiểu (A8); chưa hỏi người dùng có muốn báo cả giá trị ngoài miền.
- [giả định] Tổng quát hoá `gateTracked` ở A4 không đổi kết quả cho file cấu hình: các ca symlink của `test/contract/94-permission-modes.contract.mjs` (dòng 390–449) kiểm lại điều này.
- Câu mở cho người duyệt: A7 (không chép khoá `untracked` bị bỏ qua sang worktree) là phần mở rộng ngoài brief, thêm vì thấy ở `cli/lib/autonomy.mjs:66–69`; có giữ trong phạm vi request này không. R8 của cli-wizard có khai hay không.
