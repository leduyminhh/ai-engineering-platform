# Eval plugin (`claude plugin eval`)

> **Đã chạy thật một lần (2026-10-23) cho `backend/code-review-readonly`; hai case còn lại và cách gọi qua `aip install -g` chưa chạy.** Xem mục "Lần chạy đã xác nhận" bên dưới. Phần còn lại của tài liệu dựng từ `claude plugin eval --help` và vẫn là [Unverified] ở chỗ ghi rõ.

Bộ case kiểm hành vi của plugin: Claude có chọn đúng skill với cách nói tự nhiên của người dùng không, và có giữ ranh giới an toàn (read-only, tái hiện trước khi sửa) không. Case nằm ở cấp repo (`evals/<plugin>/<case>/`), không ship trong plugin và không nằm trong gói npm. Eval KHÔNG nằm trong `npm test` hay CI (tốn tiền model); chạy tay hoặc theo lịch.

| Case | Kiểm gì |
|---|---|
| `engineering/spec-writing-routes` | Prompt viết spec → gọi `engineering-spec-writing`, ghi `docs/requests/**/requirement.md`, có acceptance criteria đo được + giả định/câu hỏi mở |
| `backend/code-review-readonly` | Prompt review module order → gọi `backend-code-review`, không Edit/Write dù đã được cấp, finding có severity + `file:line`, nêu N+1 |
| `workflows/bugfix-routes` | Prompt báo lỗi 500 → gọi `workflow-bugfix`, tái hiện (failing test hoặc bước tái hiện) trước khi sửa code production |

## Cấu trúc một case

- `prompt.md`: frontmatter (`runs: 3`, `max_turns`, `allowed_tools`, `tags`) + prompt tiếng Việt.
- `graders/*.md`: mỗi file một grader (`tool_used`, `file_exists`, `llm`…).
- Grader `scaffold-applied` (`tool_used: Read`, `input_match` tên file mẫu) đỏ khi agent không bao giờ đọc file mẫu, tức là scaffold không được áp (quên `--scaffold` hoặc script lỗi). [Unverified] chưa kiểm bằng lần chạy thật; `input_match` khớp trên JSON của lời gọi Read.
- `case.yaml` + `scaffold.sh`: case backend và workflows dùng để dựng file mẫu có lỗi (Java N+1; JS áp mã giảm giá ném TypeError). Script chỉ dùng heredoc Bash, không cần mạng.
- Contract cấu trúc: `test/contract/95-evals.contract.mjs` (chạy trong `npm test`, không gọi model).

## Chạy tay

Điều kiện: plugin đã được cài ở chế độ plugin (không phải skills phẳng) để `claude plugin eval` tìm theo tên `<id>@ai-engineering-platform`; chế độ plugin được chọn bằng `--as-plugin` (xem README gốc); `--plugin` nhận một id mỗi lần nên cài từng plugin một lệnh, hoặc `--plugin all`.

