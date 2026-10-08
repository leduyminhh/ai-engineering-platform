# Eval plugin (`claude plugin eval`)

> **[Unverified] chưa chạy thật; lần đầu chạy một case với `--case <name> --runs 1 --max-cost-usd 0.5` để xác nhận cách gọi, scaffold và nơi ghi kết quả.**
> Các lệnh dưới đây dựng từ `claude plugin eval --help`; không có lượt chạy nào được thực hiện trong repo này vì mỗi lượt gọi model trên tài khoản của người dùng.

Bộ case kiểm hành vi của plugin: Claude có chọn đúng skill với cách nói tự nhiên của người dùng không, và có giữ ranh giới an toàn (read-only, tái hiện trước khi sửa) không. Case nằm ở cấp repo (`evals/<plugin>/<case>/`), không ship trong plugin và không nằm trong gói npm. Eval KHÔNG nằm trong `npm test` hay CI (tốn tiền model); chạy tay hoặc theo lịch.

| Case | Kiểm gì |
|---|---|
| `engineering/spec-writing-routes` | Prompt viết spec → gọi `engineering-spec-writing`, ghi `docs/requests/**/requirement.md`, có acceptance criteria đo được + giả định/câu hỏi mở |
| `backend/code-review-readonly` | Prompt review module order → gọi `backend-code-review`, không Edit/Write dù đã được cấp, finding có severity + `file:line`, nêu N+1 |
| `workflows/bugfix-routes` | Prompt báo lỗi 500 → gọi `workflow-bugfix`, tái hiện (failing test hoặc bước tái hiện) trước khi sửa code production |

## Cấu trúc một case

- `prompt.md`: frontmatter (`runs: 3`, `max_turns`, `allowed_tools`, `tags`) + prompt tiếng Việt.
- `graders/*.md`: mỗi file một grader (`tool_used`, `file_exists`, `llm`…).
- `case.yaml` + `scaffold.sh`: case backend và workflows dùng để dựng file mẫu có lỗi (Java N+1; JS áp mã giảm giá ném TypeError). Script chỉ dùng heredoc Bash, không cần mạng.
- Contract cấu trúc: `test/contract/95-evals.contract.mjs` (chạy trong `npm test`, không gọi model).

## Chạy tay

Điều kiện: plugin đã được cài để `claude plugin eval` tìm theo tên.

```bash
npm run build
aip install --provider claude -g
```

Từ thư mục gốc repo (mỗi plugin một lệnh; `<id>` là `engineering`, `backend` hoặc `workflows`):

```bash
mkdir -p evals/<id>/results
claude plugin eval <id>@ai-engineering-platform --eval-dir evals/<id> --ablation none --runs 3 --threshold 0.8 --max-cost-usd 5 --no-publish --json evals/<id>/results/latest.json
```

Cờ thêm theo từng case (cờ `--allow-tools` và `--scaffold` áp cho mọi case trong lượt chạy đó):

| Plugin | Cờ thêm | Vì sao |
|---|---|---|
| `engineering` | `--allow-tools Write Edit` | Case cần ghi `requirement.md`; không cấp thì Write/Edit bị gỡ khỏi phiên (theo docs [Unverified]) và grader `file_exists` đỏ |
| `backend` | `--scaffold --allow-tools Write Edit` | `--scaffold` dựng file Java mẫu; cấp Write/Edit để grader `no-edit`/`no-write` (`min: 0, max: 0`) có thể đỏ, nếu không chúng pass vì tool không tồn tại |
| `workflows` | `--scaffold --allow-tools Write Edit` | `--scaffold` dựng service JS có bug; cấp Write/Edit để grader `repro-before-edit` thấy được việc sửa code production |

Ví dụ:

```bash
claude plugin eval backend@ai-engineering-platform --eval-dir evals/backend --ablation none --runs 3 --threshold 0.8 --max-cost-usd 5 --no-publish --scaffold --allow-tools Write Edit --json evals/backend/results/latest.json
```

Ghi chú về lệnh:

- Dùng `--ablation none` vì mặc định (`with-without`) coi grader `tool_used: Skill` là chỉ báo "plugin có kích hoạt" và không tính vào điểm (theo `--help`). Với `none` các grader routing được tính điểm; đổi lại không có nhánh không plugin nên không có cột Δ.
- `--eval-dir` là tên thư mục; với đích là plugin đã cài, `--help` nói kết quả ghi vào `./<dir>/results/`. [Unverified] Việc `claude plugin eval` đọc case từ `./evals/<id>/` của repo (thay vì bản trong plugin đã cài) chưa được xác nhận bằng lần chạy thật.
- Thêm `--trust-plugin` khi chạy không tương tác (CI/lịch); lần đầu tương tác sẽ có câu hỏi tin cậy.
- `--case <glob>` chọn một case; `--runs <n>` ghi đè số lượt; `--judge-model <model>` đổi model chấm `llm`.

### Danh sách kiểm lần chạy đầu

1. Một case, một lượt, trần chi phí thấp: `claude plugin eval <id>@ai-engineering-platform --eval-dir evals/<id> --ablation none --case <name> --runs 1 --max-cost-usd 0.5 --no-publish`.
2. Với case có scaffold (`backend/code-review-readonly`, `workflows/bugfix-routes`), thêm `--scaffold --keep-temp --runs 1` rồi mở thư mục tạm được giữ lại để kiểm file mẫu đã được dựng đúng (`scaffold_script` do `case.yaml` khai là cú pháp chưa xác nhận).
3. Xác nhận cases được đọc từ `evals/<id>/` và kết quả nằm ở `evals/<id>/results/` (đã có trong `.gitignore`).
4. Xác nhận case engineering ghi ra `docs/requests/**/requirement.md` (grader `file_exists`).

## Giới hạn và chi phí

- Mỗi lượt chạy gọi model trên tài khoản của người dùng; `--help` nêu `--max-cost-usd` là trần chi phí cứng và grader `llm` gọi thêm model chấm.
- [Unverified] Theo tài liệu `claude plugin eval` (không có trong `--help`): Windows native từ chối case cấp quyền Bash (cần WSL2), nên không case nào khai `Bash` trong `allowed_tools` và contract chặn việc thêm; mỗi run chạy trong thư mục tạm, chỉ nạp plugin dưới test (hook, `CLAUDE.md`, skill cá nhân của bạn không có mặt); grader `file_exists` chỉ tính file Claude tạo trong run; grader `llm` với `focus: trace` chỉ thấy 12 message đầu và 12 message cuối.
- Case workflows không có Bash nên agent không chạy được test; grader `repro-before-edit` chấp nhận failing test viết bằng Write hoặc bước tái hiện nêu rõ bằng lời.
- Một lần chạy có `--allow-tools Write Edit` cho phép agent ghi file trong workspace của run; [Unverified] workspace là thư mục tạm, không phải repo này.
