# Kịch bản E2E "mã giảm giá cho giỏ hàng"

Dùng cho D2/AC4.1 của `design.md`; lượt gốc chạy ngày 2026-11-02.

## Dựng sandbox
1. Thư mục mới ngoài repo, `git init -b master`. Chép `cart.mjs` vào `src/`, `cart.test.mjs` vào `test/`. `package.json`: `{ "name": "shop", "version": "0.1.0", "type": "module", "scripts": { "test": "node --test" } }`. `.gitignore`: `node_modules/`, `.aip/`, `.ai-engineering/`, `.claude/aip-gate.json`.
2. Nhánh aip: chạy `aip init` rồi commit `chore: init shop`. Plugin aip cài dạng plugin toàn cục, cùng version với source.
3. Nhánh đối chứng: không chạy `aip init`. Thêm `--settings <file>` với `{"enabledPlugins": {"<id>@<marketplace>": false, …}}` cho mọi plugin trong `claude plugin list`. `--bare` không dùng được khi đăng nhập OAuth. `~/.claude/CLAUDE.md` vẫn được nạp; ghi nhận đây là yếu tố gây nhiễu.

## Chạy
Mỗi lượt là một lệnh, lượt sau thêm `--resume <session_id>`:

```bash
claude -p "$(cat turn-<n>.txt)" --output-format json --max-turns 80 --max-budget-usd 4 --permission-mode dontAsk --allowedTools Read Edit Write Glob Grep Skill Agent TodoWrite "Bash(node *)" "Bash(npm *)" "Bash(git *)" "Bash(ls *)" "Bash(mkdir *)" "Bash(cat *)"
```

Câu trả lời ở các lượt sau đi theo câu hỏi thật của agent: giữ ý của `turn-<n>.txt`, sửa số mục cho khớp.

## Chấm
`node oracle.mjs aip <sandbox>/src/cart.mjs` hoặc `node oracle.mjs base <sandbox>/src/coupon.mjs`. Adapter trong `oracle.mjs` dịch coupon trung tính sang schema của từng bản; API khác thì sửa adapter, không sửa ca. Rubric ở mục Kiểm thử của `design.md`.