```bash
npm run build
aip install --provider claude --as-plugin --plugin engineering -g --yes
aip install --provider claude --as-plugin --plugin backend -g --yes
aip install --provider claude --as-plugin --plugin workflows -g --yes
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

- Dùng `--ablation none` vì mặc định (`with-without`) coi grader `tool_used: Skill` là chỉ báo "plugin có kích hoạt" và không tính vào điểm (theo `--help`). Với `none` các grader routing được tính điểm; đổi lại không có nhánh không plugin nên không có cột Δ. Muốn có Δ thì bỏ `--ablation none`; xem mục "Lần chạy đã xác nhận" bên dưới.
- `--eval-dir` là tên thư mục; với đích là plugin đã cài, `--help` nói kết quả ghi vào `./<dir>/results/`. [Unverified] Với đích là plugin đã cài, việc `claude plugin eval` đọc case từ `./evals/<id>/` của repo (thay vì bản trong plugin đã cài) chưa được xác nhận bằng lần chạy thật.
- Thêm `--trust-plugin` khi chạy không tương tác (CI/lịch); lần đầu tương tác sẽ có câu hỏi tin cậy.
- `--case <glob>` chọn một case; `--runs <n>` ghi đè số lượt; `--judge-model <model>` đổi model chấm `llm`.

### Danh sách kiểm lần chạy đầu

1. Một case, một lượt, trần chi phí thấp: `claude plugin eval <id>@ai-engineering-platform --eval-dir evals/<id> --ablation none --case <name> --runs 1 --max-cost-usd 0.5 --no-publish`.
2. Với case có scaffold (`backend/code-review-readonly`, `workflows/bugfix-routes`), thêm `--scaffold --keep-temp --runs 1` rồi mở thư mục tạm được giữ lại để kiểm file mẫu đã được dựng đúng (`scaffold_script` do `case.yaml` khai là cú pháp chưa xác nhận).
3. Xác nhận cases được đọc từ `evals/<id>/` và kết quả nằm ở `evals/<id>/results/` (đã có trong `.gitignore`).
4. Xác nhận case engineering ghi ra `docs/requests/**/requirement.md` (grader `file_exists`).

## Lần chạy đã xác nhận (2026-10-23, Claude Code 2.1.308, Windows)

Cách gọi chạy được mà không cần `aip install -g`: sao chép `build/claude/plugins/<id>` vào một thư mục tạm, bỏ khoá `dependencies`, chép `evals/<id>` vào đó thành `evals/`, rồi chạy từ thư mục tạm:

```bash
npm run build
T=$(mktemp -d)/backend
cp -r build/claude/plugins/backend "$T" && cp -r evals/backend "$T/evals"
node -e 'const f=process.argv[1],fs=require("fs"),p=JSON.parse(fs.readFileSync(f));delete p.dependencies;fs.writeFileSync(f,JSON.stringify(p,null,2))' "$T/.claude-plugin/plugin.json"
cd "$T"
claude plugin eval . --eval-dir evals --case code-review-readonly --runs 3 --max-cost-usd 1.5 --no-publish --scaffold --allow-tools Write Edit --trust-plugin --json results.json
```

- Đích là đường dẫn trong `build/` thì `--eval-dir` không tìm thấy case ("No eval cases found"); case phải nằm trong thư mục plugin được trỏ tới.
- Plugin có `"dependencies": ["core"]` KHÔNG được nạp vào phiên con khi đánh giá từ đường dẫn: trace chỉ liệt kê plugin builtin, grader `skill-used` đỏ và nhánh "có plugin" thực chất là baseline. Trong bản sao tạm cần bỏ khoá `dependencies` khỏi `.claude-plugin/plugin.json`. [Inference] Nguyên nhân là phụ thuộc không giải được khi nạp từ đường dẫn; chưa thử nạp `core` kèm theo.
- Ablation mặc định `with-without` chạy cả nhánh không plugin (gấp đôi lượt, tính Δ); `tool_used: Skill` chỉ là chỉ báo, không tính điểm.
- Chi phí đo được: khoảng 0,11 USD cho một lượt một nhánh; 3 lượt × 2 nhánh khoảng 0,9 USD (gồm grader `llm` chạy bằng haiku).
- `--keep-temp` để lại thư mục `claude-eval-*` trong thư mục tạm của hệ điều hành mà Windows không khoá được; đọc `out/trace.jsonl` rồi xoá bằng `Remove-Item -Recurse -Force`.

Kết quả `backend/code-review-readonly`, 3 lượt mỗi nhánh:

| | Có plugin | Không plugin |
|---|---|---|
| Điểm trung bình | 1,00 | 0,83 |
| Lượt qua toàn bộ grader | 3/3 | 0/3 |

Δ chỉ đến từ grader `finding-label` (regex: ÍT NHẤT MỘT dòng bảng finding có `file:line` kèm nhãn proven/suspected; không kiểm mọi finding đều có nhãn). Các grader còn lại, gồm `severity` (tìm đúng N+1), pass ở cả hai nhánh, tức model trần cũng tìm được lỗi. Vì vậy Δ này đo việc tuân theo định dạng finding của skill, KHÔNG chứng minh review đúng hơn. n=3 và một case, chưa đủ để kết luận thống kê. Một lượt kiểm lại sau đó (1 lượt, có plugin, `--ablation none`) đỏ `finding-label`, nên 3/3 có thể lạc quan; chưa rõ nguyên nhân vì đầu ra lượt đó đã bị xoá (regex vẫn khớp các dạng dòng bảng mong đợi, không khớp khi `file:line` bị tách thành `File.java` và `L15`). Một grader `llm` kiểm nhãn đã được thử rồi bỏ: nó chấm đỏ 3/3 phiếu một review có bảng finding đã gắn nhãn ở phần đầu. Chưa tìm ra nguyên nhân (chỉ đọc một phần đầu ra của lượt đó).

## Giới hạn và chi phí

- Mỗi lượt chạy gọi model trên tài khoản của người dùng; `--help` nêu `--max-cost-usd` là trần chi phí cứng và grader `llm` gọi thêm model chấm.
- [Unverified] Theo tài liệu `claude plugin eval` (không có trong `--help`): Windows native từ chối case cấp quyền Bash (cần WSL2), nên không case nào khai `Bash` trong `allowed_tools` và contract chặn việc thêm; mỗi run chạy trong thư mục tạm, chỉ nạp plugin dưới test (hook, `CLAUDE.md`, skill cá nhân của bạn không có mặt); grader `file_exists` chỉ tính file Claude tạo trong run; grader `llm` với `focus: trace` chỉ thấy 12 message đầu và 12 message cuối.
- Case workflows không có Bash nên agent không chạy được test; grader `repro-before-edit` chỉ cho PASS khi agent Write một file test tái hiện hoặc hỏi lại người dùng trước khi Edit/Write lên file production.
- Một lần chạy có `--allow-tools Write Edit` cho phép agent ghi file trong workspace của run; [Unverified] workspace là thư mục tạm, không phải repo này.
