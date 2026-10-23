# Thiết kế: gate kiểm chứng (project 2a)
- Ngày: 2026-10-20
- Trạng thái: in-progress — duyệt 2026-10-20; Task 1–5 xong trên feature/verification-gate; Task 6 (smoke hook Stop + eval, AC3.1–AC3.2) hoãn theo người dùng; merge `dabc13f`; việc hoãn ghi ở mục 5 của spec tổng
- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project P2a (xu hướng 7)
- Requirement: không có (AC nằm ở mục Tiêu chí chấp nhận bên dưới)

## Vấn đề và lý do

- Agent báo "xong" khi chưa chạy test sau lần sửa code cuối. Hiện chỉ có chỉ dẫn mềm: skill `superpowers:verification-before-completion`, mục Definition of Done của `workflow-feature`, mục Fail loud trong baseline `AGENTS.md`. Không có gì chặn cứng.
- Chuỗi truy vết AC chỉ đi tới task: `check-request.mjs` cảnh báo AC chưa được task nào phủ (W6), nhưng không ai kiểm AC đã có test hay chưa.
- 3 case trong `evals/` (`backend/code-review-readonly`, `engineering/spec-writing-routes`, `workflows/bugfix-routes`) mới kiểm cấu trúc, chưa chạy thật lần nào. Mọi nhận định "skill được chọn đúng" vẫn là [Unverified]; `evals/README.md` còn nhiều nhãn [Unverified] về cách gọi lệnh.

## Quyết định đã chốt

Của người dùng:
- Làm 2a trước 2b (2026-10-20).
- Stop gate **bật mặc định** cho mọi project cài plugin `core`; project tắt bằng `"stopGate": false` (2026-10-20).
- Eval chạy thật: agent chạy, trần **0,5 USD/case** (2026-10-20).
- Từ lộ trình: aip chỉ chuẩn hóa và phân phối, zero-dep, không tự chạy agent; Claude Code là provider chính.

Của người viết thiết kế (người dùng kiểm khi đọc):
- D1. Gate dùng hook `Stop` + `SubagentStop` của plugin `core`, không dùng `PostToolUse`: chỉ lúc agent định dừng mới biết "đã sửa mà chưa test".
- D2. Gate chỉ kiểm **có chạy test sau lần sửa code cuối hay không**, không phán test xanh/đỏ. Lý do: test đỏ có chủ đích là hợp lệ (vd `frontend-e2e-testing` giữ test đỏ khi bắt được bug thật và báo lại).
- D3. Gate chỉ nhắc **một lần** mỗi lượt: `stop_hook_active = true` thì cho qua. Agent có thể dừng sau khi giải thích vì sao không chạy test.
- D4. Chỉ xét lượt hiện tại (từ prompt người dùng gần nhất); với subagent thì xét toàn bộ transcript của subagent.
- D5. AC ↔ test làm bằng cách mở rộng `check-request.mjs` (cảnh báo W7), không viết script mới.
- D6. Eval: chạy tay lần đầu và ghi baseline; **không** đưa vào CI ở project này.
- D7. Cấu hình gate nằm ở `<git-root>/.claude/aip-gate.json`, không ở `.ai-engineering/`: thư mục đó là state cài đặt và thường bị gitignore (repo aip cũng vậy), nên team không commit được.
- D8. "Lệnh kiểm chứng" gồm test **và** kiểm tĩnh: typecheck, lint, build (`tsc`, `eslint`, `npm run build|lint|typecheck`, `mvn compile`…). Lý do: `frontend-implementer` kiểm bằng build/tsc/lint theo skill của nó.
- D10. Phạm vi W7 mặc định là các file test ghi trong dòng `**Files:**` của `plan.md` cùng request (không quét cả thư mục test). Lý do: ID AC lặp giữa các request (`AC1.1` có ở 9 thư mục `docs/requests/`), quét rộng sẽ tính nhầm test của request khác là đã phủ. `--tests` ghi đè phạm vi này. Người dùng chưa trả lời câu này; đây là đề xuất, kiểm khi duyệt.
- D11. Trần 0,5 USD/case tính cho **tổng** mọi lượt chạy của case (kể cả chạy lại sau khi sửa case): 3 case ≤ 1,5 USD. Mỗi lượt dùng `--runs 1 --max-cost-usd <phần ngân sách còn lại>`; không chạy lượt `--runs 3`. Hết ngân sách mà case còn đỏ → ghi trạng thái vào README và dừng.
- D9. Agent bị cấm chạy lệnh theo định nghĩa của nó được miễn gate qua `exemptAgents` (so với `agent_type` của `SubagentStop`); mặc định `["data-migration-writer"]`. Agent chỉ đọc tự qua vì không sửa file.

