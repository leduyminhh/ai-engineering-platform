# Thiết kế: Chuẩn hoá result giữa session và subagent
- Ngày: 2026-11-25
- Trạng thái: draft — chờ người duyệt; brief đã duyệt ở `brief.md` cùng thư mục
- Requirement: [requirement.md](requirement.md)

## Vấn đề và lý do
Hai đường báo cáo của `plan-execution` đều để LLM tự đọc rồi tự kiểm. Đường subagent → session chính dùng khối `agent_result` nhưng các luật "Kiểm đầu ra worker" do session chính áp bằng tay, prompt chép lại schema riêng và khoá rỗng vẫn bị bắt ghi. Đường phiên con → phiên gốc là văn tự do, không cú pháp, không trần độ dài. Chế độ part chạy bằng phiên riêng (40900e05) làm số báo cáo phiên gốc nhận tăng; theo hướng dẫn app cấp cho phiên, note tự động chỉ trích 400 ký tự đầu của báo cáo cuối lượt.

- Goal: một contract kết quả cho cả subagent lẫn phiên, gọn hơn, máy kiểm được (script + test).
- Non-goal: đổi định dạng dòng ledger; chuyển sang JSON; ép schema ở tầng công cụ Agent; viết lại `workflow_result`.
- Anti-goal: làm hỏng `aip status`, hook `session-start`, `ledger.mjs`; thêm phụ thuộc runtime; bắt reviewer chỉ-đọc ghi file; làm report cũ trong `.aip/runs/` bị báo lỗi.

## Quyết định đã chốt
Hướng chọn và hướng bị loại (từ `brief.md`):
- **A (chọn):** giữ YAML `agent_result` nhưng cho bỏ khoá rỗng; thêm dòng `aip-report` có khoá cho tin phiên ↔ phiên; thêm script kiểm và áp luật; gom định nghĩa về contract, prompt chỉ trỏ tới. Đánh đổi: thêm một script cùng test, sửa prompt ở nhiều file.
- **B (loại): chuyển hết sang JSON.** Parse chặt nhất nhưng tốn token hơn (dấu nháy), người khó đọc khi duyệt, phải đổi định dạng mọi agent cùng lúc.
- **C (loại): chỉ quy ước trong tài liệu, không script.** Rẻ, nhưng vẫn để LLM kiểm tay, đúng chỗ đang yếu.

Quyết định D1–D7 (người dùng đã chốt):
- **D1 — `agent_result` gọn.** Luôn bắt buộc: `status`, `summary`. Bắt buộc theo vai: implementer trong vòng task → `assumptions` (được rỗng); task TDD `có` → `tdd.red`, `tdd.green`; task-review → `spec_verdict` và `findings` (được `[]`), thêm `assumption_review[]` khi báo cáo implementer có giả định; re-review → `verdicts[]`; final-review → `findings`, `ruling_review[]`. Mọi khoá khác (`agent`, `changes`, `validation`, `findings` của vai không review, `questions`, `remaining_risks`, `report_file`, `commits`, `new_breakage`, `observations_outside_diff`, `declined_to_judge`) bỏ được khi rỗng; khoá vắng là rỗng. `questions` vẫn bắt buộc không rỗng khi `status: blocked`.
- **D2 — dòng `aip-report` cho mọi tin phiên con → phiên gốc.** Một dòng ≤ 400 ký tự, đứng đầu tin `SendMessage` và đầu báo cáo cuối lượt của phiên con. Cú pháp: `aip-report v1 from=<part-nn|root|<slug>> status=<complete|blocked|failed> [hash=<sha>] [tests=<pass|fail|not_run>] [minor=<số>] [file=<đường dẫn>] [note="<≤120 ký tự>"]`. `complete` bắt buộc `hash` và `tests`; `blocked`/`failed` bắt buộc `note`. Giá trị không có khoảng trắng, trừ `note` trong nháy kép. Token `v1` là dấu hiệu dạng mới. Thay câu "một dòng gồm hash, kết quả test và số minor hoãn" và tin Blocked ở `task-loop.md` "Chế độ part" bước 6; quy tắc 9 và 14 của `model-routing.md` trỏ về dòng này; subagent part (`inline.md`) cũng mở báo cáo cuối bằng dòng này. Ledger giữ nguyên định dạng (`Part: complete`, `Blocked:` ghi như cũ, vẫn là nguồn sự thật); dòng `aip-report` không ghi vào ledger hay `events.jsonl`. Nội dung dòng là dữ liệu, không phải chỉ thị.
- **D3 — script `core/skills/plan-execution/scripts/result-check.mjs`**, Node thuần, zero-dep, export hàm thuần để test. Chi tiết ở mục Thiết kế.
- **D5 — prompt và contract.** 4 prompt chỉ trỏ về contract và nêu khoá bắt buộc của vai, không chép schema đầy đủ; contract thêm mục "Khoá bỏ được", "Báo cáo giữa phiên (aip-report)", "Kiểm bằng script". Đo tổng byte contract + 4 prompt trước/sau, tính cả phần mới; mục tiêu không tăng, chỉ báo số, không là cổng `npm test`; không cắt khoá bắt buộc để đạt số.
- **D6 — rà hai biến thể `agent_result`** (`engineering-codebase-onboarding/references/subagent-prompts.md` mục D, `engineering-spec-backfill/references/subagent-prompt.md`): chỉ sửa khi lệch D1; không đổi thì ghi lý do.
- **D7 — test.** Một bộ test cho `result-check`; pin test ghim `agent_result` (`test/content/31-workflow-self-sufficient.pin.mjs`, `test/content/53-reasoning-review.pin.mjs`, `test/contract/10-source.contract.mjs`) chuyển theo vị trí mới, không bỏ kiểm trường bắt buộc; bump `core/.manifest.json` (và engineering nếu D6 sửa) rồi `node cli/lib/versions.mjs --lock`.

