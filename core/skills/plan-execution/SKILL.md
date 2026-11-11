---
name: plan-execution
description: "Thực thi plan.md đã duyệt theo vòng task: brief, giao agent theo kind, review từng task, sửa tối đa 3 vòng, commit, ledger, review cuối toàn nhánh rồi kết thúc nhánh. Dùng khi người dùng muốn \"thực thi plan\", \"chạy plan.md\", \"làm tiếp plan\", \"review từng task\". Không dùng khi cần viết plan → engineering-plan-writing; chỉ commit/merge → git-workflow."
order: 5
title: "Plan Execution — vòng task, review từng task, review cuối, kết thúc nhánh (dùng chung)"
runsIn: execute
invoke: per-request
---

# Plan Execution (skill dùng chung)

Giao thức để **session chính** thực thi một `plan.md` đã duyệt mà không phụ thuộc skill ngoài bộ: mỗi task đi một vòng
đầy đủ (brief → implement → review task → sửa → commit → ledger), cả plan kết thúc bằng một lần review toàn nhánh rồi
mới tới bước kết thúc nhánh. Session chính là người điều phối; mọi việc viết code, viết test và review do agent domain
làm (trừ chế độ inline, xem `references/inline.md`), kết quả trả theo contract đầu ra (`core:principles`). Điều kiện chạy: có `plan.md` đã duyệt trong
`docs/requests/<ngày>-<slug>/` và đang ở nhánh `feature/<slug>`; cỡ "thay đổi nhỏ" không có `plan.md` thì brief là
`requirement.md` và kind lấy theo phạm vi đã chốt khi làm rõ (backend → `BE`; frontend → `FE-UI`, thêm `FE-INT` khi nối API
thật): một task duy nhất, task id `1`; phạm vi fullstack → hai task, `1` là `BE` rồi `2` là phía FE. Ledger vẫn ghi để làm
tiếp được.

Skill chỉ **điều phối**. `kind` của task và chuỗi agent tương ứng do `engineering-plan-writing` định nghĩa (bảng
"Kind và chuỗi agent" trong `references/plan-structure.md` của skill đó) — không lặp lại ở đây.

## Quy trình

1. **Chuẩn bị.** Đọc `plan.md` một lần (bản đồ file, Global Constraints, Review Focus, `**Interfaces:**` của từng task).
   Chạy `node <thư mục skill plan-execution>/scripts/ledger.mjs <plan.md> "# Ledger — plan: <đường dẫn plan.md>"` để tạo workspace `.aip/` và dòng đầu ledger;
   ledger đã có thì đọc phần cuối và làm tiếp từ task chưa `complete`, không làm lại task đã xong. Bước này đồng thời
   rà trước các cặp task chung file hoặc nối interface (xem `references/task-loop.md`, mục "Rà plan trước khi chạy") và
   chạy `node <thư mục skill plan-execution>/scripts/autonomy.mjs` một lần để lấy `mergeLocal`, `cleanup`, `partRunner`, `planRunner`
   (thiếu khoá hoặc sai giá trị = mặc định an toàn: hỏi merge local, hỏi dọn; `partRunner` và `planRunner` chỉ là gợi ý nên không làm bỏ qua câu hỏi cách chạy).
   Rồi hỏi thẻ Cách thực thi, trước `Task 1: start`, mỗi lần thực thi một plan (chia part hay không). Phiên part và subagent part không hỏi cách chạy, cũng không `--set` (khối bàn giao và `references/inline.md` đã định sẵn); session giữ cả request làm theo thứ tự:
   (a) grep cả ledger `root/` tìm `^Ruling: cách chạy` (hook chỉ chèn phần cuối): có thì dùng giá trị đó, không hỏi, vì cùng một lần thực thi;
   (b) không có tool subagent, hoặc yêu cầu của người dùng đã nói rõ chạy inline hay không dùng subagent: `inline`, không hỏi;
   (c) còn lại hỏi một câu theo `references/ask-user.md` (hàng "Cách thực thi"): "Subagent + review từng task" (`subagent`) hoặc "Inline" (`inline`), lựa chọn theo `planRunner` đứng đầu kèm "(Recommended)" (mặc định Subagent); khoá không bỏ câu hỏi.
   Ở (b) và (c), ghi `Ruling: cách chạy <subagent|inline> — <người dùng chọn | không có tool subagent | người dùng nói rõ> — <chi phí nếu sai>` bằng `ledger.mjs`, rồi lưu giá trị làm gợi ý lần sau: `node <thư mục skill plan-execution>/scripts/autonomy.mjs --set planRunner=<giá trị>` (không dùng Write/Edit lên `.claude/aip-gate.json`, hook hỏi người dùng khi ghi file đó).
   `subagent` chạy vòng task bên dưới, `inline` chạy theo `references/inline.md`.