## Tiêu chí chấp nhận

- [x] **AC1.1** — Given transcript lượt hiện tại có Edit/Write/MultiEdit/NotebookEdit lên file code và không có lệnh test nào sau lần sửa đó, When hook `Stop` chạy với `stop_hook_active = false`, Then stdout là JSON `{"decision":"block","reason":…}`, `reason` tiếng Việt nêu số file và tối đa 3 đường dẫn đã sửa, yêu cầu chạy test liên quan hoặc nêu rõ lý do bỏ qua; exit 0.
- [x] **AC1.2** — Given có lệnh Bash/PowerShell khớp mẫu lệnh test chạy **sau** lần sửa code cuối, When hook chạy, Then không in gì và exit 0 (cho dừng), bất kể test xanh hay đỏ.
- [x] **AC1.3** — Given lượt hiện tại không sửa file nào, hoặc chỉ sửa file tài liệu (mục Thiết kế §1), When hook chạy, Then cho dừng.
- [x] **AC1.4** — Given `stop_hook_active = true`, hoặc biến môi trường `AIP_STOP_GATE=off`, hoặc `.claude/aip-gate.json` ở gốc git có `"stopGate": false`, When hook chạy, Then cho dừng.
- [x] **AC1.5** — Given stdin không phải JSON, transcript không tồn tại/không đọc được, hoặc dòng JSONL có cấu trúc lạ, When hook chạy, Then cho dừng và exit 0 (fail-open, không ném lỗi ra phiên).
- [x] **AC1.6** — Given sự kiện `SubagentStop`, When hook chạy, Then đọc `agent_transcript_path` (không phải `transcript_path`) và áp cùng quy tắc AC1.1–AC1.5; `decision: "block"` giữ subagent chạy tiếp.
- [x] **AC1.10** — Given sự kiện `SubagentStop` có `agent_type` khớp (theo tên agent, bỏ tiền tố `<plugin>:` nếu có) một mục trong `exemptAgents` (mặc định `["data-migration-writer"]`, file cấu hình ghi đè), When hook chạy, Then cho dừng.
- [x] **AC1.7** — Given `.claude/aip-gate.json` có `"testCommands": ["<regex>", …]`, When một lệnh khớp regex đó, Then lệnh được tính là lệnh test (cộng thêm vào mẫu mặc định); regex sai cú pháp bị bỏ qua, không làm hỏng hook.
- [x] **AC1.8** — Given sửa file trong lượt **trước** prompt người dùng gần nhất và lượt hiện tại không sửa gì, When hook chạy, Then cho dừng.
- [x] **AC1.9** — Given `core/hooks/hooks.json`, Then đăng ký `Stop` và `SubagentStop` gọi `node ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gate-stop.mjs`; `HOOK_EVENTS` trong `cli/lib/conventions.mjs` nhận 2 event này; build Claude ship script; hook không lọt sang codex/cursor/skills-mode (contract `90-hooks` hiện có vẫn xanh).
- [x] **AC2.1** — Given thư mục request có AC và `plan.md` có dòng `**Files:**` liệt kê file test, When chạy `check-request.mjs <dir>` và một AC hợp lệ không xuất hiện trong các file test đó, Then in `WARN <file>:<dòng> [W7] <AC> chưa có test nào nhắc tới`. Đường dẫn trong `**Files:**` tính từ gốc git chứa thư mục request.
- [x] **AC2.6** — Given `plan.md` có ít nhất một dòng `**Files:**` nhưng không dòng nào chứa file test (file test = mục ghi `Test:` hoặc đường dẫn khớp mẫu test: thư mục `test/`, `tests/`, `__tests__/`, `spec/` hoặc tên `*.test.*`, `*.spec.*`, `*_test.*`, `test_*.py`, `*Test.java`), When chạy script, Then in một cảnh báo W8 "plan.md không ghi file test nào" và bỏ qua W7. File test được ghi nhưng chưa tồn tại → mỗi file một cảnh báo W9.
- [x] **AC2.7** — Given cờ `--tests <đường dẫn>…`, Then dùng các đường dẫn này thay cho phạm vi lấy từ `plan.md` và không in W8/W9.
- [x] **AC2.2** — Given file test chứa `AC1.2`, `AC1_2` hoặc `ac1_2` (không phân biệt hoa thường, dấu `.` hoặc `_`), Then AC1.2 được tính là có test.
- [x] **AC2.3** — Given phạm vi test (từ `plan.md` hoặc `--tests`) có thư mục, Then quét đệ quy, bỏ qua `node_modules`, `.git`, `build`, `dist`, `target`, `.venv`; file nhị phân hoặc không đọc được thì bỏ qua.
- [x] **AC2.4** — Given cờ `--strict` và có ít nhất một cảnh báo, Then exit 1; không có cảnh báo thì exit 0. Không có `--strict` thì giữ hành vi cũ: luôn exit 0 (AC4.2 của project 1 không đổi). Đối số sai vẫn exit 2.
- [x] **AC2.5** — Given managed block `core/agents/AGENTS.template.md`, Then mục AC có thêm quy ước: test phủ AC ghi ID AC trong tên test hoặc comment (Python dùng `ac1_2`); `AGENTS.md` ở gốc repo giống byte-for-byte template.
- [ ] **AC3.1** — Given 3 case trong `evals/`, When agent chạy lần đầu theo checklist trong `evals/README.md` trong trần ngân sách D11, Then README có bảng kết quả: case, ngày, model, số run, tỷ lệ pass, chi phí; các nhãn [Unverified] đã được kiểm qua lần chạy thì bỏ hoặc sửa theo kết quả.
- [ ] **AC3.2** — Given một case fail, Then phân loại: lỗi do case/grader/lệnh (sửa trong project này) hay do skill (ghi finding vào README, không sửa skill trong project này).
- [x] **AC4.1** — `npm test` xanh; version `core` được bump (và plugin khác nếu nội dung của nó đổi); `plugins/_versions.lock.json` cập nhật bằng `node cli/lib/versions.mjs --lock`.

