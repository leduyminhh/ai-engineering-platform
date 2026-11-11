# Thiết kế: hỏi cách thực thi trước vòng task và review part trước merge
- Ngày: 2026-11-03
- Trạng thái: abandoned — thay bằng 2026-11-11-ask-execution-mode (phần review part trước merge chưa làm)
- Requirement: không có

## Vấn đề và lý do

Đã kiểm trong code (mọi mô tả "hiện tại" dưới đây dựa trên các điểm này):
- `core/skills/plan-execution/references/inline.md:12` ghi "Không hỏi người dùng chọn cách thực thi". Plan không chia part
  vì vậy chạy vòng task có subagent mà không có câu hỏi nào.
- `core/skills/plan-execution/SKILL.md:65` (hàng "Chế độ inline" của bảng "Ai làm gì") ghi "không hỏi người dùng chọn cách thực thi".
- `core/skills/plan-execution/references/task-loop.md`, mục "Chế độ part", bước 3: `partRunner: subagent` không hỏi. Bước 7
  merge `Part: complete <hash>` ngay khi subagent báo xong, chỉ chạy full suite. Review duy nhất của part đó là review cuối
  toàn nhánh.
- `AGENTS.md:152` (xuống dòng giữa "how to" và "execute") và `CLAUDE.md:111` ghi "do not ask again how to execute once the plan
  is approved". Câu về merge part "not asked when `autonomy.partRunner` is `subagent`" từng nằm ở `AGENTS.md:220`; request
  `2026-11-03-baseline-slim` (master 41c54e49) đã dời mục Parallel agents sang `core/skills/git-worktree/references/parallel-agents.md:13`
  và baseline chỉ còn dòng trỏ (`AGENTS.md:169`, không còn "partRunner"). Pin `test/content/32-superpowers-gap.pin.mjs`
  (AC5.1) giữ câu "Không hỏi người dùng chọn cách thực thi".
- Baseline đã kín 200/200 dòng (`AGENTS.md` và `core/agents/AGENTS.template.md`; contract `test/contract/30-templates.contract.mjs`
  đặt `MAX = 200`): mọi sửa baseline của request này phải đổi tại chỗ hoặc tự nhường chỗ, không thêm dòng ròng.

Yêu cầu của người dùng (2026-11-03):
1. Bắt buộc hỏi chọn cách thực thi (tuần tự hay subagent) trước khi `plan-execution` chạy vòng task.
2. Thêm cổng review part trước merge cho chế độ subagent.

[Inference] Nếu không làm: người dùng không chọn được cách chạy, và lỗi trong part subagent chỉ bị bắt ở review cuối toàn
nhánh, khi part đã nằm trong `feature/<slug>`, nên việc cô lập lỗi theo part khó hơn. Dựa trên cấu trúc luồng đã đọc; chưa đo
trên trial.

## Quyết định đã chốt

Người dùng chốt:
- **R1** — Hỏi cách thực thi gộp vào thẻ G2: thẻ duyệt plan có lựa chọn duyệt kèm cách thực thi. Nội dung thẻ nằm ở hàng G2 của
  `ask-user.md` (xem Thiết kế). Lối dự phòng: khi `plan-execution` được gọi mà ledger `root/` chưa có dòng ghi lựa chọn (gọi
  trực tiếp; cỡ "thay đổi nhỏ" không có G2) thì hỏi ở bước Chuẩn bị bằng thẻ lựa chọn trước task đầu. Làm tiếp từ ledger đã có
  lựa chọn thì không hỏi lại. Lựa chọn ghi vào ledger `root/` bằng dòng `Ruling: cách thực thi — <giá trị> — <lý do>`.
- **R2** — Plan không chia part (kể cả "thay đổi nhỏ"): hai lựa chọn "Subagent từng task" (vòng task hiện tại, review từng
  task) và "Tuần tự (inline, chỉ review cuối)" (session chính làm mọi task theo `inline.md`, chỉ review cuối). Không có tool
  subagent thì không hỏi, chạy inline như cũ và ghi `Ruling:` kèm lý do.
- **R3** — Plan có part: mỗi nhóm Song song hỏi ba lựa chọn Tuần tự / Subagent / Phiên riêng (giữ `session`). Gộp: ở G2 hỏi
  một lần cho request, áp cho mọi nhóm. Nhóm bị `check-partition` báo P1/P2/P4 vẫn chạy tuần tự bất kể lựa chọn.
- **R4** — Khoá `autonomy.partRunner` không còn bỏ qua câu hỏi: luôn hỏi. Giá trị khoá chỉ quyết định lựa chọn đứng đầu và gắn
  "(khuyến nghị)" (`subagent` → Subagent; `sequential` → Tuần tự; `session` hoặc thiếu → Phiên riêng cho part). Khoá
  `mergeLocal`, `cleanup` giữ nguyên. Câu trả lời chọn Subagent hoặc Phiên riêng vẫn là sự đồng ý tạo worktree và
  `merge --no-ff` nhánh part vào `feature/<slug>`, thay cho việc khoá subagent ngầm đồng ý. Không đổi schema khoá hay
  `autonomy.mjs`/`cli/lib/autonomy.mjs`; nếu text của `aip autonomy` mô tả "không hỏi" thì sửa câu chữ.