2. **Vòng task**, lần lượt từng task chưa `complete`, theo `references/task-loop.md`. Đọc hết file đó trước task đầu tiên
   (cả cỡ "thay đổi nhỏ"), và giao việc bằng đúng mẫu trong `references/prompts/`, không tự soạn prompt; bước này chỉ tóm
   tắt, luật vòng sửa, xếp finding và dòng ledger nằm ở `task-loop.md`:
   ghi BASE → cắt brief bằng `scripts/task-brief.mjs` → giao agent domain theo `kind` bằng mẫu
   `references/prompts/implementer.md` → nhận `agent_result` → session chính commit → gom diff bằng
   `scripts/review-package.mjs` → task review (`references/prompts/task-review.md`, trả `spec_verdict` + finding) →
   sửa tối đa 3 vòng, mỗi vòng một re-review có phạm vi (`references/prompts/re-review.md`) → ghi
   `Task <n>: complete (…)` vào ledger. Task cỡ Nhỏ bỏ hai bước review: xem mục "Cỡ task và review từng task" của `references/task-loop.md`.
3. **Review cuối toàn nhánh** sau task cuối, theo `references/prompts/final-review.md`: reviewer chạy opus, nhận Review
   Focus + các dòng `Ruling:` + finding minor đã hoãn; `engineering-quality-auditor` chỉ chạy ở bước này.
4. **Kết thúc nhánh** theo `references/finish.md` (đọc file trước khi làm bước này): docs + spec sống + `check-request.mjs` + full suite, rồi trình G3
   (diff cả nhánh); `mergeLocal: true` thì duyệt G3 là đồng ý merge local, không thì đưa đúng 3 lựa chọn; ghi
   `Plan: complete` vào ledger khi plan xong.

Request chia part (`## Bảng part` trong `design.md`): thứ tự part, song song và merge theo mục "Chế độ part" của
`references/task-loop.md` (hỏi trước mỗi nhóm Song song, `partRunner` chỉ là gợi ý); `Plan: complete` chỉ ghi ở ledger `root/`.

**Điểm dừng và báo cáo.** Mọi lần dừng chờ người dùng đều theo [references/ask-user.md](references/ask-user.md): mở file hoặc diff cần duyệt ở pane và hỏi bằng lựa chọn bấm được, không kết thúc lượt bằng câu hỏi suông. Chờ người dùng chỉ ở G1 (duyệt design), G2 (duyệt plan), G3 (duyệt diff cả nhánh; thiếu khoá
`mergeLocal` thì push + PR là lựa chọn 2 của chính câu hỏi G3), câu hỏi push/PR riêng một lần sau merge local (chỉ khi
`mergeLocal: true`), thẻ Cách thực thi trước Task 1, câu hỏi cách chạy part trước mỗi nhóm Song song (khoá chỉ là gợi ý, không bỏ câu hỏi; các trường hợp không hỏi nêu ở bước 1 và ở "Chế độ part"), và 6 loại dừng bên dưới;
giữa G2 và G3 chạy liền, không hỏi ngoài các điểm dừng trên hoặc khi gặp lỗi chặn (định nghĩa ở mục "Báo cáo" của
`references/task-loop.md`). Người dùng vẫn thấy tiến độ tổng thể: danh sách task của công cụ đăng đủ mọi task trước Task 1
và cập nhật sau mỗi task, kèm một dòng tiến độ không chờ trả lời (mục "Báo tiến độ" của `references/task-loop.md`).