## Thiết kế

### §1. Stop gate — `core/hooks/scripts/gate-stop.mjs`

Đăng ký trong `core/hooks/hooks.json`, cùng kiểu với hook hiện có (exec form `node` + `args`, timeout 10):

```json
"Stop":         [ { "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gate-stop.mjs"], "timeout": 10 } ] } ],
"SubagentStop": [ { "hooks": [ { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/scripts/gate-stop.mjs"], "timeout": 10 } ] } ]
```

Luồng quyết định (export `decide(input, deps)` thuần để unit test, giống `guard-bash.mjs`):

1. `stop_hook_active === true` → cho dừng (D3).
2. Tắt gate: `AIP_STOP_GATE=off` hoặc `<git-root>/.claude/aip-gate.json` có `"stopGate": false` → cho dừng.
3. Chọn transcript: `hook_event_name === 'SubagentStop'` → `agent_transcript_path`, ngược lại `transcript_path`.
4. Đọc JSONL, lấy phần **sau prompt người dùng gần nhất** (dòng `type: "user"` mà `message.content` là chuỗi hoặc có phần tử không phải `tool_result`). Với subagent: lấy toàn bộ.
5. Duyệt theo thứ tự các phần tử `tool_use` trong dòng `type: "assistant"`:
   - `Edit|Write|MultiEdit|NotebookEdit` với `input.file_path` (hoặc `notebook_path`) là **file code** → ghi nhận vị trí sửa cuối + đường dẫn.
   - `Bash|PowerShell` với `input.command` khớp **mẫu lệnh test** → ghi nhận vị trí test cuối.
6. Có sửa code và (không có test hoặc test cuối đứng trước sửa cuối) → `{"decision":"block","reason":"…"}`. Còn lại → không in gì.
7. Mọi lỗi → cho dừng, exit 0 (fail-open như `guard-files`).

**File code** = mọi file không phải tài liệu. Tài liệu: phần mở rộng `.md`, `.mdx`, `.txt`, `.rst`, `.adoc`. (Ảnh, file cấu hình như `.json`/`.yml` vẫn tính là code: cấu hình sai cũng làm test đỏ.)

