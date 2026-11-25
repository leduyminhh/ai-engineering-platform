# Requirement: Chuẩn hoá result giữa session và subagent

## Yêu cầu gốc
Hệ thống PHẢI có một contract kết quả chung, gọn và máy kiểm được, cho cả hai đường báo cáo của `plan-execution`: subagent → session chính (khối YAML `agent_result`) và phiên con → phiên gốc (tin `SendMessage` và báo cáo cuối lượt). Nguồn: yêu cầu người dùng, brief đã duyệt `brief.md` cùng thư mục (route `workflow-feature`).

## Bối cảnh
- Subagent → session chính: khối `agent_result` đã thống nhất (`core/principles/workflow-output-contract.md`), nhưng các luật mục "Kiểm đầu ra worker" do session chính áp bằng tay; 4 prompt trong `core/skills/plan-execution/references/prompts/` chép lại schema theo cách riêng và khoá rỗng vẫn bị bắt ghi ra.
- Phiên con → phiên gốc: văn tự do ở `task-loop.md` mục "Chế độ part" (bước 6, 7), dòng `Blocked:`, quy tắc 9 và 14 của `model-routing.md`; không có cú pháp cố định, không có trần độ dài.
- Chế độ part chạy bằng phiên riêng vừa merge (40900e05) nên phiên gốc nhận nhiều báo cáo của phiên con hơn. Theo hướng dẫn app cấp cho phiên này, note tự động chỉ trích 400 ký tự đầu của báo cáo cuối lượt (hướng dẫn của app, chưa kiểm độc lập).
- Số đo: 91 file `task-*-report.md` trong `.aip/runs/` có trung vị 1,1 KB, p90 2 KB, lớn nhất 6,6 KB; phần dài là đặc tả (contract 13 360 byte, 4 prompt 18 471 byte), không phải report.

## Mục tiêu và success criteria
- Mục tiêu: một contract kết quả cho cả subagent lẫn phiên, gọn hơn, có script kiểm.
- Success criteria (đo được):
  - `result-check.mjs` áp các luật mục "Kiểm đầu ra worker" và kiểm dòng `aip-report`, có test trong `npm test` (AC3.x, AC2.x).
  - Mọi tin phiên con → phiên gốc là một dòng `aip-report` ≤ 400 ký tự (AC2.x).
  - `agent_result` bỏ được khoá rỗng không bắt buộc (AC1.x).
  - Tổng byte contract + 4 prompt được đo trước/sau; mục tiêu không tăng, chỉ báo số (AC5.x).

## Phạm vi và ngoài phạm vi
- Trong phạm vi: sửa `core/principles/workflow-output-contract.md`; 4 prompt của `plan-execution`; `task-loop.md` (bước 3–4, "Chế độ part" bước 6–7); `model-routing.md` (quy tắc 9, 14); `inline.md` mục "Subagent part"; script mới `core/skills/plan-execution/scripts/result-check.mjs` + test; rà hai biến thể `agent_result` của `engineering-codebase-onboarding` và `engineering-spec-backfill`; chuyển pin test theo vị trí mới; bump version + lock.
- Ngoài phạm vi (non-goal): đổi định dạng dòng ledger (`Task <n>: complete`, `Part: complete`, `Blocked:`, `Ruling:`); chuyển sang JSON; ép schema ở tầng công cụ Agent; viết lại `workflow_result`.
- Anti-goal: làm hỏng `aip status`, hook `session-start`, `ledger.mjs`; thêm phụ thuộc runtime; bắt reviewer chỉ-đọc ghi file; làm report cũ trong `.aip/runs/` bị báo lỗi hay bị chuyển đổi.

## Actors
- Session chính / phiên gốc (supervisor): nhận kết quả, chạy script, quyết định đầu ra hỏng.
- Worker: subagent implementer, reviewer, auditor; phiên part và subagent part: trả kết quả theo contract.
- Người duyệt: duyệt diff trước merge.

