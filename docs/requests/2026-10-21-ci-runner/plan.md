# Công thức CI chỉ đọc cho review PR (P6a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm file ví dụ `templates/ci/claude-review.example.yml` (GitHub Action chỉ đọc chạy một skill reviewer của aip trên PR), mục README EN/VI, và đồng bộ spec tổng.
**Architecture:** Một file YAML ví dụ ship trong gói npm nhưng không được `aip init` sao chép; kiểm bằng một pin nội dung theo khối chuỗi (không parser YAML) và một khẳng định trong `test/init.test.mjs`. Không đổi mã CLI hay nội dung plugin.
**Tech Stack:** GitHub Actions YAML, Node.js 20+ built-ins (test tự viết kiểu `ok(cond, msg)` của `test/validate.mjs`, `node:test` của `test/init.test.mjs`).
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep; UTF-8 không BOM, LF; chú thích trong YAML tiếng Việt, chỉ nêu *vì sao*; README EN/VI.
- Chỉ P6a. KHÔNG tạo repo `aip-runner`, không viết mã Python/LangGraph, không sửa `graph.json`/schema workflow; P6b chỉ được nhắc là "repo riêng, chưa hiện thực".
- File ví dụ: trigger `pull_request` (không `pull_request_target`, không `--dangerously-skip-permissions`/`bypassPermissions`); `permissions` chỉ `contents: read` và `pull-requests: read`; mọi `uses:` ghim SHA hoặc chỗ giữ `<full-40-char-commit-sha>`; không đăng bình luận/ghi vào PR; chỉ chạy PR cùng repo (điều kiện `if` so `head.repo.full_name` với `github.repository`; Ruling chốt 2026-10-22).
- Prompt dùng đối số cố định; không chứa `github.event.pull_request.title`, `.body`, `.head.ref`.
- Mọi khẳng định về đầu vào/cờ của `anthropics/claude-code-action` ghi nguồn `https://code.claude.com/docs/en/github-actions` hoặc `/headless` và nhãn `[Unverified]` (đã đối chiếu 2026-10-22 qua subagent `claude-code-guide`, chưa đọc trực tiếp từng trang); điều không tìm thấy trong tài liệu ghi `[Unverified]` rõ ràng.
- Test: tên mang tiền tố `P6a ACx.y:` để không trùng ID AC của pin cũ; pin neo theo khối (khối `permissions:`, khối `claude_args`, khối `prompt`), không khẳng định giả bằng cách tìm từ khóa ở bất kỳ đâu.
- Không bump version trừ khi `node cli/lib/versions.mjs --lock` buộc (chỉ ở Task 4, không sửa tay file lock); `templates/` và `docs/` không nằm trong build plugin nên dự kiến không bump.
- Nhánh hiện tại (`claude/p6a-ci-review-66c184`, thay cho `feature/p6-ci-runner` trong design), commit mỗi task qua `core:git-workflow` (header tiếng Anh, thân tiếng Việt có dấu, `git commit -F` từ file ngoài repo, không Co-Authored-By); không push, không merge vào `master`. Không đụng nhánh `feature/p6-ci-runner`.
- Không `rm -rf` thư mục có junction trên Windows; dọn bằng `fs.rmSync`.

## Review Focus

- Prompt chứa biểu thức `${{ ... }}` nào lấy dữ liệu PR do tác giả điều khiển (tiêu đề, body, tên nhánh head, nội dung comment): pin kiểm khối `prompt` không có `github.event.` nào ngoài số PR cố định/không có (Task 1).
- `permissions:` có thêm `id-token: write`, `issues: write`, `actions:` hay mức `write` bất kỳ; `uses:` ghim `@v1`/tag thay vì SHA hoặc chỗ giữ (Task 1).
- `--allowedTools` lọt tool ghi hoặc mạng (`Edit`, `Write`, `Bash` trần, `Bash(*)`, `WebFetch`, `mcp__github_inline_comment__*`) hoặc thiếu `--max-turns`/`--max-budget-usd` (Task 1).
- Ví dụ trở thành cơ chế đăng bình luận: `track_progress`, `use_sticky_comment`, tool đăng comment trong `--allowedTools` (Task 1).
- `aip init --full` (hoặc `init` thường) tạo bất cứ thứ gì dưới `.github/` (Task 2).
- README đoạn mới nói quá (khẳng định "an toàn", "chặn được fork") hoặc thiếu rủi ro `claude -p` không `--bare` nạp hook/`.mcp.json` (Task 3).

