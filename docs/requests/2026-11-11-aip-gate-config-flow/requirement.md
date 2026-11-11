# Requirement: một luồng đọc và một chính sách tin cậy cho aip-gate.json

## Yêu cầu gốc

- **R1** — Mọi hook, lệnh CLI (`aip mode`, `aip autonomy`, `aip init`, `aip status`) và script `autonomy.mjs` của `plan-execution` PHẢI đọc `.claude/aip-gate.json` qua đúng một module (`gate-file.mjs`): tìm file theo thứ tự worktree rồi repo chính, bỏ BOM, nhận diện file hỏng, hỏi git xem file có bị theo dõi không.
- **R2** — Module PHẢI có một bảng khoá (tên, kiểu, mức tin cậy) làm nguồn sự thật. Khoá nới quyền chỉ có hiệu lực khi file không bị git theo dõi; khoá siết hoặc trung tính đọc được cả từ file đã commit.
- **R3** — Hook PHẢI áp chính sách ở R2 cho `allowEnvFiles`, `stopGate`, `exemptAgents`; file hỏng thì hook coi như không có cấu hình, im lặng.
- **R4** — Lệnh CLI PHẢI báo lỗi và không ghi gì khi file hỏng; `aip mode status` và `aip autonomy status` PHẢI liệt kê khoá bị bỏ qua vì file đã bị git theo dõi, khoá lạ và khoá sai kiểu; lệnh ghi file không được đưa lại hiệu lực cho khoá đã bị bỏ qua.
- **R5** — Script `autonomy.mjs` PHẢI chạy được khi không có cây hook (skills mode), nên dùng một bản sao byte-identical của module nằm cạnh nó.
- **R6** — Spec `hooks-gates` PHẢI có bảng khoá và chính sách; version core PHẢI tăng; `npm test` PHẢI xanh.

## Bối cảnh

Brief đã duyệt: [brief.md](brief.md). Hiện file này có sáu chỗ parse riêng (`gate-config.mjs`, `cli/lib/mode.mjs`, `cli/lib/autonomy.mjs`, `cli/lib/init.mjs`, script `autonomy.mjs`, cùng `session-start.mjs` kiểm tracked riêng) và ba bản kiểm "file bị git theo dõi". Mỗi khoá tự quyết có tin file đã commit hay không, nên lệch thật đã xảy ra: `allowEnvFiles` trong file đã commit vẫn tắt guard `.env`, còn `mode: full` và `autonomy` trong file đã commit bị bỏ qua. Mỗi request gần đây thêm một khoá kèm một bản đọc mới (`autonomy`, `planRunner`, `statusStaleMinutes`).

Script `autonomy.mjs` chạy ở project đích, nơi skills mode không cài hook, nên không import được module nằm trong cây hook. Đó là lý do có bản sao commit trong cây skill.

Người dùng không có API, không có contract (`docs/contracts/` không tồn tại), không có luồng e2e: thay đổi nằm hoàn toàn trong hook, CLI và script.

## Ràng buộc

- Zero-dependency: `gate-file.mjs` chỉ import built-in của Node.
- Không đổi tên khoá, cú pháp file, `core/permissions/policy.json` hay cách `aip init --full` sinh `settings.json`.
- Hook không thêm cảnh báo mới; lỗi nội bộ vẫn fail-open (R3 của hooks-gates).
- Không bước build mới: bản sao nằm trong cây nguồn, test giữ byte-identical.
- Không khoá nào trước đây bị bỏ qua được bắt đầu có hiệu lực.
- Tiếng Việt có dấu, UTF-8 không BOM, LF.

## Tiêu chí chấp nhận