## Ai làm gì

| Việc | Người làm |
|---|---|
| Điều phối, ghi ledger, trả lời `questions[]` từ spec/plan, phán `Ruling:` | session chính |
| Commit sau mỗi task (qua `git-workflow`) | session chính — agent không tự commit (ngoại lệ: subagent part của nhóm Song song chọn Subagent, xem `references/inline.md`) |
| Implement, viết test | agent domain theo `kind`; task `DOCS`: `general-purpose` |
| Sửa finding (vòng sửa, lần sửa sau review cuối) | agent domain theo `kind`, kể cả khi bản sửa chỉ vài dòng; session chính không tự sửa code |
| Task review, re-review, review cuối | `backend-reviewer` / `frontend-reviewer` (chỉ đọc); DOCS/TOOLING dùng `general-purpose` |
| Quality/security gate | `engineering-quality-auditor`, chỉ ở review cuối |
| Chế độ inline (người dùng chọn inline ở thẻ Cách thực thi, nói rõ chạy inline, hoặc không có tool subagent) | session chính làm mọi task theo `references/inline.md` |

Model khi gọi agent (tham số `model`): implementer mặc định `sonnet`; task review của task code (mọi kind trừ `DOCS`) dùng
`sonnet`; re-review, task `DOCS` và task review của task `DOCS` dùng `haiku` (haiku sai một lần trong task đó → gọi lại bằng `sonnet`); vòng 3 của vòng sửa và reviewer của review cuối toàn nhánh dùng `opus`; lần sửa sau review cuối dùng `sonnet`. Plan
không cần khai báo model riêng cho từng task.

## Ranh giới an toàn

- Chỉ làm việc trên nhánh `feature/<slug>` (phiên part làm trên `worktree-<slug>-p<nn>`); đang ở nhánh protected (`main`/`master`/`dev`/`develop`) thì dừng và
  hỏi trước mỗi commit theo `git-workflow`.
- Agent không commit, không push, không gọi agent khác. Session chính commit sau mỗi task bằng `git-workflow`
  (`git commit -F`, header tiếng Anh, body tiếng Việt, không `Co-Authored-By`); mỗi task có ≥ 1 commit; không amend hay
  squash khi người dùng chưa xác nhận. Ngoại lệ duy nhất: subagent part (nhóm Song song chọn Subagent) đóng vai session của
  part và tự commit trên nhánh part theo `references/inline.md`.
- Chạy liên tục giữa các task, nhưng **dừng hỏi người dùng** (không ghi `Ruling:` rồi chạy tiếp) trong 6 trường hợp:
  việc không đảo ngược được hoặc phá huỷ; bảo mật; tác động ngoài repo (merge, push, publish; ngoại lệ: `merge --no-ff` nhánh part vào `feature/<slug>` mà người dùng đã đồng ý ở
  bước 3 của "Chế độ part" (câu trả lời Subagent hoặc Phiên riêng của câu hỏi nhóm Song song) là merge local, không dừng); finding chạm schema DB; plan hỏng đến mức mọi hướng đều là đoán;
  phải đổi một AC người dùng đã duyệt, hoặc kết quả chạy thật bác giả định mà hướng đã duyệt ở G1 dựa vào. Chi tiết ở `references/task-loop.md`.