---

### Task 1: File ví dụ CI chỉ đọc và pin nội dung
**Phủ AC:** AC1.2, AC1.3, AC1.4
**Files:**
- Create: `templates/ci/claude-review.example.yml`
- Create: `test/content/27-ci-review-example.pin.mjs`
- Test: `test/content/27-ci-review-example.pin.mjs`

**Interfaces:**
- Consumes: `ctx` của `test/context.mjs` (`fs`, `path`, `REPO_ROOT`), mô-đun `export default async function run({ ok, ctx })`.
- Produces: file YAML có các khối cố định mà Task 2–3 và README trỏ tới: `on: pull_request`, `permissions:`, bước `uses: anthropics/claude-code-action@<full-40-char-commit-sha>`, `with.prompt`, `with.claude_args`.

- [ ] **Step 1: Viết pin đỏ** `test/content/27-ci-review-example.pin.mjs`, tên test `P6a AC1.2:`, `P6a AC1.3:`, `P6a AC1.4:`. Lấy khối bằng neo (từ dòng khóa đến dòng khóa cùng cấp kế tiếp). Kiểm:
  - AC1.2: file tồn tại; có `pull_request:` dưới `on:` và không có chuỗi `pull_request_target`; khối `permissions:` đúng hai khóa `contents: read` và `pull-requests: read`; mọi dòng `uses:` kết thúc bằng `@<40 hex>` hoặc `@<full-40-char-commit-sha>`.
  - AC1.3: khối `claude_args` chứa `--permission-mode dontAsk`, `--max-turns <số>`, `--max-budget-usd <số>`, `--allowedTools` mà mỗi mục thuộc tập `{Read, Grep, Glob, Bash(git diff *), Bash(git log *)}` (parse từng mục, so tập, không chỉ tìm từ khóa); không có `bypassPermissions`/`--dangerously-skip-permissions` trong cả file; khối `prompt` bắt đầu bằng `/<plugin>:<skill>` dạng `/[a-z0-9-]+:[a-z0-9-]+ ` và không chứa `github.event.pull_request.title`, `.body`, `.head.ref` (kiểm cả bản không có khoảng trắng như `github.event.pull_request.body`) và không chứa `${{ github.event.` nào.
  - AC1.4: không có `track_progress`, `use_sticky_comment`, `mcp__github_inline_comment`, `gh pr comment`, `gh pr review`, `gh api` và không có `issues: write`/`pull-requests: write`/`contents: write` ở đâu trong file; có `display_report: true` (job summary) hoặc `actions/upload-artifact@`.
  - Ghi kèm một nhóm đối chứng: chạy các kiểm tra trên một chuỗi YAML xấu cố ý (có `pull_request_target`, `Bash` trần, `${{ github.event.pull_request.body }}` trong prompt) và khẳng định các kiểm tra phát hiện được (bảo đảm pin không giả).
- [ ] **Step 2: Chạy `node test/validate.mjs --only P6a`** (nếu `--only` lọc theo tên module thì dùng `--only ci-review`). Mong đợi: FAIL (thiếu file).
- [ ] **Step 3: Viết `templates/ci/claude-review.example.yml`.** Nội dung theo design mục 1 và các giá trị đã đối chiếu tài liệu: `on: pull_request` (types `opened, synchronize, ready_for_review, reopened`); job `review` với `if: github.event.pull_request.head.repo.full_name == github.repository`; `permissions: contents: read, pull-requests: read`; bước `actions/checkout@<full-40-char-commit-sha>` với `fetch-depth: 2` và `persist-credentials: false`; bước `anthropics/claude-code-action@<full-40-char-commit-sha>` với `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}`, `github_token: ${{ github.token }}`, `plugin_marketplaces: <git-url-của-marketplace-aip>` (chỗ giữ, ghi chú: marketplace `ai-engineering-platform` build từ `node cli/dist.mjs`, người dùng điền URL Git của nhánh `dist` của họ), `plugins: backend@ai-engineering-platform`, `display_report: true`, `prompt: "/backend:backend-code-review HEAD^1..HEAD"` (checkout merge ref của `pull_request` nên `HEAD^1..HEAD` là diff của PR), `claude_args: --permission-mode dontAsk --allowedTools "Read,Grep,Glob,Bash(git diff *),Bash(git log *)" --max-turns 20 --max-budget-usd 2` (dạng nhiều dòng `|` hoặc một dòng, chọn dạng pin parse được). Chú thích tiếng Việt chỉ nêu vì sao, và các nhãn `[Unverified]` + link tài liệu cho: tên đầu vào, `id-token: write` có thể bị Action yêu cầu cho xác thực GitHub App mặc định (ví dụ này cố ý không cấp, người dùng phải tự kiểm), `display_report` (chỉ thấy trong `action.yml`), `--allowedTools` có thể cần `Skill` để skill chạy, `--max-budget-usd` chưa thấy trong ví dụ của Action. Không có bước đăng bình luận; không `track_progress`.
- [ ] **Step 4: Chạy lại pin.** Mong đợi: PASS; `node test/validate.mjs --build` vẫn xanh.
- [ ] **Step 5: Commit** `feat(ci): add read-only PR review workflow example` qua `core:git-workflow`.

