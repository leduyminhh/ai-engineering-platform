# Eval plugin (`claude plugin eval`)

Bộ case kiểm hành vi của plugin đã build: Claude có chọn đúng skill với cách nói tự nhiên của người dùng không, và có giữ ranh giới an toàn (read-only, hỏi tái hiện trước khi sửa) không. Case nằm ở cấp repo (`evals/<plugin>/<case>/`), không ship trong plugin và không nằm trong gói npm.

| Case | Kiểm gì |
|---|---|
| `engineering/spec-writing-routes` | Prompt viết spec → gọi `engineering-spec-writing`, ghi `docs/requests/**/requirement.md`, có acceptance criteria đo được + giả định/câu hỏi mở |
| `backend/code-review-readonly` | Prompt review module order → gọi `backend-code-review`, không Edit/Write, finding có severity + `file:line`, nêu N+1 |
| `workflows/bugfix-routes` | Prompt báo lỗi 500 → gọi `workflow-bugfix`, hỏi/thu bước tái hiện trước khi sửa |

## Cấu trúc một case

- `prompt.md`: frontmatter (`runs: 3`, `max_turns`, `allowed_tools`, `plugins`) + prompt tiếng Việt.
- `graders/*.md`: mỗi file một grader (`tool_used`, `file_exists`, `llm`…). Grader `tool_used: Skill` chỉ là chỉ báo "skill có được kích hoạt" khi chạy hai nhánh (có/không plugin), không tính vào điểm.
- `case.yaml` (tuỳ chọn): chỉ case backend dùng, khai `context.scaffold_script` để dựng file Java mẫu có lỗi N+1.
- `plugins: ["../../../build/claude/plugins/<id>"]` trỏ case tới bản build của plugin, nên phải build trước.

Contract cấu trúc nằm ở `test/contract/95-evals.contract.mjs` (chạy trong `npm test`, không gọi model).

## Chạy tay

Mỗi lượt chạy gọi model trên tài khoản của người dùng và tốn tiền: mỗi case chạy `runs` lần cho mỗi nhánh, mặc định có thêm nhánh không plugin để so sánh, và grader `llm` gọi thêm một model chấm. Vì vậy eval KHÔNG nằm trong `npm test` hay CI; chạy tay hoặc theo lịch (nightly) khi đổi `description` của skill hoặc nội dung plugin.

```bash
npm run build
claude plugin eval evals/engineering/spec-writing-routes/prompt.md --allow-tools Write Edit --threshold 0.8 --max-cost-usd 5 --no-publish --json evals/engineering/results/latest.json
claude plugin eval evals/backend/code-review-readonly/prompt.md --scaffold --threshold 0.8 --max-cost-usd 5 --no-publish --json evals/backend/results/latest.json
claude plugin eval evals/workflows/bugfix-routes/prompt.md --threshold 0.8 --max-cost-usd 5 --no-publish --json evals/workflows/results/latest.json
```

- `--scaffold` là bắt buộc cho case backend; script chạy bằng Bash với quyền của bạn, chỉ bật cho case do repo này viết.
- Case engineering cần `--allow-tools Write Edit` để ghi được `requirement.md`; không có cờ này Write/Edit bị gỡ khỏi phiên và grader `file_exists` sẽ đỏ.
- Thêm `--ablation none` để bỏ nhánh không plugin (giảm một nửa chi phí, mất cột Δ); thêm `--runs 1` khi chỉ thử grader.
- Lần đầu trên một thư mục, Claude Code hỏi tin cậy plugin; khi chạy không tương tác (`--json`, CI) thêm `--trust-plugin`.
- Kết quả ghi vào `results/` (đã có trong `.gitignore`).

## Giới hạn

- Windows native từ chối case cấp quyền Bash (cần WSL2), nên không case nào khai `Bash` trong `allowed_tools`; contract chặn việc thêm Bash.
- `scaffold.sh` chỉ dùng heredoc của Bash (Git Bash trên Windows đủ), không cần mạng.
- Mỗi run chạy trong thư mục tạm, chỉ nạp plugin dưới test; hook, `CLAUDE.md` và skill cá nhân của bạn không có mặt.
- Dòng lệnh trên theo tài liệu `claude plugin eval` (đối số đích là file case, `plugins` là đường dẫn tương đối từ thư mục case); chưa được chạy thật trong repo này vì tốn tiền.