- Không merge, không push khi người dùng chưa chọn ở bước kết thúc nhánh (trừ merge part local đã được đồng ý, xem trên; `mergeLocal: true` biến duyệt G3 thành chọn merge local; không khoá nào bật push); không xoá nhánh khi chưa được xác nhận rõ (trừ `cleanup: true`: chỉ nhánh đã là tổ tiên của nhánh gốc, xem `references/finish.md`).
- Không tuyên bố task hoặc plan xong khi chưa có evidence lệnh kiểm chứng; kết quả agent báo "xanh" phải đối chiếu bằng
  diff và lần chạy test của chính session chính.
- Ledger, brief và review package nằm ở `<gốc repo chính>/.aip/runs/<request>/<part>/` (`<part>` là `root` cho plan gốc) và không bao giờ được commit (`.aip/.gitignore` chứa `*`). Ba script tự tính đường dẫn từ plan và in ra; ledger `.sdd/progress.md` cũ được chép sang một lần.
- Thang severity và định dạng `agent_result`, `spec_verdict`, `tdd`, `rulings` theo contract đầu ra (`core:principles`);
  skill này không định nghĩa lại.

## Dấu hiệu đang tự biện minh

| Suy nghĩ | Thực tế |
|---|---|
| "Task nhỏ, bỏ review cho nhanh" | Chỉ task cỡ Nhỏ đủ cả bốn điều kiện ở mục "Cỡ task và review từng task" của `references/task-loop.md` mới bỏ review từng task, và vẫn phải qua bước đối chiếu diff sau commit. Task `BE`, `DB`, `CT`, `FE-INT`, `E2E`, `DOCS` hoặc `**TDD:** có` luôn review. Chế độ inline và part chạy bằng subagent bỏ ở mọi cỡ (`references/inline.md`). |
| "Agent báo xanh rồi" | Báo cáo agent là ý định. Đối chiếu bằng diff và lần chạy test của chính session chính. |
| "Finding này ngoài AC, sửa luôn cho tiện" | Theo mục "Nhận review" của `references/task-loop.md`: đổi hành vi ngoài AC là thẻ G3, không tự sửa. |
| "Rủi ro này nhỏ, gộp vào task sau cho tiện" | Đổi hành vi ngoài AC đi thẻ G3 ở mọi mức severity; `Ruling:` không mở rộng `**Files:**` cho việc đó (`references/task-loop.md`, mục "Nhận review"). |
| "Đang chạy liền tới G3, khỏi báo gì" | Không hỏi, nhưng vẫn cập nhật danh sách task và gửi một dòng tiến độ sau mỗi task (mục "Báo tiến độ"). |
| "Plan hơi lệch, tôi tự chỉnh rồi chạy tiếp" | Đổi AC đã duyệt hoặc mọi hướng đều là đoán là một trong 6 trường hợp phải dừng hỏi. |
| "Skip test này tạm thời để task qua" | Mục `## Dấu hiệu nới kiểm` của review package sẽ hiện dòng đó; không có lý do thì là `major`. |

## Tham chiếu

- [references/task-loop.md](references/task-loop.md): giao thức từng task, vòng sửa, breaker, ledger.
- [references/prompts/implementer.md](references/prompts/implementer.md), [task-review.md](references/prompts/task-review.md),
  [re-review.md](references/prompts/re-review.md), [final-review.md](references/prompts/final-review.md): mẫu prompt giao việc.
- [references/inline.md](references/inline.md): chế độ inline, session chính tự thực thi plan; dòng ledger inline cần `tests: <lệnh> exit 0`.
- [references/finish.md](references/finish.md): kết thúc nhánh.
- [references/model-routing.md](references/model-routing.md): chi tiết Model and session routing của baseline (chọn model và effort, xoay phiên, nhắn giữa phiên, monitoring, phiên dài).
- [references/ask-user.md](references/ask-user.md): cách hỏi người dùng ở mọi cổng (lựa chọn bấm được, mở file hoặc diff cần duyệt, mỗi cổng hỏi gì).
- `scripts/task-brief.mjs`, `scripts/review-package.mjs`, `scripts/ledger.mjs`, `scripts/autonomy.mjs` (in JSON khoá `autonomy` hiệu lực): Node thuần, không cần bash.