## Quyết định của agent
- **D4 — session chính ghi file report của mọi vai (LỆCH brief).** Brief định cho worker có quyền ghi (implementer, test-writer) tự ghi `task-<n>-report.md`. Đổi thành: session chính lưu nguyên văn `agent_result` nhận được của mọi vai vào `<workspace>/task-<n>-report.md` (review: `task-<n>-review-<vòng>.md`) rồi chạy script; worker không tự ghi. Lý do: `writeScope` + hook `guard-files` khoá ghi của agent domain trong `**Files:**` của task, nên một file ở `.aip/runs/` nằm ngoài phạm vi ghi của chúng; reviewer chỉ đọc. Một đường ghi duy nhất cho mọi vai cũng đơn giản hơn hai đường. Bước 4 của `task-loop.md` đổi từ "áp luật bằng tay" thành "chạy `result-check.mjs`, JSON kết quả quyết định đầu ra hỏng". Chế độ inline và task `TOOLING` do session chính làm giữ như cũ (`TOOLING` vẫn ghi report, có thể chạy script). Cần người duyệt xác nhận khi duyệt design vì lệch brief.
- Script đặt cạnh `ledger.mjs`, dùng `extractTask`, `taskField`, `effectiveTdd` của `task-brief.mjs`; không dùng `workspace.mjs` (builder check: không chỗ nào cần phân giải workspace, đường dẫn tính theo cwd).
- Câu của mục "Kiểm đầu ra worker" giữ nguyên chữ (chỉ thêm câu mới), và regex trong 3 file pin không được nới; chỉ đổi đường dẫn file nếu định nghĩa chuyển chỗ (builder check: đếm `ok(` không bắt được nới regex).
- Script không phát hiện "dạng cũ" cho `agent_result`: chỉ được gọi cho báo cáo mới; report cũ trong `.aip/runs/` không bị chạy lại hay chuyển đổi. Dấu hiệu dạng mới chỉ có ở dòng `aip-report` (token `v1`), vì `agent_result` mới là tập con hợp lệ của dạng cũ (chỉ bỏ khoá rỗng).
- Script đọc từ file hoặc `--line`, không đọc stdin (brief).
- Pin test chuyển chỗ nhưng giữ nguyên ý: schema mẫu `agent_result` trong contract vẫn liệt kê đủ khoá, khoá bỏ được đánh dấu bằng chú thích; nhờ đó `test/content/31-workflow-self-sufficient.pin.mjs` (kiểm `tdd { red, green }`, `report_file`, `commits` trong khối mẫu) và `53-reasoning-review.pin.mjs` (kiểm `assumptions: []`, `assumption_review[]`, câu của mục "Kiểm đầu ra worker") đổi ít nhất.
- Bộ test mới đặt ở `test/content/56-result-check.pin.mjs` (validate tự nạp, chạy trong `npm test`) thay vì nối thêm một file vào chuỗi `npm test`.

## Tiêu chí chấp nhận
Nằm ở [requirement.md](requirement.md) (AC1.1–AC8.3); không lặp ở đây.