- **R5** — Review part trước merge (chỉ khi part chạy Subagent): khi thấy `Part: complete <hash>`, trước `merge --no-ff`, session
  gốc giao một reviewer (`backend-reviewer` / `frontend-reviewer` theo phía đụng; diff không chạm BE/FE thì `general-purpose`;
  `model: sonnet`) dùng mẫu prompt. Đầu vào: diff của part, plan của part, AC mà part phủ. Reviewer trả `spec_verdict` và
  finding. `blocker`/`major` trong phạm vi, hoặc `spec_verdict` khác `compliant`, thì giao subagent mới (`general-purpose`,
  `sonnet`) tiếp từ ledger part trong worktree cũ để sửa và commit trên nhánh part, rồi re-review có phạm vi; tối đa 2 vòng; quá
  thì vào mục "Part vướng" như lỗi chặn (hàng người dùng). Sạch thì merge như cũ. Review part có thể chạy song song với part khác
  đang code. Phiên riêng và Tuần tự đã có review từng task nên không có review part. Review cuối toàn nhánh giữ nguyên.
- **R6** — Sửa xung đột: `AGENTS.md` và `core/agents/AGENTS.template.md` (giữ byte-identical) cùng `CLAUDE.md` bỏ "do not ask
  again how to execute", thay bằng quy tắc hỏi một lần ở G2 (đổi tại chỗ, không thêm dòng: baseline đã 200/200). Câu "not asked
  when `autonomy.partRunner` is `subagent`" nay nằm ở `core/skills/git-worktree/references/parallel-agents.md:13` (baseline
  chỉ còn dòng trỏ), sửa ở đó theo R4; không đưa câu về `partRunner` trở lại baseline. `inline.md` bỏ "Không hỏi người dùng chọn cách thực thi", thêm điều kiện bật thứ ba "người dùng
  chọn Tuần tự". Pin AC5.1 của `32-superpowers-gap.pin.mjs` đổi theo (pin cũ vô hiệu vì hành vi đổi theo yêu cầu người dùng).
- **R7** — Spec sống bị ảnh hưởng: `docs/specs/workflows/spec.md` (R7, R14 và requirement liên quan plan-execution),
  `docs/specs/hooks-gates/spec.md` R15 (nghĩa khoá `partRunner`), `docs/specs/cli-wizard/spec.md` R6 nếu câu chữ nói "không hỏi".
- **R8** — Version gate: bump `core/.manifest.json`, `workflows/.manifest.json` (vì workflows đổi) và plugin `engineering` (vì
  `engineering-plan-writing` đổi); chạy `node cli/lib/versions.mjs --lock` sau build. Đưa vào Ràng buộc.

*Quyết định của agent* (người dùng chưa xét riêng; đảo được ở bước duyệt G1):
- **A1** — Thẻ G2 là một lần gọi công cụ hỏi có hai câu: câu duyệt (Duyệt plan / Sửa plan / Dừng) và câu cách thực thi, chỉ
  đọc khi chọn Duyệt. Không ghép thành lựa chọn tổ hợp (duyệt × cách thực thi): số lựa chọn sẽ vượt mức 2–4 của `ask-user.md`
  và trộn hai loại quyết định.
- **A2** — Plan có part: một câu cho cả request, không theo nhóm. Nếu Bảng part không có nhóm Song song thì không hỏi, chạy tuần
  tự và ghi `Ruling: cách thực thi — sequential — không có nhóm Song song`.
- **A3** — Giá trị ghi trong ledger: plan không part `subagent` | `inline`; plan có part `sequential` | `subagent` | `session`
  (áp cho mọi nhóm). Lý do thứ ba là `người dùng chọn`, `không có tool subagent` hoặc `không có nhóm Song song`. Dòng `Ruling:`
  không có mẫu trong `EVENT_FORMATS` của `ledger.mjs` (đã kiểm), nên không cần đổi validator.
- **A4** — Nhãn tách hai nghĩa của "Tuần tự": plan không part là "Tuần tự (inline, chỉ review cuối)", ghi `inline`; plan có part là
  "Tuần tự (session gốc, review từng task)", ghi `sequential` và chạy vòng task như `task-loop.md` bước 8. Hai nhãn khác nhau để
  người duyệt không nhầm (xem Rủi ro).