- [ ] **AC1.1** — Given các tình huống: file thiếu, JSON hỏng, giá trị không phải đối tượng (mảng, `null`, chuỗi), có BOM, file worktree hợp lệ, file worktree hỏng cạnh file repo chính hợp lệ, worktree trống cạnh repo chính hợp lệ, submodule, ngoài repo git When `locateGate(cwd)` chạy Then kết quả khớp bảng kỳ vọng của một test tham số: thiếu → `config: null`; hỏng → `source: 'worktree-invalid'` và không rơi về repo chính; BOM → đọc được; worktree trống → `source: 'main'`; submodule → `main` là gốc của chính submodule; ngoài repo → `inRepo: false` và đọc `<cwd>/.claude/aip-gate.json`
- [ ] **AC1.2** — Given mã nguồn `core/` và `cli/` When quét định nghĩa hàm Then các hàm đọc riêng cũ (`readState`, `readAt`, `readGateAt`, `gateOf`, `locateGate` trong `mode.mjs`, `trackedByGit` ở `session-start.mjs` và `autonomy.mjs`) không còn được định nghĩa ngoài `core/hooks/scripts/gate-file.mjs` và bản sao `core/skills/plan-execution/scripts/gate-file.mjs`, và `readAllowEnvFiles` của `init.mjs` không còn gọi `readFileSync`; lệnh ghi file (`writeFileSync`) không tính
- [ ] **AC2.1** — Given bảng `GATE_KEYS` When đếm Then có 18 khoá, mỗi khoá có `type` và `trust` (`any` hoặc `untracked`); 5 khoá `untracked` là `mode`, `autonomy`, `allowEnvFiles`, `stopGate`, `exemptAgents`; 13 khoá `any` là `fullKeep`, `fullRoots`, `fullReadRoots`, `mcpAllow`, `mcpDeny`, `testCommands`, `bootstrapInject`, `handoffInject`, `ledgerInject`, `resumeWarn`, `handoffPath`, `handoffMaxAgeHours`, `statusStaleMinutes`; `calc: 5 + 13 = 18`
- [ ] **AC2.2** — Given mỗi khoá `untracked` có mặt trong config When `trustedValue(gate, key, { tracked })` chạy ở bốn trạng thái: file không bị theo dõi (`false`), bị theo dõi (`true`), không xác định (`null`), ngoài repo git (`gate.inRepo === false`) Then trả giá trị của khoá ở trạng thái 1 và 4, trả `undefined` ở trạng thái 2 và 3 (một test tham số 5 khoá × 4 trạng thái)
- [ ] **AC2.3** — Given khoá `any` có mặt When `trustedValue` chạy ở cả bốn trạng thái Then trả nguyên giá trị và số lần gọi git bằng 0; Given config chỉ có khoá `any` hoặc không có khoá `untracked` nào When hook xử lý một lượt Then số tiến trình `git ls-files` được spawn bằng 0; có khoá `untracked` thì tối đa 2 lời gọi mỗi file như R6 của hooks-gates
- [ ] **AC2.4** — Given config có khoá lạ (`foo`) và khoá sai kiểu (`stopGate: "no"`, `mcpAllow: "a"`) When `lintGate(config)` chạy Then trả `unknown: ['foo']` và `badType` chứa `stopGate` và `mcpAllow`; config hợp lệ trả hai mảng rỗng
- [ ] **AC3.1** — Given `allowEnvFiles: true` When `guard-bash` và `guard-files` xử lý lệnh/ghi nhắc `.env` Then file không bị theo dõi (hoặc config tiêm không có `file`) → không hỏi như hiện nay; file bị theo dõi hoặc không xác định → vẫn hỏi (guard `.env` bật)
- [ ] **AC3.2** — Given `stopGate: false` hoặc `exemptAgents: ["x"]` When `gate-stop` xử lý lượt có sửa code mà chưa chạy test Then file không bị theo dõi → `stopGate: false` bỏ qua gate, `exemptAgents` thay `DEFAULT_EXEMPT_AGENTS`; file bị theo dõi hoặc không xác định → Stop gate vẫn chặn và `exemptAgents` về `DEFAULT_EXEMPT_AGENTS`
- [ ] **AC3.3** — Given `gate-stop` chặn When file `aip-gate.json` bị theo dõi hoặc không xác định được Then `reason` không còn đoạn `"stopGate": false` mà chỉ nêu `AIP_STOP_GATE=off`; Given file không tồn tại hoặc không bị theo dõi Then `reason` giữ nguyên cả hai cách tắt
- [ ] **AC3.4** — Given file `aip-gate.json` của worktree hỏng, repo chính có file hợp lệ When một hook chạy Then hook coi cấu hình là `none` (không rơi về repo chính), không in gì ra stderr và không chặn (R9 của hooks-gates); When `node autonomy.mjs` chạy ở cùng tình huống Then exit 0 và in `{"mergeLocal":false,"cleanup":false,"partRunner":"session","planRunner":"subagent"}`
- [ ] **AC3.5** — Given `handoff.md` hợp lệ trong tuổi cho phép When `session-start` chạy Then handoff bị bỏ nếu `gateTracked` trả `true` (kể cả khác hoa/thường hoặc đi qua symlink đã commit) và được nạp khi trả `false` hoặc `null` (git lỗi coi là chưa theo dõi, R19)
- [ ] **AC3.6** — Given `mode: "full"` và phiên `bypassPermissions` When file bị theo dõi, không xác định hoặc không bị theo dõi Then `fullEffective` cho kết quả như trước thay đổi (chỉ `true` ở trường hợp không bị theo dõi); test `test/contract/94-permission-modes.contract.mjs` hiện có vẫn xanh không sửa ngữ nghĩa
- [ ] **AC4.1** — Given file `aip-gate.json` của worktree hoặc của repo chính hỏng When chạy `aip mode full|ask|status`, `aip autonomy high|safe|status` hoặc `aip init --full` Then stderr nêu đường dẫn file hỏng, exit 1, và không ghi file nào (kể cả `.claude/settings.json`, `AGENTS.md`)
- [ ] **AC4.2** — Given file bị theo dõi hoặc không xác định được và có khoá `untracked` (ví dụ `stopGate: false`, `allowEnvFiles: true`) When chạy `aip mode status` và `aip autonomy status` Then in một dòng liệt kê từng khoá bị bỏ qua kèm lý do (`đang được git theo dõi` hoặc `không xác định được trạng thái git`); không có khoá nào bị bỏ qua thì không in dòng đó
- [ ] **AC4.3** — Given file có khoá lạ hoặc khoá sai kiểu When chạy `aip mode status` và `aip autonomy status` Then in dòng liệt kê khoá lạ và dòng liệt kê khoá sai kiểu kèm kiểu cần có; file sạch thì không in hai dòng này; hook không in gì cho cùng file
- [ ] **AC4.4** — Given `aip-gate.json` có `allowEnvFiles: true` When `aip init --full` sinh `.claude/settings.json` Then file không bị theo dõi hoặc thư mục đích ngoài repo git → bỏ quy tắc `.env` như hiện nay; file bị theo dõi hoặc không xác định trong repo git → giữ quy tắc `.env`
- [ ] **AC4.5** — Given worktree chưa có file, repo chính có file bị theo dõi (hoặc không xác định) chứa `allowEnvFiles`, `stopGate` hoặc `exemptAgents` When `aip mode full|ask` hoặc `aip autonomy high|safe` ghi file worktree Then file mới không chứa các khoá đó (khoá `untracked` mà `trustedValue` bỏ qua ở file nguồn không được chép; `autonomy` cũ cũng không chép, `aip autonomy high` chỉ ghi bộ `high`), và `mode` vẫn bị bỏ khi chép như hiện nay; các khoá `any` và khoá lạ vẫn được chép; Given file repo chính không bị theo dõi Then `allowEnvFiles`, `stopGate`, `exemptAgents`, `autonomy` được chép như trước thay đổi
- [ ] **AC5.1** — Given hai file `core/hooks/scripts/gate-file.mjs` và `core/skills/plan-execution/scripts/gate-file.mjs` When so byte (sau chuẩn hoá `\r\n`) Then giống hệt nhau; lệch thì test contract fail kèm tên hai file
- [ ] **AC5.2** — Given `gate-file.mjs` When quét các câu lệnh `import` Then chỉ có specifier bắt đầu bằng `node:`; Given thư mục `core/skills/plan-execution/scripts` được chép sang thư mục tạm không có `core/hooks` và không có `cli` When chạy `node autonomy.mjs` trong một repo git tạm Then exit 0 và in JSON bốn khoá
- [ ] **AC5.3** — Given `autonomy.mjs` sau thay đổi When đọc (`readAutonomy`) và ghi (`--set`) Then hành vi R15 của hooks-gates giữ nguyên: khoá `autonomy` trong file bị theo dõi hoặc không xác định (trong repo git) bị bỏ qua, ngoài repo git đọc như thường, `--set` exit 1 khi file hỏng và exit 0 không ghi khi file bị theo dõi; `test/content/34-autonomy-gates.pin.mjs` và `test/content/48-ask-execution-mode.pin.mjs` xanh
- [ ] **AC6.1** — Given bước gộp When cập nhật spec sống Then `docs/specs/hooks-gates/spec.md` có R20 (bảng 18 khoá và chính sách tin cậy; tên khoá trong bảng khớp `GATE_KEYS`) và R19 đổi; `docs/specs/cli-wizard/spec.md` có R4, R6 và R8 đổi; mỗi mục có dòng trong bảng Lịch sử trỏ tới request này; `check-request.mjs … --base master` không báo W10–W14
- [ ] **AC6.2** — Given sau thay đổi When chạy `npm run build`, `node cli/lib/versions.mjs --lock` và `npm test` Then `core/.manifest.json` có version lớn hơn 1.33.1, `plugins/_versions.lock.json` khớp và `npm test` exit 0

## Không đổi (bugfix)

- Thứ tự tìm file (worktree rồi repo chính, R4), file worktree hỏng che repo chính (R9), điều kiện `full` (R6), `fullKeep`/`fullRoots`/`fullReadRoots`, `mcpAllow`/`mcpDeny`, `statusStaleMinutes` và các khoá `any` còn lại.
- `aip mode full|ask` và `aip autonomy high|safe` vẫn giữ khoá khác, bỏ BOM, chạy lại không đổi gì (R4, R6 của cli-wizard).
- Hook không thêm cảnh báo, không ghi file, vẫn fail-open khi lỗi nội bộ.