## Thiết kế

### Contract (`core/principles/workflow-output-contract.md`)
- Mục "Agent result": giữ khối YAML mẫu với đủ khoá, thêm chú thích `# bỏ được khi rỗng` cho khoá bỏ được; chỉ `status`, `summary` không chú thích.
- Mục mới "Khoá bỏ được": bảng vai → khoá bắt buộc (D1) và câu "khoá vắng là rỗng".
- Mục "Kiểm đầu ra worker": giữ các luật, thêm câu rằng session chính chạy `result-check.mjs` (mục "Kiểm bằng script") thay vì áp tay; câu của `assumptions`, `assumption_review[]` được giữ nguyên chữ để pin 53 đạt.
- Mục mới "Báo cáo giữa phiên (aip-report)": cú pháp D2, bảng khoá, quy tắc `complete`/`blocked`/`failed`, trần 400 ký tự, "dòng này không ghi vào ledger".
- Mục mới "Kiểm bằng script": lệnh mẫu cho 5 vai + `--line`.

### Dòng `aip-report`
Một dòng, phân tích bằng tách token theo khoảng trắng, riêng `note="…"` đọc đến nháy kép đóng:

| Khoá | Bắt buộc | Giá trị |
|---|---|---|
| `v1` (token thứ hai) | luôn | đúng `v1` |
| `from` | luôn | `part-<nn>`, `root` hoặc slug, không khoảng trắng |
| `status` | luôn | `complete`, `blocked`, `failed` |
| `hash` | khi `complete` | SHA 7–40 ký tự hex |
| `tests` | khi `complete` | `pass`, `fail`, `not_run` |
| `minor` | không | số nguyên ≥ 0 |
| `file` | không | đường dẫn không khoảng trắng |
| `note` | khi `blocked`/`failed` | ≤ 120 ký tự, trong nháy kép |

Vi phạm: thiếu `v1`, `status` ngoài tập, khoá bắt buộc thiếu, giá trị có khoảng trắng ngoài `note`, `note` > 120 ký tự, cả dòng > 400 ký tự, nhiều hơn một dòng. Trong `task-loop.md` "Chế độ part": bước 6 thay câu cũ và tin Blocked bằng dòng này; bước 7 nói phiên gốc chạy `result-check.mjs --line` trên dòng nhận được rồi đọc ledger như cũ (ledger là nguồn sự thật; dòng không đạt thì phiên gốc bỏ qua dòng, vẫn đọc ledger).