- **A5** — Ghi `Ruling:` trước `Task 1: start`, sau khi ledger được tạo ở bước Chuẩn bị (xem Thiết kế, mục Lối dự phòng).
- **A6** — Mẫu prompt mới `core/skills/plan-execution/references/prompts/part-review.md` thay vì mở rộng `task-review.md`: đầu
  vào của `task-review.md` là brief từng task và báo cáo implementer, không khớp diff gộp nhiều task. Mẫu mới giữ cùng
  `agent_result`, cùng thang severity và cùng nhãn `trong AC` / `ngoài AC`, và trỏ tới đoạn ranh giới tin cậy như hai mẫu hiện có
  (`task-review.md` mục 6, `final-review.md` mục 8).
- **A7** — Part chạm cả BE lẫn FE thì reviewer là `general-purpose`, một reviewer đọc cả hai phía. [giả định] Mẫu task-review
  giao một reviewer mỗi task, không khớp một part nhiều task.
- **A8** — Vòng sửa của part dùng đúng giao thức "Subagent part" của `inline.md`, không tạo chế độ mới.
- **A9** — Dòng review part ghi vào ledger của part, không vào `root/`, và ghi ở **mỗi vòng** review: `Part review: <vòng>
  <spec_verdict> <blocker>/<major>/<minor>`. `cli/lib/status.mjs` đọc `Part: complete`, `Part NN…: merged`, `Blocked:`,
  `Unblocked:`, `Task N:`; dòng `Part review:` không khớp mẫu nào trong số đó (đã kiểm).
- **A10** — Đường đã cân nhắc và bị loại:
  - (a) Cổng hỏi riêng sau G2: thêm một lần dừng; người dùng không thấy lựa chọn trong thẻ duyệt plan.
  - (b) Hỏi muộn trong `plan-execution` (không đặt ở G2): người dùng đã duyệt plan mà chưa biết cách chạy.
  - (c) Review part sau merge: lỗi đã vào `feature/<slug>`, không cô lập được.
  - (d) Gộp review part vào review cuối: review cuối thấy toàn nhánh nên bắt lỗi muộn hơn và không biết part nào.
  - Chọn: G2 gộp (R1); review part trước merge (R5).
- **A11** — Không ghi ADR: chỉ thị của request này là ghi duy nhất `design.md`. Cách hỏi người dùng có thể đáng lưu lâu dài; đề
  xuất ADR ở bước gộp để người duyệt quyết.
- **A12** — Bump patch: `core` 1.26.12 → 1.26.13, `workflows` 3.14.11 → 3.14.12, `engineering` 2.10.9 → 2.10.10. [giả định] Theo mẫu
  patch của các request trước.
- **A13** — `cli-wizard/R6` không đổi: đã kiểm, spec và `cli/index.mjs:242–244` không có câu "không hỏi". `hooks-gates/R15` đổi
  vì nghĩa của `partRunner` đổi (không còn quyết định việc hỏi).
- **A14** — README: câu "parallel parts run as background subagents" (`README.md:435`, `README_VI.md:428`) nêu thêm rằng cách chạy
  do lựa chọn ở G2 quyết định, khoá `partRunner` chỉ đặt lựa chọn đứng đầu.
- **A15** — AC đánh số theo R của request này (AC1.x là R1, …), không theo R của spec sống. Sau khi gộp còn 20 AC, đánh số lại
  liền mạch trong từng R.
- **A16** — Request có part nhưng không có `plan.md` gốc: ghi Ruling bằng `ledger.mjs <thư mục request>`, vì `ledger.mjs` nhận
  thư mục và `workspace.mjs` đặt part mặc định là `root`. [giả định] Đã đọc code, chưa chạy: `ledger.mjs` có thể yêu cầu `plan.md`
  tồn tại; builder kiểm khi triển khai.
- **A17** — Ledger part có thể có nhiều dòng `Part: complete` sau các vòng sửa; `merge` lấy hash của dòng cuối cùng.
- **A18** — Review part còn `blocker`/`major` trong phạm vi sau 2 vòng sửa: session gốc ghi `Blocked: <lý do>` vào ledger part
  (đúng mẫu `Blocked: \S` của `ledger.mjs`), dừng nhóm, không merge, và đưa vào mục "Part vướng" như hàng người dùng.

## Tiêu chí chấp nhận

Số đầu `n` của mỗi AC là số R trong mục "Quyết định đã chốt" của request này.