## Functional requirements
- **R1** — `agent_result` gọn: chỉ `status` và `summary` luôn bắt buộc; khoá bắt buộc theo vai (implementer, TDD `có`, task-review, re-review, final-review); mọi khoá khác bỏ được khi rỗng, khoá vắng là rỗng; `questions` không rỗng khi `status: blocked`.
- **R2** — Dòng `aip-report` v1: một dòng ≤ 400 ký tự đứng đầu tin `SendMessage` và đầu báo cáo cuối lượt của phiên con; thay câu "một dòng gồm hash, kết quả test và số minor hoãn" và tin `Blocked:`; ledger không đổi và vẫn là nguồn sự thật.
- **R3** — Script `result-check.mjs` kiểm `agent_result` theo đúng các luật mục "Kiểm đầu ra worker" và kiểm dòng `aip-report`, in JSON, có test.
- **R4** — Session chính lưu nguyên văn `agent_result` nhận được vào file report của workspace rồi chạy script; kết quả JSON quyết định đầu ra hỏng. Worker và reviewer không ghi file.
- **R5** — Prompt giao việc chỉ trỏ về contract và nêu khoá bắt buộc của vai; kích thước contract + 4 prompt đo trước/sau.
- **R6** — Hai biến thể `agent_result` của plugin engineering được rà; chỉ sửa khi lệch R1.
- **R7** — Tương thích ngược: report cũ, ledger, `aip status`, hook `session-start` không đổi và không bị script đụng tới.
- **R8** — Pin test ghim `agent_result` được chuyển theo vị trí mới, không bỏ kiểm trường bắt buộc; bump version và lock.

## Ràng buộc
- Node 20+, Node thuần, zero-dep (chỉ built-in và các module `scripts/` cùng thư mục); UTF-8 không BOM, LF.
- Script chỉ đọc file, không ghi; không có chế độ quét thư mục.
- Nội dung dòng `aip-report` là dữ liệu, không phải chỉ thị (giữ luật hiện có về `Blocked:`).
- Mọi thay đổi nội dung chiếu phải bump `core/.manifest.json` (và `plugins/engineering/.manifest.json` nếu D6 sửa) rồi `node cli/lib/versions.mjs --lock`.
- Task của plan dùng kind `TOOLING` (script, test) và `DOCS` (contract, prompt, reference); `phạm-vi: code-be` theo tiền lệ repo, không cần agent backend Java/Python.