### Task 2: `aip init` không sao chép file CI; gói npm chứa file
**Phủ AC:** AC1.1
**Files:**
- Modify: `test/init.test.mjs`
- Test: `test/init.test.mjs`, `npm run pack:verify`

**Interfaces:**
- Consumes: `init({ root, full })`, `r.created`, `listFiles`, `tmp` có sẵn trong `test/init.test.mjs`; `templates/ci/claude-review.example.yml` (Task 1).
- Produces: không có.

- [ ] **Step 1: Viết test.** Thêm vào `test/init.test.mjs` một test `P6a AC1.1: init và init --full không tạo file nào dưới .github/ và không sao chép templates/ci` (tham số hóa `full` false/true): mọi phần tử `r.created` không bắt đầu bằng `.github/` và không chứa `claude-review`; `fs.existsSync(path.join(root, '.github'))` là false; thêm khẳng định `fs.existsSync(path.join(REPO, 'templates/ci/claude-review.example.yml'))`. Vì file đã có từ Task 1, test PASS ngay (đây là test chống hồi quy cho một bất biến; không cần bước đỏ).
- [ ] **Step 2: Chạy `node test/init.test.mjs`.** Mong đợi: PASS.
- [ ] **Step 3: Chạy `npm run pack:verify`** và xác nhận đầu ra liệt kê `templates/ci/claude-review.example.yml` trong tập file cho phép (nếu lệnh không in danh sách, kiểm bằng `npm pack --dry-run --json` rồi đọc `files[].path`). Mong đợi: xanh và có file. Nếu pack-guard từ chối, DỪNG và báo (không sửa `pack.config.json` khi chưa hỏi).
- [ ] **Step 4: Commit** `test(cli): pin init does not copy CI workflow example` qua `core:git-workflow`.

### Task 3: README EN/VI và CLAUDE.md
**Phủ AC:** AC2.1
**Files:**
- Modify: `README.md`, `README_VI.md`
- Modify: `CLAUDE.md` (chỉ nếu mô tả `templates/` cần nhắc `templates/ci`; giữ nguyên nếu không)
- Create: `test/content/28-ci-review-docs.pin.mjs`
- Test: `test/content/28-ci-review-docs.pin.mjs`

**Interfaces:**
- Consumes: tên file và khối của Task 1.
- Produces: heading `## Run reviews in CI` (README.md) và `## Chạy review trong CI` (README_VI.md), đặt ngay trước `## Eval` / mục tương ứng.