- [ ] **AC1.1** — Given plan đã viết (cỡ dự án) When session trình G2 Then thẻ là một lần gọi công cụ hỏi có hai câu: duyệt và cách thực thi; nội dung và thứ tự lựa chọn chỉ có ở hàng G2 của `ask-user.md`; `engineering-plan-writing` bước 7 và `WORKFLOW.md` Bước 4 chỉ trỏ tới hàng đó (kiểm bằng pin nội dung)
- [ ] **AC1.2** — Given `plan-execution` chạy bước Chuẩn bị và ledger chưa có dòng `Ruling: cách thực thi —`, và session chưa có câu trả lời G2 When có tool subagent Then hỏi bằng thẻ lối dự phòng trước `Task 1: start`; When không có tool subagent Then không hỏi và ghi `Ruling: cách thực thi — inline — không có tool subagent` (kiểm bằng pin nội dung trên `SKILL.md` và hàng "Cách thực thi (lối dự phòng)" của `ask-user.md`)
- [ ] **AC1.3** — Given ledger `root/` đã có dòng `Ruling: cách thực thi —` ở bất kỳ vị trí nào, kể cả phần đã bị hook cắt When phiên resume Then không hỏi lại; và Given câu trả lời G2 có trong session và ledger vừa được tạo When ghi Ruling Then ghi ngay, không hỏi câu thứ hai (kiểm bằng pin nội dung: `SKILL.md` nêu grep toàn bộ ledger `root/`)
- [ ] **AC1.4** — Given dòng `Ruling: cách thực thi — <giá trị> — <lý do>` với giá trị hợp lệ When gọi `ledger.mjs` Then exit 0 và `validateLine` không đổi; `task-loop.md` và `SKILL.md` ghi đúng mẫu dòng này và mẫu `Part review:` (kiểm bằng pin 39 gọi `main` với tệp tạm và pin nội dung)
- [ ] **AC2.1** — Given plan không có `## Bảng part` When hỏi cách thực thi Then đúng hai lựa chọn: "Subagent từng task" (khuyến nghị đứng đầu, ghi `subagent`) và "Tuần tự (inline, chỉ review cuối)" (ghi `inline`)
- [ ] **AC2.2** — Given `inline` được chọn hoặc lối dự phòng "không có tool subagent" When chạy task Then không giao reviewer từng task và review cuối vẫn chạy; `inline.md` nêu đủ ba điều kiện bật ("người dùng nói rõ", "không có tool subagent", "người dùng chọn Tuần tự ở G2") và không còn "Không hỏi người dùng chọn cách thực thi" (kiểm bằng pin nội dung)
- [ ] **AC3.1** — Given plan có `## Bảng part` và có nhóm Song song When hỏi cách thực thi Then một câu duy nhất cho cả request với ba lựa chọn "Tuần tự (session gốc, review từng task)" / "Subagent" / "Phiên riêng", ghi `sequential` / `subagent` / `session`, áp cho mọi nhóm; Given Bảng part không có nhóm Song song When chạy Then không hỏi, chạy tuần tự và ghi `Ruling: cách thực thi — sequential — không có nhóm Song song`
- [ ] **AC3.2** — Given `partRunner` là `subagent`, `sequential`, `session` hoặc thiếu khoá When hỏi cách thực thi cho plan có part Then vẫn hỏi (khoá không bỏ qua câu hỏi) và lựa chọn đứng đầu có "(khuyến nghị)" tương ứng: Subagent, Tuần tự, Phiên riêng (kiểm bằng pin nội dung trên `task-loop.md` "Chế độ part" bước 3)
- [ ] **AC3.3** — Given nhóm Song song bị `check-partition.mjs` báo P1, P2 hoặc P4 When chạy Then nhóm đó chạy tuần tự bất kể lựa chọn, như `task-loop.md` hiện có
- [ ] **AC3.4** — Given người dùng chọn Subagent hoặc Phiên riêng When part bắt đầu Then đó là đồng ý tạo worktree và `merge --no-ff` nhánh part vào `feature/<slug>` (merge local); push và merge vào nhánh gốc chỉ ở bước kết thúc nhánh
- [ ] **AC4.1** — Given `cli/lib/autonomy.mjs`, `core/skills/plan-execution/scripts/autonomy.mjs` và schema khoá `autonomy` When sau thay đổi Then không đổi, và `test/content/34-autonomy-gates.pin.mjs` vẫn xanh không sửa
- [ ] **AC5.1** — Given part Subagent có `Part: complete` When trước `merge --no-ff` Then session gốc tính `<merge-base>` = `git merge-base feature/<slug> worktree-<slug>-p<nn>`, gom diff qua `review-package.mjs <merge-base> worktree-<slug>-p<nn> --plan parts/<nn>-<part-slug>/plan.md` (`review-package.mjs` nhận base là tổ tiên, không nhận range ba chấm), rồi giao reviewer theo `prompts/part-review.md` với plan của part và AC part phủ; reviewer chọn theo A7; `model: sonnet`; hash để merge là dòng `Part: complete` cuối cùng của ledger part
- [ ] **AC5.2** — Given review trả `spec_verdict` khác `compliant`, hoặc có finding `blocker`/`major` trong phạm vi When xử lý Then giao subagent mới (`general-purpose`, `sonnet`) sửa trong worktree cũ và commit trên nhánh part, re-review có phạm vi; tối đa 2 vòng sửa; còn lỗi sau 2 vòng thì session gốc ghi `Blocked:` vào ledger part, dừng nhóm, đưa vào mục "Part vướng" và không merge
- [ ] **AC5.3** — Given mỗi vòng review part, kể cả vòng dẫn tới sửa When ghi kết quả Then ledger part nhận dòng `Part review: <vòng> <spec_verdict> <blocker>/<major>/<minor>` (`ledger.mjs` exit 0 và `validateLine` không đổi); review sạch thì merge như cũ; `task-loop.md` ghi đúng mẫu dòng này (kiểm bằng pin 39)
- [ ] **AC5.4** — Given part chạy Phiên riêng hoặc Tuần tự When merge Then không chạy review part; `task-loop.md` nêu rõ điều này
- [ ] **AC6.1** — Given `AGENTS.md`, `core/agents/AGENTS.template.md`, `CLAUDE.md` và `core/skills/git-worktree/references/parallel-agents.md` When sau thay đổi Then (a) không tệp nào trong bốn tệp còn "do not ask again how to execute" (so sau khi gộp xuống dòng, vì `AGENTS.md` xuống dòng giữa "how to" và "execute"); (b) không tệp nào còn "not asked when `autonomy.partRunner`", và `parallel-agents.md` (nơi câu này nằm sau baseline-slim) nêu khoá `partRunner` chỉ đặt lựa chọn đứng đầu còn merge part là đồng ý theo lựa chọn ở G2; (c) `cmp AGENTS.md core/agents/AGENTS.template.md` báo giống nhau, hai tệp vẫn ≤ 200 dòng theo `test/contract/30-templates.contract.mjs` và vẫn giữ dòng trỏ tới `git-worktree` / `references/parallel-agents.md`; (d) `CLAUDE.md` có quy tắc hỏi một lần ở G2
- [ ] **AC6.2** — Given `test/content/32-superpowers-gap.pin.mjs` AC5.1 When sau thay đổi Then điều kiện "người dùng nói rõ" và "không có tool subagent" vẫn được kiểm trên `inline.md`; cặp kiểm "Không hỏi người dùng chọn cách thực thi" và `!/hỏi (người dùng )?(chọn|có muốn) (cách )?(thực thi|chạy) inline/i` được thay bằng pin 39, và pin 32 vẫn xanh
- [ ] **AC6.3** — Given `README.md` và `README_VI.md`, mục Autonomy When đọc Then câu về part subagent nêu lựa chọn ở G2 quyết định cách chạy, không còn ngụ ý chạy nền mà không hỏi
- [ ] **AC7.1** — Given bước gộp của request này When cập nhật spec sống Then `docs/specs/workflows/spec.md` có R18, R19 mới và bản đổi của R7, R12, R14; `docs/specs/hooks-gates/spec.md` có R15 đổi; `docs/specs/baseline/spec.md` có R6, R8 đổi; mỗi mục có dòng trong bảng Lịch sử trỏ tới request này; `check-request.mjs` trên thư mục request không báo W10, W11, W12, W14
- [ ] **AC8.1** — Given sau thay đổi projected content When chạy `npm run build`, `node cli/lib/versions.mjs --lock` và `npm test` Then `core`, `workflows`, `engineering` có version lớn hơn 1.26.12, 3.14.11, 2.10.9 và `npm test` exit 0