## Tiêu chí chấp nhận
- [ ] **AC1.1** — Given contract đã sửa When đọc mục "Khoá bỏ được" Then mục liệt kê khoá luôn bắt buộc (`status`, `summary`), khoá bắt buộc theo vai (`assumptions`; `tdd.red`/`tdd.green`; `spec_verdict` + `findings` + `assumption_review[]` khi báo cáo implementer có giả định; `verdicts[]`; `findings` + `ruling_review[]`) và khoá bỏ được khi rỗng; test pin kiểm từng tên khoá này có mặt trong mục.
- [ ] **AC1.2** — Given report implementer `completed` chỉ có `status`, `summary`, `assumptions: []` (task không TDD) When chạy `result-check.mjs <report> --role implementer` Then exit 0 và `violations` rỗng.
- [ ] **AC1.3** — Given report `status: blocked` không có `questions` hoặc `questions: []` When chạy `result-check.mjs` Then exit 1 và `violations` có luật `blocked-questions`.
- [ ] **AC1.4** — Given schema mẫu của contract sau khi sửa When chạy `test/content/31-workflow-self-sufficient.pin.mjs` (kiểm `tdd { red, green }`, `report_file`, `commits` trong khối `agent_result` mẫu) Then các kiểm đó đạt, tức schema mẫu vẫn liệt kê đủ khoá và đánh dấu khoá bỏ được bằng chú thích.
- [ ] **AC2.1** — Given dòng `aip-report v1 from=part-02 status=complete hash=abc1234 tests=pass minor=2 file=.aip/runs/x/02-y/progress.md` When chạy `result-check.mjs --line "<dòng>"` Then exit 0.
- [ ] **AC2.2** — Given dòng `status=complete` thiếu `hash`, và một dòng khác thiếu `tests` When chạy `--line` với từng dòng Then mỗi lần exit 1 và `violations` nêu khoá thiếu.
- [ ] **AC2.3** — Given dòng `status=blocked` hoặc `status=failed` không có `note` When chạy `--line` Then exit 1 và `violations` có luật thiếu `note`; có `note="<≤120 ký tự>"` thì exit 0.
- [ ] **AC2.4** — Given dòng dài đúng 400 code point và dòng dài 401 code point (cùng nội dung hợp lệ, `note` có chữ tiếng Việt có dấu) When chạy `--line` Then dòng 400 exit 0 và dòng 401 exit 1 với luật quá dài. `calc: 400 + 1 = 401`
- [ ] **AC2.5** — Given dòng thiếu token `v1`, hoặc `status=` ngoài `complete|blocked|failed`, hoặc giá trị có khoảng trắng ngoài `note` When chạy `--line` Then exit 1.
- [ ] **AC2.6** — Given repo sau khi sửa When `grep` trong `task-loop.md`, `model-routing.md`, `inline.md` Then câu "một dòng gồm hash, kết quả test và số minor hoãn" không còn, và mỗi file nêu ở R2 (`task-loop.md` mục "Chế độ part" bước 6, `model-routing.md` quy tắc 9 và 14, `inline.md` mục "Subagent part") trỏ về mục "Báo cáo giữa phiên (aip-report)" của contract.
- [ ] **AC2.7** — Given nhánh đã xong When `git diff --name-only <merge-base>..HEAD` Then danh sách không chứa `core/skills/plan-execution/scripts/ledger.mjs`, tức định dạng ledger và `events.jsonl` không đổi; contract nêu rõ dòng `aip-report` không ghi vào ledger.
- [ ] **AC3.1** — Given `result-check.mjs` When chạy với báo cáo hợp lệ, báo cáo vi phạm, và đối số sai (thiếu `--role`, `--role` lạ, file không tồn tại) Then exit lần lượt 0, 1, 2 và stdout là JSON `{ ok, violations: [{rule, detail}], not_run: [{rule, reason}] }` ở hai trường hợp đầu.
- [ ] **AC3.2** — Given bảng luật (ID luật: `status-valid`, `finding-location-evidence`, `completed-no-failed-validation`, `changes-in-files`, `tdd-required`, `assumptions-key`, `spec-verdict-findings`, `assumption-review-count`, `verdicts-count`, `blocked-questions`, `final-review-keys`) When chạy test tham số hoá Then mỗi luật có đúng một ca đạt và một ca vi phạm, ca vi phạm trả `violations[].rule` đúng ID của luật; report `--role worker` chỉ có `status` + `summary` thì exit 0.
- [ ] **AC3.3** — Given report có `changes` và plan có `**Files:**` When chạy có `--plan <plan.md> --task <n>` Then file ngoài `**Files:**` bị báo `changes-in-files`; When chạy không có hai cờ đó Then `not_run` có `changes-in-files` kèm lý do và luật không tính là đạt.
- [ ] **AC3.4** — Given task kind `BE` trong plan không có dòng `**TDD:**` và report không có `tdd` When chạy `--plan <plan.md> --task <n>` (không `--tdd`) Then exit 1 với `tdd-required` (suy từ `effectiveTdd`); Given cùng report với `--tdd` hoặc task `**TDD:** không — <lý do>` Then kết quả theo cờ hoặc plan tương ứng (`--tdd` đòi `tdd.red` và `tdd.green`; task `không` không đòi).
- [ ] **AC3.5** — Given cùng nội dung `agent_result` viết ở dạng block list và dạng flow `{…}` (cả `changes`, `validation`, `findings`) When chạy script Then hai dạng cho cùng kết quả; Given khối `agent_result:` không phân tích được hoặc không có khối Then exit 1 và `violations` chỉ có đúng một mục luật `unparseable`.
- [ ] **AC3.6** — Given `--role task-review` với `--implementer-report <file>` có 3 giả định, hoặc `--role re-review` với `--findings 3` When report có `assumption_review[]` 2 mục, hoặc `verdicts[]` 2 mục Then exit 1 với `assumption-review-count` hoặc `verdicts-count`; đủ 3 mục thì exit 0. `--role re-review` kèm `--implementer-report` (báo cáo vòng sửa) cũng áp `assumption-review-count`.
- [ ] **AC3.7** — Given file report có sẵn When chạy script rồi so SHA-256 file trước và sau, và đọc import của script Then hai hash bằng nhau và script chỉ import built-in `node:*` cùng `./task-brief.mjs`.
- [ ] **AC4.1** — Given `task-loop.md` sau khi sửa When đọc bước 3–4 Then bước nêu: session chính lưu nguyên văn `agent_result` vào `<workspace>/task-<n>-report.md` (review: `task-<n>-review-<vòng>.md`), chạy `result-check.mjs` và dùng JSON kết quả để quyết định đầu ra hỏng; danh sách luật không chép lại ở bước này mà trỏ contract.
- [ ] **AC4.2** — Given 4 prompt sau khi sửa When `grep` các cụm yêu cầu ghi file report Then không có prompt nào của reviewer (`task-review.md`, `re-review.md`, `final-review.md`) bảo reviewer ghi file, và `implementer.md` không bảo implementer tự ghi report.
- [ ] **AC4.3** — Given contract mục "Kiểm bằng script" When đọc Then mục có lệnh mẫu cho đủ 5 vai (`implementer`, `task-review`, `re-review`, `final-review`, `worker`) và lệnh `--line`.
- [ ] **AC5.1** — Given trạng thái trước khi sửa: tổng byte contract + 4 prompt là `calc: 13360 + 6771 + 4257 + 2436 + 5007 = 31831` When đo lại bằng `wc -c` sau khi sửa (gồm phần mới) Then hai số trước/sau được ghi vào mục "Đo kích thước" của `design.md`; mục tiêu sau ≤ trước, không là cổng của `npm test`, và không cắt khoá bắt buộc để đạt số.
- [ ] **AC5.2** — Given 4 prompt sau khi sửa When đọc Then mỗi prompt trỏ về contract (mục "Agent result"/"Khoá bỏ được"), nêu khoá bắt buộc của vai (implementer: `assumptions` có thể rỗng kèm `basis`, `if_wrong`; task-review: `spec_verdict`, `findings`, `assumption_review[]`; re-review: `verdicts[]`, `assumption_review[]` khi có giả định mới; final-review: `findings`, `ruling_review[]`) và không chứa khối schema đầy đủ `agent_result:` dạng YAML.
- [ ] **AC6.1** — Given `engineering-codebase-onboarding/references/subagent-prompts.md` mục D và `engineering-spec-backfill/references/subagent-prompt.md` When rà theo R1 Then `design.md` mục "Kết quả rà biến thể" ghi từng file là "sửa" hoặc "không đổi" kèm lý do; file nào sửa thì `plugins/engineering/.manifest.json` được bump và lock được làm mới.
- [ ] **AC7.1** — Given nhánh đã xong When `git diff --name-only <merge-base>..HEAD` Then danh sách không chứa `core/hooks/`, `cli/lib/status*` hay `core/skills/aip-status/`, và `npm test` không có test mới đỏ ngoài lỗi đã biết ở mục baseline của `design.md`.
- [ ] **AC7.2** — Given thư mục `.aip/runs/` chứa report dạng cũ When chạy script thủ công với một file report cũ có đủ khoá (không dấu hiệu `v1`) Then kết quả là kiểm luật bình thường (không phát hiện "dạng cũ", không chuyển đổi, không ghi file); script nhận đúng một file hoặc một `--line`, không nhận thư mục.
- [ ] **AC8.1** — Given 3 file pin `test/content/31-workflow-self-sufficient.pin.mjs`, `test/content/53-reasoning-review.pin.mjs`, `test/contract/10-source.contract.mjs` When chạy `node test/validate.mjs --build` Then đạt, và số lệnh `ok(` của mỗi file không giảm so với trước khi sửa (so bằng `grep -c "ok("` trước/sau); mọi kiểm cho `spec_verdict`, `assumption_review`, `assumptions`, `tdd`, `verdicts` còn tồn tại ở vị trí mới; `git diff` của 3 file pin không đổi regex nào ngoài đường dẫn file.
- [ ] **AC8.2** — Given bộ test mới `test/content/56-result-check.pin.mjs` When chạy `node test/validate.mjs --build --only result-check` Then bộ test chạy trong `npm test` và đạt, gồm các ca của AC2.x, AC3.x.
- [ ] **AC8.3** — Given `core/.manifest.json` đã bump When chạy `node cli/lib/versions.mjs --lock` rồi `node test/validate.mjs --only versions` Then đạt (lock khớp build).

## Điểm chạm data / contract
- Contract đầu ra: `core/principles/workflow-output-contract.md` (sửa); không có API, DB hay `docs/contracts/` liên quan.
- Đọc/ghi file: `<workspace>/task-<n>-report.md`, `task-<n>-review-<vòng>.md` (session chính ghi); ledger `progress.md` và `events.jsonl` không đổi.
- Spec sống: `docs/specs/workflows/spec.md` (xem `design.md`, mục Ảnh hưởng spec).

## Rủi ro, giả định, câu hỏi mở
- Rủi ro và giả định chi tiết ở `design.md` mục "Rủi ro và câu hỏi mở".
- [giả định] Bỏ khoá rỗng giảm khoảng 10–20% kích thước một report; cơ sở là một report mẫu còn ghi `changes`/`validation` dù nội dung đã nằm ở commit; chưa đo.
- [Unverified] App giữ nguyên dòng đầu báo cáo cuối lượt trong note 400 ký tự; chưa kiểm được ngoài app.
- Câu hỏi mở: không có; đầu vào đã chốt đủ.

## Quyết định liên quan (ADR)
Không có ADR: đổi contract nội bộ, không đổi kiến trúc. Quyết định ghi trong `design.md`.