**Mẫu lệnh test mặc định** (khớp ở đầu một đoạn lệnh, sau `&&`/`;`/`|` hoặc `cd … &&`):
`npm|pnpm|yarn|bun (run )?test…`, `npx|pnpm exec (vitest|jest|playwright test|mocha)`, `node --test`, `node test/…`, `mvn(w)? … (test|verify)`, `gradle(w)? … (test|check|build)`, `pytest`, `python -m pytest|unittest`, `go test`, `cargo test`, `dotnet test`; cộng lệnh kiểm tĩnh theo D8: `tsc`, `eslint`, `(npm|pnpm|yarn) run (build|lint|typecheck)`, `mvn(w)? … compile`, `ruff|mypy`. Project bổ sung qua `aip-gate.json` `testCommands` (AC1.7).

**Cấu trúc transcript** — [Unverified] không có docs công khai. Quan sát trên transcript local (Claude Code, 2026-10-20): mỗi dòng là JSON có `type`; lời gọi tool nằm ở `message.content[]` với `{type:"tool_use", name, input}` trong dòng `type:"assistant"`; kết quả ở `{type:"tool_result", tool_use_id, is_error?, content}` trong dòng `type:"user"`, lệnh Bash lỗi có `content` bắt đầu bằng `Exit code N`. Gate chỉ dựa vào `tool_use` (`name`, `input`) và ranh giới prompt người dùng; không dùng `is_error` (D2). Cấu trúc đổi → fail-open, gate im lặng tắt (xem Rủi ro).