- [ ] **Step 1: Viết pin đỏ** `test/content/28-ci-review-docs.pin.mjs`, tên `P6a AC2.1:`, một case cho mỗi ngôn ngữ. Lấy đoạn từ heading đến H2 kế tiếp; kiểm đoạn chứa: `templates/ci/claude-review.example.yml`; tự chép (EN `copy` / VI `chép`) và `aip init` không sao chép; `pull_request` và `pull_request_target`; `contents: read`; SHA; `--permission-mode dontAsk`; `--allowedTools`; `--max-budget-usd`; `fork`; `--bare`; `[Unverified]`; `aip-runner`; và một cụm "chưa hiện thực"/"not implemented". Mọi từ khóa phải nằm trong đoạn, không phải trong README nói chung.
- [ ] **Step 2: Chạy `node test/validate.mjs --only ci-review-docs`.** Mong đợi: FAIL.
- [ ] **Step 3: Viết mục README EN/VI** (nội dung tương đương hai ngôn ngữ, ngắn): file ví dụ và cách dùng (chép vào `.github/workflows/`, điền SHA, secret `ANTHROPIC_API_KEY`, URL marketplace); điều kiện an toàn (chỉ đọc, `pull_request`, quyền, SHA, `dontAsk`, danh sách tool, trần lượt/ngân sách, prompt cố định, đầu ra là job summary, không bình luận); giới hạn: chỉ nhánh cùng repo (PR từ fork bị bỏ qua bởi `if`, và GitHub không đưa secret cho fork), `claude -p` không `--bare` nạp hook và `.mcp.json` của project không hỏi tin cậy `[Unverified]` ([headless](https://code.claude.com/docs/en/headless); tài liệu Action nói với PR nó khôi phục `.claude/` và `.mcp.json` từ nhánh base `[Unverified]`) nên chỉ chạy trên nhánh tin cậy; nội dung PR (diff, comment) là đầu vào không tin cậy, reviewer chỉ đọc nhưng có thể bị prompt-injection nên không cấp thêm tool; Action cần `id-token: write` ở cấu hình mặc định `[Unverified]` — ví dụ không cấp, người dùng tự kiểm; P6b (`aip-runner`, LangGraph, repo riêng) là thiết kế sơ bộ, chưa hiện thực. Nối bằng một câu vào đoạn `Agents in CI` đã có (không lặp lại công thức). Nếu `CLAUDE.md` mô tả `templates/` thì thêm `templates/ci` ship nhưng không được `aip init` sao chép.
- [ ] **Step 4: Chạy lại pin.** Mong đợi: PASS.
- [ ] **Step 5: Commit** `docs(ci): document read-only PR review recipe` qua `core:git-workflow`.

### Task 4: Đồng bộ spec tổng, kiểm chứng cuối
**Phủ AC:** AC3.1, AC4.1
**Files:**
- Modify: `docs/requests/2026-10-21-aip-trends-master-spec/design.md` (bảng project: P6a xong kèm hash merge là chỗ giữ `—` tới khi phiên điều phối merge; P6b giữ "thiết kế sơ bộ, chưa hiện thực"; dòng "Thứ tự thực tế"; bảng trace xu hướng 6, 7, 8 ghi P4 và P6a; dòng P4/P5c nếu còn lệch; bỏ chữ "chờ duyệt" của P6a)
- Modify: `docs/requests/2026-10-21-ci-runner/design.md` (checkbox AC có bằng chứng; header "đã hiện thực, chờ merge")
- Test: kiểm đọc spec tổng (AC3.1) + chạy toàn bộ
- Cập nhật nếu cần: `plugins/_versions.lock.json` chỉ qua `node cli/lib/versions.mjs --lock`

**Interfaces:**
- Consumes: kết quả Task 1–3.
- Produces: không có (task cuối).

- [ ] **Step 1: Sửa spec tổng** theo Files; P4 đã có `e363048`, P3 `480edd2`, P5c `4186bf4` (kiểm dòng hiện có trước khi sửa, chỉ sửa chỗ lệch). Không bịa hash merge của P6a; để `—` và nói "xong, chờ merge".
- [ ] **Step 2: Kiểm AC3.1 bằng đọc** `grep -n "6a\|6b\|e363048" docs/requests/2026-10-21-aip-trends-master-spec/design.md`: P4 ghi xong `e363048`, P6a/P6b có hai dòng trạng thái đúng, bảng trace xu hướng 6/7/8 phản ánh P4 và P6a.
- [ ] **Step 3: Tick AC của design** có bằng chứng (AC1.1–AC2.1 theo test, AC3.1 theo Step 2); AC4.1 tick sau Step 4.
- [ ] **Step 4: Kiểm chứng toàn bộ.** `npm run build`; `node cli/lib/versions.mjs --lock` (dự kiến không đổi gì; nếu từ chối vì nội dung đổi mà version không đổi thì bump đúng một lần ở plugin chủ rồi chạy lại); `npm test`; `npm run pack:verify`; `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-ci-runner` (không W10–W14); `git status` sạch trừ file dự kiến. Mong đợi: tất cả xanh.
- [ ] **Step 5: Commit** `docs(requests): sync master spec for P6a` qua `core:git-workflow`.
