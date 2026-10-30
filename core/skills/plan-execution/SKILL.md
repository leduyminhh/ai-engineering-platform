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
   Chạy `node <thư mục skill plan-execution>/scripts/ledger.mjs <requestDir> "# Ledger — plan: <đường dẫn plan.md>"` để tạo `.sdd/` và dòng đầu ledger;
   ledger đã có thì đọc phần cuối và làm tiếp từ task chưa `complete`, không làm lại task đã xong. Bước này đồng thời
   rà trước các cặp task chung file hoặc nối interface (xem `references/task-loop.md`, mục "Rà plan trước khi chạy").
2. **Vòng task**, lần lượt từng task chưa `complete`, theo `references/task-loop.md`:
   ghi BASE → cắt brief bằng `scripts/task-brief.mjs` → giao agent domain theo `kind` bằng mẫu
   `references/prompts/implementer.md` → nhận `agent_result` → session chính commit → gom diff bằng
   `scripts/review-package.mjs` → task review (`references/prompts/task-review.md`, trả `spec_verdict` + finding) →
   sửa tối đa 3 vòng, mỗi vòng một re-review có phạm vi (`references/prompts/re-review.md`) → ghi
   `Task <n>: complete (…)` vào ledger.
3. **Review cuối toàn nhánh** sau task cuối, theo `references/prompts/final-review.md`: reviewer chạy opus, nhận Review
   Focus + các dòng `Ruling:` + finding minor đã hoãn; `engineering-quality-auditor` chỉ chạy ở bước này.
4. **Kết thúc nhánh** theo `references/finish.md`: docs + spec sống + `check-request.mjs` + full suite, rồi đưa đúng 3 lựa
   chọn cho người dùng; ghi `Plan: complete` vào ledger khi plan xong.

## Ai làm gì

| Việc | Người làm |
|---|---|
| Điều phối, ghi ledger, trả lời `questions[]` từ spec/plan, phán `Ruling:` | session chính |
| Commit sau mỗi task (qua `git-workflow`) | session chính — agent không tự commit |
| Implement, viết test | agent domain theo `kind`; task `DOCS`: `general-purpose` |
| Task review, re-review, review cuối | `backend-reviewer` / `frontend-reviewer` (chỉ đọc); DOCS/TOOLING dùng `general-purpose` |
| Quality/security gate | `engineering-quality-auditor`, chỉ ở review cuối |
| Chế độ inline (người dùng nói rõ chạy inline, hoặc không có tool subagent) | session chính làm mọi task theo `references/inline.md`; không hỏi người dùng chọn cách thực thi |

Model khi gọi agent (tham số `model`): implementer mặc định `sonnet`; task review, re-review và task `DOCS` dùng `haiku`
(haiku sai một lần trong task đó → gọi lại bằng `sonnet`); vòng 3 của vòng sửa và review cuối toàn nhánh dùng `opus`. Plan
không cần khai báo model riêng cho từng task.

## Ranh giới an toàn

- Chỉ làm việc trên nhánh `feature/<slug>`; đang ở nhánh protected (`main`/`master`/`dev`/`develop`) thì dừng và
  hỏi trước mỗi commit theo `git-workflow`.
- Agent không commit, không push, không gọi agent khác. Session chính commit sau mỗi task bằng `git-workflow`
  (`git commit -F`, header tiếng Anh, body tiếng Việt, không `Co-Authored-By`); mỗi task có ≥ 1 commit; không amend hay
  squash khi người dùng chưa xác nhận.
- Chạy liên tục giữa các task, nhưng **dừng hỏi người dùng** (không ghi `Ruling:` rồi chạy tiếp) trong 6 trường hợp:
  việc không đảo ngược được hoặc phá huỷ; bảo mật; tác động ngoài repo (merge, push, publish); finding chạm schema DB;
  plan hỏng đến mức mọi hướng đều là đoán; phải đổi một AC người dùng đã duyệt. Chi tiết ở `references/task-loop.md`.
- Không merge, không push khi người dùng chưa chọn ở bước kết thúc nhánh; không xoá nhánh khi chưa được xác nhận rõ.
- Không tuyên bố task hoặc plan xong khi chưa có evidence lệnh kiểm chứng; kết quả agent báo "xanh" phải đối chiếu bằng
  diff và lần chạy test của chính session chính.
- Ledger nằm ở `<requestDir>/.sdd/progress.md` và không bao giờ được commit (`.sdd/.gitignore` chứa `*`).
- Thang severity và định dạng `agent_result`, `spec_verdict`, `tdd`, `rulings` theo contract đầu ra (`core:principles`);
  skill này không định nghĩa lại.

## Tham chiếu

- [references/task-loop.md](references/task-loop.md): giao thức từng task, vòng sửa, breaker, ledger.
- [references/prompts/implementer.md](references/prompts/implementer.md), [task-review.md](references/prompts/task-review.md),
  [re-review.md](references/prompts/re-review.md), [final-review.md](references/prompts/final-review.md): mẫu prompt giao việc.
- [references/inline.md](references/inline.md): chế độ inline, session chính tự thực thi plan; dòng ledger inline cần `tests: <lệnh> exit 0`.
- [references/finish.md](references/finish.md): kết thúc nhánh.
- `scripts/task-brief.mjs`, `scripts/review-package.mjs`, `scripts/ledger.mjs`: Node thuần, không cần bash.