Ngữ nghĩa hook đã đối chiếu docs (https://code.claude.com/docs/en/hooks): `Stop` nhận `transcript_path`, `stop_hook_active`, `last_assistant_message`; `SubagentStop` có thêm `agent_id`, `agent_type`, `agent_transcript_path`; chặn bằng `decision: "block"` + `reason`; Claude Code tự ngắt sau 8 lần chặn liên tiếp. [Unverified] trang plugins-reference không liệt kê tường minh `Stop`/`SubagentStop` cho plugin hook; cần một lần smoke test thật (xem Kiểm thử).

### §2. AC ↔ test — mở rộng `core/skills/artifact-templates/scripts/check-request.mjs`

- Cú pháp mới: `node check-request.mjs <thư-mục-request> [--tests <path>…] [--strict]`.
- Phạm vi test mặc định (D10): gom đường dẫn trong các dòng `**Files:**` của `plan.md` (cùng dòng hoặc danh sách gạch đầu dòng ngay dưới, theo định dạng của `writing-plans`), giữ các file test (AC2.6), resolve từ gốc git chứa thư mục request. `--tests` thay thế phạm vi này (AC2.7).
- `checkRequest(texts, { testTexts })`: `testTexts` là danh sách nội dung file test; ID tìm bằng `/(?<!\d)AC(\d+)[._](\d+)(?!\d)/gi`, chuẩn hóa về `AC<n>.<m>` (sửa khi lập plan: bản `\b…\b` cũ không khớp `test_ac1_2_x` hay `testAc1_2` vì `_`/chữ liền kề không tạo ranh giới từ). AC hợp lệ (đã qua W3/W4) không có trong tập này → W7 tại dòng AC trong file nguồn.
- Quét file: hàm `main` đọc đường dẫn, đệ quy thư mục, bỏ qua thư mục ở AC2.3; giữ zero-dep.
- `--strict`: exit 1 khi có cảnh báo (để CI của project đích dùng được). Mặc định vẫn chỉ cảnh báo.
- Baseline (`core/agents/AGENTS.template.md`, mục AC): thêm một câu quy ước gắn ID AC vào tên test hoặc comment, và ghi file test vào dòng `**Files:**` của task trong `plan.md`, kèm lệnh kiểm `check-request.mjs <dir>`; đồng bộ `AGENTS.md`.

### §3. Eval chạy thật lần đầu

- Theo "Danh sách kiểm lần chạy đầu" trong `evals/README.md`: mỗi case `--case <name> --runs 1 --no-publish`, `--max-cost-usd` = phần còn lại của 0,5 USD cho case đó (D11). Không chạy lượt `--runs 3`.
- Cài plugin ở chế độ plugin trước (`aip install --provider claude --as-plugin …`), như README đã ghi.
- Ghi bảng kết quả vào `evals/README.md`; kết quả JSON nằm trong `evals/<id>/results/` (đã gitignore).
- Tốn tiền model trên tài khoản người dùng; người dùng đã duyệt trần 0,5 USD/case. Bước `aip install … -g` đổi cấu hình Claude global → plan ghi lệnh gỡ (`aip uninstall … -g`) để trả lại trạng thái cũ nếu người dùng muốn.

## Ngoài phạm vi và anti-goal

Ngoài phạm vi:
- 2b workflow graph máy đọc được; runner (project 6).
- Eval trong CI / theo lịch; eval mới ngoài 3 case hiện có.
- Gate cho codex/cursor/antigravity (aip không ship hook cho các provider này) và cho cài đặt skills-mode (không có hook).
- Phán test xanh/đỏ, đo coverage, kiểm nội dung test có đúng AC hay không.
- Sửa skill khi eval phát hiện skill sai (ghi finding, làm project sau).

Anti-goal (thất bại dù chạy được):
- Gate chặn lượt chỉ hỏi đáp, chỉ sửa docs, hoặc chặn lặp vô hạn.
- Gate làm chậm mỗi lần dừng thấy rõ (mục tiêu < 300 ms với transcript ~5 MB).
- Gate làm vỡ phiên khi lỗi nội bộ (phải fail-open).
- W7 thành cảnh báo rác: AC đã có test nhưng vẫn báo vì quy ước tên quá hẹp.

## Ràng buộc

- Zero-dep, chỉ built-in Node 20+; ESM; UTF-8 không BOM, LF.
- Hook không ghi file, không gọi lệnh ngoài `git rev-parse` (chính sách hook hiện có); xử lý BOM ở stdin như `guard-files.mjs`.
- Hook chỉ tồn tại ở plugin mode (chính sách hiện có).
- Comment trong code: tiếng Việt, chỉ giải thích *vì sao* (baseline mục Comments).
- Đổi nội dung chiếu ra → bump version plugin sở hữu + `versions.mjs --lock`.

## Kiểm thử

| AC | Tầng | Ở đâu |
|---|---|---|
| AC1.1–AC1.8 | unit, gọi `decide()` với fixture transcript JSONL dựng trong test (không đọc transcript thật) | `test/contract/90-hooks.contract.mjs` |
| AC1.9 | contract build/source hiện có + kiểm `HOOK_EVENTS` | `test/contract/90-hooks.contract.mjs` |
| AC2.1–AC2.4 | unit `checkRequest()` + chạy `main()` cho exit code | `test/contract/35-artifact-templates.contract.mjs` |
| AC2.5 | pin nội dung baseline + kiểm byte-identical hiện có | `test/content/` (pin mới) |
| AC3.1–AC3.2 | thủ công, có chi phí | `evals/README.md` |
| AC4.1 | `npm test` | — |

Smoke test thủ công một lần (không tự động): cài `core` dạng plugin vào một project nháp, cho agent sửa một file `.js` rồi dừng → thấy thông báo chặn; chạy `npm test` rồi dừng → dừng được. Xác nhận phần [Unverified] về plugin hook `Stop`.

## Để builder quyết

- Danh sách regex lệnh test cụ thể và cách tách đoạn lệnh (có thể dùng lại `parse()` của `guard-bash.mjs` nếu tách được mà không kéo theo phụ thuộc vòng).
- Câu chữ `reason` của gate (tiếng Việt, ngắn, nêu cách tắt gate).
- Có thêm hướng dẫn gắn ID AC vào skill `backend-testing`/`frontend-testing` hay chỉ baseline là đủ.
- Đọc transcript toàn bộ hay đọc ngược từ cuối file (miễn đạt mục tiêu thời gian).

## Rủi ro và câu hỏi mở

Rủi ro:
- Cấu trúc transcript là nội bộ, có thể đổi khi Claude Code cập nhật → gate im lặng tắt (fail-open). Giảm thiểu: fixture trong test ghi rõ cấu trúc đang giả định; smoke test lại khi nâng Claude Code.
- Lệnh test tự chế (`make test`, `./run-tests.sh`) không khớp mẫu → chặn nhầm một lần; giải bằng `aip-gate.json` `testCommands`.
- Agent có thể chạy một lệnh test không liên quan để qua gate; gate chỉ là chặn tối thiểu, không thay review.
- Eval tốn tiền và Windows native từ chối case có Bash (hiện không case nào có Bash).

Câu hỏi mở: không còn. Q1 (gate bật mặc định) và Q2 (eval 0,5 USD/case) đã được người dùng trả lời; phạm vi W7 (D10) là đề xuất chờ người dùng kiểm khi duyệt.