## Thiết kế

### Thẻ G2 (R1–R4)

Nội dung thẻ (câu hỏi, nhãn, thứ tự, mô tả hệ quả) chỉ viết ở hàng G2 của `core/skills/plan-execution/references/ask-user.md`.
`engineering-plan-writing` bước 7 và `workflows/feature/WORKFLOW.md` Bước 4 và bảng Checkpoint chỉ trỏ tới hàng đó, không chép
lựa chọn. Bảng dưới là đặc tả để kiểm, không phải nguồn sao chép.

Một lần gọi công cụ hỏi có hai câu (A1):
1. Duyệt: Duyệt plan / Sửa plan / Dừng.
2. Cách thực thi, chỉ đọc khi chọn Duyệt:
   - Plan không có `## Bảng part`: "Subagent từng task" (khuyến nghị, ghi `subagent`); "Tuần tự (inline, chỉ review cuối)" (ghi `inline`).
   - Plan có part và có nhóm Song song: "Tuần tự (session gốc, review từng task)" (`sequential`); "Subagent" (`subagent`);
     "Phiên riêng" (`session`). Lựa chọn đứng đầu theo `partRunner` (R4).
   - Plan có part nhưng không có nhóm Song song: không có câu hỏi (A2).

### Lối dự phòng và resume (R1, A5, A16)

Bước Chuẩn bị của `plan-execution` làm theo thứ tự:
1. Grep toàn bộ ledger `root/` (không chỉ phần cuối; hook chỉ chèn tối đa 2000 ký tự cuối) tìm `^Ruling: cách thực thi —`.
   Có thì dùng giá trị đó, không hỏi.
2. Không có, và session đã có câu trả lời G2: ghi ngay Ruling khi ledger được tạo, không hỏi câu thứ hai.
3. Không có, không có câu trả lời trong session, có tool subagent: hỏi một câu bằng thẻ "Cách thực thi (lối dự phòng)" của `ask-user.md`, rồi ghi.
4. Không có tool subagent, không hỏi: plan không part ghi `Ruling: cách thực thi — inline — không có tool subagent`; plan có part
   ghi `Ruling: cách thực thi — sequential — không có tool subagent` (không có subagent thì không có part Subagent hay Phiên riêng).