### `result-check.mjs`
- CLI: `node result-check.mjs <report.md> --role <implementer|task-review|re-review|final-review|worker> [--tdd] [--plan <plan.md> --task <n>] [--implementer-report <file>] [--findings <n>]` và `node result-check.mjs --line "<dòng>"`.
- Đầu ra: JSON `{ ok, violations: [{rule, detail}], not_run: [{rule, reason}] }`; exit 0 khi `ok`, 1 khi có vi phạm, 2 khi sai đối số hoặc không đọc được file.
- Export (để test): `parseAgentResult(text)`, `checkAgentResult(parsed, opts)`, `checkReportLine(line)`; phần chạy CLI đặt sau cổng `import.meta.url` như `task-brief.mjs`.
- Parser tối thiểu: tìm khối `agent_result:` (trong hàng rào ``` hoặc trần), trích khoá cấp một cần cho luật (`status`, `summary`, `changes`, `validation`, `findings`, `questions`, `tdd`, `assumptions`, `spec_verdict`, `assumption_review`, `verdicts`, `ruling_review`) ở dạng block list (`- ` thụt lề) và flow `[…]`/`{…}`; đếm mục của list và đọc các khoá con cần (`location`, `evidence`, `status`, `red`, `green`, `added/modified/deleted`). Không là YAML đầy đủ; khoá lạ bỏ qua. Không parse được → vi phạm `unparseable`.
- Bảng luật (ID là giá trị `rule` trong JSON):

| ID | Vi phạm khi | Điều kiện áp |
|---|---|---|
| `status-valid` | thiếu `status` hoặc ngoài `completed|failed|blocked` | mọi vai |
| `finding-location-evidence` | finding thiếu `location` không rỗng hoặc thiếu `evidence` | mọi vai |
| `completed-no-failed-validation` | `status: completed` mà có `validation` mang `status: failed` | mọi vai |
| `changes-in-files` | file trong `changes` ngoài `**Files:**` của task | chỉ khi có `--plan --task`, không thì `not_run` |
| `tdd-required` | thiếu `tdd.red` hoặc `tdd.green` | `--tdd`, hoặc `effectiveTdd` của task = `có` khi có `--plan --task` |
| `assumptions-key` | thiếu khoá `assumptions` (`[]` hợp lệ) | `--role implementer` |
| `spec-verdict-findings` | thiếu `spec_verdict` hoặc `findings` (`[]` hợp lệ) | `--role task-review` |
| `assumption-review-count` | số mục `assumption_review[]` khác số giả định của báo cáo implementer | `--role task-review` hoặc `--role re-review` có `--implementer-report` (re-review: báo cáo của vòng sửa, chỉ gồm giả định mới); không có cờ thì `not_run` |
| `verdicts-count` | số mục `verdicts[]` khác `--findings` | `--role re-review` có `--findings`; không có cờ thì `not_run` |
| `blocked-questions` | `status: blocked` mà `questions` rỗng hoặc vắng | mọi vai |
| `final-review-keys` | thiếu `findings` hoặc `ruling_review[]` | `--role final-review` |

  Luật `final-review-keys` là bản kiểm máy của D1 cho vai final-review, thêm cạnh các luật có sẵn của contract (mục "Kiểm đầu ra worker" thêm một câu cho luật này).
- **Thứ tự áp (quyết định của agent, builder check):** không có khối `agent_result` hoặc không parse được → `violations` chỉ có `unparseable`, không áp luật nào khác. Parse được thì áp mọi luật có điều kiện khớp, báo đủ mọi vi phạm.
- **Vai `worker`** (subagent ngoài vòng task: DOCS, onboarding, spec-backfill, agent của workflow): chỉ các luật "mọi vai" cộng `changes-in-files`/`tdd-required` khi có cờ tương ứng; không đòi `assumptions`, `spec_verdict`, `verdicts`, `ruling_review`.
- **Độ dài dòng `aip-report`** đếm theo code point (`[...line].length`), không theo byte hay đơn vị UTF-16. [Unverified] app đếm 400 ký tự của note theo cách nào; trần 400 code point là cận chung tốt nhất khi chưa kiểm được.
- **Đường dẫn** `<report.md>`, `--plan`, `--implementer-report` tính theo cwd của lệnh; script không dùng `workspace.mjs` (không cần phân giải workspace), chỉ import built-in `node:*` và `./task-brief.mjs`.
- Số giả định của báo cáo implementer lấy bằng cách chạy cùng parser trên `--implementer-report` và đếm `assumptions`.
- Khớp `changes` với `**Files:**`: lấy đường dẫn trong dấu backtick của các dòng sau `**Files:**` (`- Create:`, `- Modify:`, `- Test:`), chuẩn hoá dấu `\` thành `/`.

### Luồng ở `plan-execution`
1. Giao việc (bước 3): prompt implementer; worker trả `agent_result` trong tin nhắn.
2. Nhận (bước 4): session chính lưu nguyên văn vào `task-<n>-report.md`, chạy `result-check.mjs <file> --role implementer [--plan <plan.md> --task <n>]`; `violations` không rỗng là đầu ra hỏng, giao lại worker kèm `violations`, tối đa 2 lần như hiện nay. `not_run` được ghi vào báo cáo của task, không là lỗi.
3. Task review (bước 7–8): lưu `task-<n>-review-<vòng>.md` rồi chạy `--role task-review --implementer-report task-<n>-report.md`; re-review chạy `--role re-review --findings <k>`; review cuối chạy `--role final-review`.
4. Session chính vẫn tự chạy lệnh test (bước 5) và đối chiếu diff; script chỉ kiểm hình dạng và quan hệ giữa các mục của báo cáo, không xác minh nội dung.

### Đo kích thước (D5)
Trước (đo `wc -c` ngày 2026-11-25, commit đầu nhánh `feature/agent-session-result-contract`):

| File | Trước (byte) | Sau (byte) |
|---|---|---|
| `core/principles/workflow-output-contract.md` | 13 360 | 19 283 |
| `prompts/final-review.md` | 6 771 | 6 908 |
| `prompts/task-review.md` | 5 007 | 5 078 |
| `prompts/implementer.md` | 4 257 | 4 538 |
| `prompts/re-review.md` | 2 436 | 2 589 |
| Tổng | 31 831 | 38 396 |

Sau (đo `wc -c` ngày 2026-11-25 trên nhánh sau Task 5): tổng 38 396 byte, vượt mục tiêu 31 831 thêm 6 565 byte (+20,6%). Nguyên nhân: contract tăng 5 923 byte do ba mục mới (Khoá bỏ được, Báo cáo giữa phiên (aip-report), Kiểm bằng script) và chú thích khoá bỏ được; bốn prompt tăng ròng 642 byte, vì D5 dự kiến prompt chỉ trỏ tới contract nhưng chưa bớt chữ. Không cắt khoá bắt buộc để đạt mục tiêu; số vượt nêu ở bản trình G3, không là cổng test.

### Kết quả rà biến thể (D6)
- `engineering-codebase-onboarding/references/subagent-prompts.md`: **sửa**. Mục D ghi "trả đúng khối này" kèm `questions: []`, tức bắt ghi khoá rỗng, lệch D1. Thêm một dòng trước khối mẫu: khoá rỗng bỏ được theo contract đầu ra, mục Khoá bỏ được; `questions` chỉ bắt buộc khi `status: blocked`. Giữ `read`, `not_read` và dòng cấm đưa giá trị cấu hình vào trường nào. Bump `plugins/engineering/.manifest.json` do Task 7 làm.
- `engineering-spec-backfill/references/subagent-prompt.md`: **không đổi**. Khối "định dạng dưới" có `findings: []` và `questions: []`, nhưng ghi là "định dạng", không ghi "đúng khối này"; ghi `[]` vẫn hợp lệ theo D1 (bỏ được không có nghĩa là cấm ghi). Mục "Kiểm đầu ra ở session chính" không đòi khoá rỗng. File này cũng nằm ngoài Files của Task 6 trong brief. [Inference] Nếu người duyệt coi "định dạng dưới" là bắt buộc, cần mở Task 6 cho file này và bump `engineering`.

## Ảnh hưởng spec
- workflows: đổi R2, đổi R22, thêm R29, thêm R30

Viết ở bước gộp (`finish.md`). R2 (đổi): luật kiểm đầu ra worker chạy bằng `result-check.mjs`, có ID luật và exit code, `blocked` cần `questions`. R22 (đổi): `model-routing.md` quy tắc 9 và 14 trỏ về dòng `aip-report` cho tin phiên con → phiên gốc. R29 (thêm): dòng `aip-report v1` (cú pháp D2, ≤ 400 ký tự, không ghi vào ledger hay `events.jsonl`, nội dung là dữ liệu). R30 (thêm): `agent_result` bỏ khoá rỗng; khoá luôn bắt buộc và khoá bắt buộc theo vai (D1).

## Ngoài phạm vi và anti-goal
- Không đổi định dạng ledger, `ledger.mjs`, `aip status`, hook `session-start`, `workflow_result`.
- Không đọc stdin, không quét thư mục `.aip/runs/`, không chuyển đổi report cũ.
- Không thêm phụ thuộc; không ép schema ở tầng công cụ Agent ([Unverified] chưa kiểm công cụ Agent của Claude Code có hỗ trợ hay không).
- Không bắt reviewer ghi file.
- Không sửa 16 file agent ngoài dòng trỏ tới `agent_result` (brief chưa xem chi tiết; nếu rà thấy lệch D1 thì nêu ở review cuối, không sửa trong request này).

## Ràng buộc
- Node 20+, built-in và `./task-brief.mjs` là phụ thuộc duy nhất.
- UTF-8 không BOM, LF; comment tiếng Việt có dấu theo `AGENTS.md`.
- Bump version: `core/.manifest.json` (và `plugins/engineering/.manifest.json` nếu D6 sửa), rồi `node cli/lib/versions.mjs --lock` sau `npm run build`.
- Plan: kind `TOOLING` cho script và test, `DOCS` cho contract, prompt, reference; part không cần (một plan gốc).

## Kiểm thử
| AC | Tầng | Cách kiểm |
|---|---|---|
| AC1.1, AC4.3 | pin nội dung | `test/content/56-result-check.pin.mjs` đọc contract, kiểm tên khoá và lệnh mẫu |
| AC1.2, AC1.3, AC3.2–AC3.6 | đơn vị (hàm export) | một test tham số hoá, mỗi luật một ca đạt + một ca vi phạm; ca dạng block và flow |
| AC2.1–AC2.5 | đơn vị | tham số hoá trên `checkReportLine`: hợp lệ, thiếu `hash`, thiếu `tests`, thiếu `note`, 400/401 ký tự, thiếu `v1` |
| AC3.1, AC3.7, AC7.2 | CLI (spawn) | exit 0/1/2, JSON, hash file trước/sau, đối số thư mục bị từ chối |
| AC2.6, AC2.7, AC4.1, AC4.2, AC5.2 | pin nội dung / lệnh | `grep` trong pin; `git diff --name-only` ở review |
| AC1.4, AC8.1 | pin hiện có | `node test/validate.mjs --build`; `grep -c "ok("` trước/sau |
| AC5.1 | đo | `wc -c`, ghi vào bảng Đo kích thước |
| AC6.1 | review | mục "Kết quả rà biến thể" |
| AC7.1, AC8.2, AC8.3 | suite | `npm test`, `node test/validate.mjs --only versions` |

Tầng test: mỗi hành vi một test ở tầng thấp nhất; không kiểm hai lần cùng một luật ở pin nội dung và đơn vị.

## Để builder quyết
- Tên hàm nội bộ, cấu trúc parser, thông điệp `detail`.
- Cách trích số giả định và số mục `assumption_review[]` khi YAML viết lệch (thụt lề, khoá con trên một dòng).
- Hình dạng bảng trong mục "Khoá bỏ được" và câu chữ chú thích khoá bỏ được trong khối mẫu, miễn các pin liệt kê ở D7 vẫn đạt.
- Chi tiết regex của SHA (`hash`) và đường dẫn (`file`).

## Baseline (Bước 1)
Đo ngày 2026-11-25, trước khi sửa:
- Repo chính: `npm test` exit 1, 9548 pass / 1 fail. Test hỏng là P4e AC1.3, do `.claude/aip-gate.json` mode `confined` của chủ repo (đã biết, không liên quan request này).
- Clone sạch: 9540 pass / 2 fail. Hai test thời gian AC3.4 (< 1 s) hỏng vì nhiễu tải; chạy riêng `node test/validate.mjs --only path-permissions` trên clone sạch hai lần cho 1229 pass / 0 fail.
- Mốc so sánh sau khi sửa: không thêm test đỏ ngoài các lỗi trên; hai nhóm lỗi trên không tính là do request.

## Rủi ro và câu hỏi mở
- **Parse YAML tay bắt sai report hợp lệ** → session chính giao lại worker oan. Giảm: parser chỉ trích khoá luật cần và bỏ qua khoá lạ; test có ca block, flow, thụt lề lệch, giá trị có dấu `:` trong chuỗi, report thật lấy từ vài file trong `.aip/runs/` làm fixture (đã ẩn nội dung nhạy cảm); `not_run` thay vì vi phạm khi thiếu cờ; session chính xem `detail` trước khi giao lại và báo người dùng khi cùng một worker bị giao lại vì `unparseable` (mức 2 lần như luật hiện có).
- **Pin test vỡ khi định nghĩa chuyển chỗ** (`31-…`, `53-…`, `10-source`). Giảm: giữ khối mẫu đủ khoá trong contract, chạy ba file pin sau mỗi task sửa contract; chỉ chuyển kiểm, không bỏ (AC8.1).
- **Prompt reviewer rơi khoá bắt buộc** (`spec_verdict`, `assumption_review[]`, `verdicts[]`, `ruling_review[]`) khi cắt chép schema. Giảm: mỗi prompt vẫn nêu tên khoá bắt buộc của vai (AC5.2); luật `spec-verdict-findings`, `assumption-review-count`, `verdicts-count`, `final-review-keys` bắt khi rơi.
- **[Unverified] App có giữ nguyên dòng đầu báo cáo cuối lượt trong note 400 ký tự hay không.** Không spike được ngoài app. Giảm: trần 400 ký tự của dòng `aip-report` khớp trần của note nên nếu app trích đúng 400 ký tự đầu thì cả dòng nằm trong note; `SendMessage` không phụ thuộc note và phiên gốc vẫn đọc ledger làm nguồn sự thật (bước 7).
- **Lệch brief ở D4** (ai ghi file report): cần người duyệt xác nhận khi duyệt design.
- [giả định] Bỏ khoá rỗng giảm 10–20% kích thước report; chưa đo, không là AC.
- [giả định] Quy tắc 9 và 14 của `model-routing.md` và mục "Messages between sessions" là chỗ duy nhất cần đổi ở baseline; `AGENTS.md` chỉ có một câu ở "Model and session routing" và giữ nguyên. Builder kiểm lại bằng `grep` khi làm.
- Câu hỏi mở: không có.