5. Có tool subagent nhưng Bảng part không có nhóm Song song: không hỏi, ghi `Ruling: cách thực thi — sequential — không có nhóm Song song`.

Vị trí ghi: có `plan.md` gốc → `ledger.mjs <plan.md>`; không có `plan.md` gốc nhưng có part → `ledger.mjs <thư mục request>` (A16).
Dòng Ruling đứng trước `Task 1: start` đầu tiên của ledger `root/`.

### Chạy theo lựa chọn (R2, R3, R5)

| Plan | Lựa chọn | Giá trị | Vòng task | Review |
|---|---|---|---|---|
| Không part | Subagent từng task | `subagent` | như `task-loop.md` hiện có | từng task + cuối |
| Không part | Tuần tự (inline, chỉ review cuối) | `inline` | `inline.md` | cuối (tự review nếu không có subagent) |
| Có part | Subagent | `subagent` | part subagent theo `inline.md` ("Subagent part") | review part trước merge (mới) + cuối |
| Có part | Tuần tự (session gốc, review từng task) | `sequential` | `task-loop.md` bước 8 | từng task + cuối |
| Có part | Phiên riêng | `session` | `task-loop.md` bước 6 | từng task + cuối |

Nhóm bị P1/P2/P4 luôn chạy tuần tự (AC3.3).

### Review part trước merge (R5, A7, A9, A17, A18)

1. Thấy `Part: complete` trong ledger của part subagent; hash là dòng cuối cùng của loại dòng này (A17).
2. Tính `<merge-base>` = `git merge-base feature/<slug> worktree-<slug>-p<nn>`. Gom diff của khoảng `<merge-base>..worktree-<slug>-p<nn>`
   bằng `review-package.mjs <merge-base> worktree-<slug>-p<nn> --plan parts/<nn>-<part-slug>/plan.md`. Lý do: script kiểm base là
   tổ tiên của head, không nhận range ba chấm.
3. Giao reviewer (A7) theo `references/prompts/part-review.md` (A6). Reviewer chỉ đọc.
4. Xếp finding theo mục "Nhận review" của `task-loop.md`: trong phạm vi vào vòng sửa; ngoài AC không đổi hành vi ghi `minor
   (deferred)`; ngoài AC đổi hành vi vào thẻ G3. Chỉ finding trong phạm vi và `spec_verdict` khác `compliant` mới vào vòng sửa.
5. Ghi `Part review: <vòng> <spec_verdict> <blocker>/<major>/<minor>` vào ledger part ở mỗi vòng (A9).
6. Vòng sửa: subagent mới theo `inline.md` "Subagent part" (A8), commit trên nhánh part, re-review có phạm vi. Tối đa 2 vòng.
   Sau 2 vòng vẫn còn lỗi: ghi `Blocked: <lý do>` vào ledger part, dừng nhóm, đưa vào mục "Part vướng" như hàng người dùng
   (A18).
7. Sạch: `merge --no-ff` như bước 7 hiện có, dùng hash từ bước 1.

Review part không chặn các part khác đang code, vì chạy trên nhánh part đã có `Part: complete`.

### Mục đổi trong skill, workflow và pin (file map)

- `core/skills/plan-execution/SKILL.md`: bước Chuẩn bị (grep Ruling, lối dự phòng, A16); bước 2 (chờ Ruling trước vòng task);
  dòng 65 (hàng "Chế độ inline" của bảng "Ai làm gì": bỏ "không hỏi người dùng chọn cách thực thi", thêm điều kiện "người dùng
  chọn Tuần tự"); mục "Điểm dừng và báo cáo" (câu hỏi cách chạy part → cách thực thi ở G2); dòng 81 (đồng ý merge do lựa chọn ở G2).
- `core/skills/plan-execution/references/ask-user.md`: đoạn mở đầu (dòng 4), hàng G2 (toàn bộ nội dung thẻ, A1), thêm hàng
  "Cách thực thi (lối dự phòng)", bỏ hàng "Cách chạy part".
- `core/skills/plan-execution/references/task-loop.md`: dòng 119 và 127–129 (điểm dừng), "Chế độ part" bước 3 (bỏ hỏi, thay bằng
  khoá đứng đầu), bước 6, bước 7 (review part trước merge với Subagent, mẫu `Part review:`), bảng "Part vướng" (hàng mới cho
  review part hết 2 vòng, ghi `Blocked:`).
- `core/skills/plan-execution/references/inline.md`: dòng 12–13 (bỏ "không hỏi", thêm điều kiện "người dùng chọn Tuần tự");
  dòng 16 (Ruling đầu ledger thay bằng tham chiếu dòng `root/`, mẫu chung); mục "Subagent part" (vòng sửa part, hash dòng cuối).
- `core/skills/plan-execution/references/prompts/part-review.md`: mới (A6).
- `core/skills/git-worktree/SKILL.md` dòng 21: câu trả lời "phiên riêng hay tuần tự" ở G2 thay câu hỏi tạo worktree.
- `core/agents/AGENTS.template.md` và `AGENTS.md` (byte-identical): chỉ dòng 152 (Execution, đổi tại chỗ trong cùng hai dòng).
  Dòng trỏ Parallel agents (169) không đổi. Baseline đã 200/200 dòng (contract `30-templates`), nên không thêm dòng.
- `core/skills/git-worktree/references/parallel-agents.md` dòng 13: bỏ "not asked when `autonomy.partRunner` is `subagent`", thay
  bằng: việc merge part được duyệt bằng lựa chọn ở G2 (lối dự phòng `plan-execution` khi không qua G2), khoá `partRunner` chỉ đặt
  lựa chọn đứng đầu (R4). Đây là nơi duy nhất còn nói về khoá này; core bump đã có trong A12.
- `CLAUDE.md` (repo, không được projected): dòng 111.
- `workflows/feature/WORKFLOW.md`: Bước 4 (G2 hỏi cách thực thi, trỏ tới `ask-user.md`), Bước 5 (dòng 159–162: bỏ "thiếu khoá thì hỏi
  một lần trước mỗi nhóm"), dòng 168 (ngoại lệ subagent part), bảng Checkpoint hàng 4 (G2), đoạn Checkpoint (dòng 246, 255–256).
- `plugins/engineering/skills/engineering-plan-writing/SKILL.md` dòng 50 (bước 7 Checkpoint plan): chỉ trỏ tới hàng G2 của
  `ask-user.md`, không chép lựa chọn.
- `README.md:435`, `README_VI.md:428`: câu về part subagent (A14).
- `core/.manifest.json`, `workflows/.manifest.json`, `plugins/engineering/.manifest.json`: bump (A12); `plugins/_versions.lock.json`:
  `node cli/lib/versions.mjs --lock`.
- `test/content/32-superpowers-gap.pin.mjs` AC5.1: giữ kiểm "người dùng nói rõ" và "không có tool subagent" trên `inline.md`;
  thay cặp kiểm "Không hỏi người dùng chọn cách thực thi" và `!/hỏi (người dùng )?(chọn|có muốn) (cách )?(thực thi|chạy) inline/i`
  bằng pin 39 (AC6.2). Pin 32 đổi, không thêm pin song song.
- `test/content/39-execution-mode-choice.pin.mjs`: mới (mục Kiểm thử).
- Spec sống (bước gộp): `docs/specs/workflows/spec.md`, `docs/specs/hooks-gates/spec.md`, `docs/specs/baseline/spec.md` (AC7.1).

Không đổi: `core/skills/plan-execution/scripts/ledger.mjs`, `scripts/autonomy.mjs`, `scripts/review-package.mjs`, `cli/lib/autonomy.mjs`,
`cli/index.mjs`, mọi hook trong `core/hooks/`, `prompts/final-review.md`, `prompts/task-review.md`.

### Nội dung R18 và R19 (spec sống, viết ở bước gộp)

- **R18 (workflows)**: cách thực thi được hỏi ở G2 (hàng G2 của `ask-user.md`) hoặc ở lối dự phòng khi `plan-execution` chạy
  không qua G2. Lựa chọn ghi thành một dòng `Ruling: cách thực thi — <giá trị> — <lý do>` trong ledger `root/` trước
  `Task 1: start`. Làm tiếp không hỏi lại khi dòng đã có trong toàn bộ ledger `root/`. Khoá `partRunner` chỉ đặt lựa chọn đứng đầu.
- **R19 (workflows)**: part chạy Subagent có review part trước merge: reviewer chỉ đọc, prompt `part-review.md`, diff
  `<merge-base>..worktree-<slug>-p<nn>`. Blocker/major trong phạm vi hoặc `spec_verdict` không `compliant` thì vòng sửa, tối đa
  2 vòng; mỗi vòng ghi `Part review:`; hết giới hạn thì ghi `Blocked:` vào ledger part và đưa vào hàng người dùng. Phiên riêng và
  Tuần tự không có review part.

## Ảnh hưởng spec
- baseline: đổi R6, đổi R8
- workflows: đổi R7, đổi R12, đổi R14, thêm R18, thêm R19
- hooks-gates: đổi R15

Nội dung R18 và R19 xem mục Thiết kế, "Nội dung R18 và R19". `cli-wizard` không có dòng ảnh hưởng (A13).

## Ngoài phạm vi và anti-goal
- Trial thật chế độ subagent (dựng repo trial mới, tốn model) không nằm trong request này; là follow-up sau khi duyệt (xem Rủi ro).
- Không đổi hook, `ledger.mjs`, schema khoá `autonomy`, review cuối toàn nhánh, số vòng sửa của task (3 vòng).
- Không thêm eval case mới.
- Anti-goal: bỏ câu hỏi cách thực thi khi người dùng không chọn, hoặc bỏ review part để chạy nhanh hơn.

## Ràng buộc
- Giữ nguyên, đã kiểm trong thiết kế: P1/P2/P4 chạy tuần tự; `mergeLocal` và `cleanup` không đổi; review cuối toàn nhánh
  không đổi; push luôn hỏi và chỉ ở bước kết thúc nhánh; không merge hay push khi người dùng chưa chọn.
- `AGENTS.md` giữ byte-identical với `core/agents/AGENTS.template.md`, và cả hai không vượt 200 dòng (đang 200/200; contract
  `test/contract/30-templates.contract.mjs`). Sửa baseline chỉ đổi tại chỗ; cần thêm dòng thì tự nhường chỗ.
- Zero-dependency; không thêm script mới; không đổi `cli/`.
- Bump theo A12, chạy `node cli/lib/versions.mjs --lock` sau build, `npm test` xanh trước khi báo hoàn thành.
- Tiếng Việt có dấu, UTF-8 không BOM, LF.

## Kiểm thử
- AC1.1–AC1.3, AC2.1, AC2.2, AC3.1, AC3.2, AC3.4, AC5.1, AC5.2, AC5.4, AC6.1, AC6.3: pin nội dung
  `test/content/39-execution-mode-choice.pin.mjs`, kiểm các câu quy tắc chính (không khớp toàn đoạn văn).
- AC6.1: pin 39 đọc cả bốn tệp (template, `AGENTS.md`, `CLAUDE.md`, `parallel-agents.md`), gộp xuống dòng trước khi so câu, và
  kiểm câu `partRunner` mới ở `parallel-agents.md`; giới hạn 200 dòng đã có ở contract `30-templates`, không lặp lại.
- AC1.4, AC5.3: trong pin 39, gọi `ledger.mjs` `main` với tệp tạm, theo mẫu AC5.2 của pin 32 (exit 0 cho dòng `Ruling:` và
  `Part review:`; chưa thêm mẫu vào `EVENT_FORMATS`), cộng pin nội dung cho mẫu dòng trong `task-loop.md` và `SKILL.md`.
- AC3.3: pin 24 `check-partition` đã có; pin 39 chỉ kiểm câu quy tắc trong `task-loop.md`.
- AC4.1: `test/content/34-autonomy-gates.pin.mjs` không sửa, chạy trong `npm test`.
- AC6.2: `test/content/32-superpowers-gap.pin.mjs` (sửa AC5.1 trong cùng thay đổi).
- AC7.1: `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-11-03-execution-mode-choice/` và đối
  chiếu thủ công mục Lịch sử của ba spec sống.
- AC8.1: `npm run build`, `node cli/lib/versions.mjs --lock`, `npm test`.
- Không có AC nêu kết quả số cần `calc:`.
- Trial thật (dựng repo, chạy `plan-execution` với model) không thuộc request này: chưa có bằng chứng hành vi của model với text
  mới.

## Để builder quyết
- Có tách `part-review.md` thành mẫu riêng (A6) hay gộp vào `task-review.md`; nếu gộp, giữ AC5.1.
- Có thêm mẫu `Part review:` vào `EVENT_FORMATS` hay không; đề xuất là không thêm trừ khi `aip status` hiểu sai dòng này.
- Kiểm A16: `ledger.mjs <thư mục request>` khi chưa có `plan.md` gốc; nếu từ chối, sửa theo hướng ghi vào `root/` mà không đổi validator.

## Rủi ro và câu hỏi mở
- [Inference] Chi phí: mỗi part Subagent thêm một reviewer `sonnet` mỗi vòng; chưa đo.
- Hai nhãn "Tuần tự" (A4) tách nghĩa bằng tên, nhưng người duyệt G1 có thể vẫn muốn đổi nhãn.
- [giả định] Ledger được tạo sau khi người dùng duyệt G2 (A5). Nếu phiên dừng giữa hai bước và câu trả lời mất, lần sau hỏi lại
  đúng một lần.
- [Unverified] Hành vi model với text mới chưa có bằng chứng trial. Các phát biểu về model theo text là dựa trên mẫu quan sát,
  chưa đo.
- Review part và subagent part cùng dùng `sonnet` theo mẫu hiện có; reviewer không độc lập hoàn toàn với người viết code
  [Inference].
- Không có ADR (A11); người duyệt quyết có ghi ADR ở bước gộp không.
- [giả định] A16 chưa kiểm bằng chạy thật.
- Đã kiểm trong code: các điểm ở mục "Vấn đề và lý do", `ledger.mjs` không có mẫu cho `Ruling:` và `Part review:`,
  `status.mjs` không đọc hai dòng này như sự kiện, `review-package.mjs` kiểm base là tổ tiên, `engineering-plan-writing` bước 7
  có định nghĩa G2.
