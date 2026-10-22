# Agent song song, mỗi agent một worktree Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuẩn hóa cách chạy nhiều agent song song trong worktree riêng: mục baseline, script cảnh báo chia việc chồng file, test hook trong worktree, tài liệu và spec sống.
**Architecture:** Không đổi mã hook. Thêm một script zero-dep cạnh `check-request.mjs` (dùng lại `linesOf` của nó), một contract test dựng repo git tạm có worktree thật, một mục baseline sao nguyên byte sang `AGENTS.md`, README EN/VI, và hai yêu cầu mới trong spec sống `hooks-gates`.
**Tech Stack:** Node.js 20+ built-ins (ESM), harness `ok(cond, msg)` của `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Zero-dep, Node built-ins; UTF-8 không BOM, LF; comment code tiếng Việt chỉ nêu *vì sao*; baseline tiếng Anh; README EN/VI.
- Bump `core`; chạy `node cli/lib/versions.mjs --lock`; gói npm vẫn chỉ ship core (`pack:verify`).
- Nhánh `feature/p3-parallel-agents`, commit mỗi task qua `core:git-workflow` (header tiếng Anh, thân tiếng Việt có dấu, `git commit -F`, không dòng Co-Authored-By); không push.
- Trên Windows không `rm -rf` thư mục có junction từ Git Bash (kể cả trong test); dọn bằng Node `fs.rmSync`.
- Không đổi mã `guard-*`/`gate-*`/`gate-config`; không thêm lệnh `aip`; không bật `isolation: worktree` cho agent hiện có.
- Cảnh báo của script mới chỉ là cảnh báo: exit 1 chỉ khi `--strict` mà có cảnh báo, exit 2 khi sai đối số.
- Mã cảnh báo `P1`, `P2` (không lẫn `W1–W14`). Số agent song song tối đa khuyến nghị: 3.

## Review Focus

- `plan.md` CRLF hoặc BOM: phải cho cùng kết quả như LF (task 1).
- Tên nhóm khác hoa/thường hoặc thừa khoảng trắng (`a` vs `A `) vẫn là một nhóm; đường dẫn khác hoa/thường (`Src/A.js` vs `src/a.js`) vẫn tính trùng, vì Windows coi chúng cùng file (task 1).
- Đường dẫn dạng `./src/a.js`, `src\a.js`, hậu tố `:12-30` phải quy về cùng một dạng trước khi so (task 1).
- Heading task không phải đúng `### Task N:` (ví dụ `## Task 2 —`) vẫn được nhận (task 1).
- Worktree của một clone riêng (không chung `--git-common-dir` với repo có `aip-gate.json`) không được lấy nhầm cấu hình của repo khác: kết quả `null` (task 2).

---

### Task 1: Script `check-partition.mjs`
**Phủ AC:** AC2.1, AC2.2, AC2.3
**Song song:** A
**Files:**
- Create: `core/skills/artifact-templates/scripts/check-partition.mjs`
- Modify: `core/skills/artifact-templates/SKILL.md`
- Test: `test/content/24-check-partition.pin.mjs`

**Interfaces:**
- Consumes: `linesOf(text: string): string[]` từ `check-request.mjs` (cùng thư mục; dòng trong khối code fence thành `''`, giữ số dòng).
- Produces:
  - `parsePartition(planText: string): Array<{ n: number, title: string, line: number, group: string | null, files: string[] }>` — `group` đã trim + hạ chữ thường, `null` nếu task không có dòng `**Song song:**`; `files` đã chuẩn hóa (xem `normPath`).
  - `normPath(p: string): string` — bỏ hậu tố `:<số>[-<số>]…`, đổi `\` thành `/`, bỏ `./` đầu, hạ chữ thường.
  - `pathsOverlap(a: string, b: string): boolean` — hai đường dẫn đã qua `normPath`; mục có `*` hoặc kết thúc bằng `/` là tiền tố (phần trước `*` đầu tiên, hoặc cả đường dẫn thư mục); trùng khi bằng nhau, hoặc một tiền tố là tiền tố của mục kia.
  - `checkPartition(planText: string): Array<{ line: number, code: 'P1' | 'P2', msg: string }>`.
  - `main(argv: string[]): number` — `<thư-mục-request> [--strict]`, in `WARN plan.md:<dòng> [P1] <msg>` rồi `<N> cảnh báo` (cùng khuôn `check-request.mjs`); chỉ chạy khi gọi trực tiếp (cùng cơ chế `invoked` với `realpath` của `check-request.mjs`).

- [ ] **Step 1: Viết test (đỏ).** Tạo `test/content/24-check-partition.pin.mjs` (`export default async function run({ ok, ctx })`, import script bằng `ctx.pathToFileURL`). Bảng tham số hóa `plan × kết quả mong đợi`, mỗi dòng gọi `checkPartition` và so danh sách mã; tên test mang ID AC để `check-request` nhận:
  - `AC2.1`: hai task cùng nhóm `A` cùng `src/a.js` → đúng một `P1`, `msg` chứa `Task 1`, `Task 2`, `src/a.js`; `src/**` với `src/a.js` → `P1`; `src/` với `src/a/b.js` → `P1`; hai file rời nhau → `[]`; cùng file nhưng nhóm khác nhau → `[]`; một trong hai task không có nhóm → `[]`; nhóm `a` và `A ` → coi là một nhóm; `Src\A.js:12-30` với `./src/a.js` → `P1`; plan CRLF + BOM cho kết quả giống bản LF; heading `## Task 2 — x` được nhận.
  - `AC2.2`: task nhóm `A` ghi `plugins/_versions.lock.json`, `plugins/backend/.manifest.json`, `docs/specs/hooks-gates/spec.md`, `README.md`, `README_VI.md` → mỗi file một `P2`; cùng file ở task không nhóm → `[]`.
  - `AC2.3`: plan không có `**Song song:**` nào → `[]`; task có nhóm nhưng thiếu `**Files:**` → `[]`.
  - CLI (`main` qua `ctx.execFileSync('node', [script, dir, ...])` trên thư mục tạm có `plan.md` chồng file): không `--strict` → exit 0 và có dòng `[P1]`; `--strict` → exit 1; thiếu đối số hoặc cờ lạ → exit 2; thư mục không có `plan.md` → exit 0, `0 cảnh báo`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only check-partition`.** Mong đợi: FAIL (thiếu script).
- [ ] **Step 3: Hiện thực** các hàm ở Interfaces trong `check-partition.mjs`. Task = đoạn từ heading `#{2,4} Task <n>` tới heading kế; vùng `**Files:**` = dòng đó + các dòng `- ` liền sau, lấy mọi đoạn trong cặp backtick không chứa khoảng trắng (cùng quy tắc `planTestPaths`). P1: mỗi cặp task cùng nhóm có cặp mục trùng báo đúng một lần (dòng = heading của task sau); P2: chỉ với task có nhóm, file có basename `.manifest.json`, hoặc `plugins/_versions.lock.json`, hoặc bắt đầu `docs/specs/`, hoặc khớp `^readme(_[a-z]+)?\.md$` ở gốc; `msg` P2 nói các file này làm ở phiên chính sau gộp. Comment chỉ giải thích vì sao so không phân biệt hoa/thường (Windows) và vì sao chỉ cảnh báo.
- [ ] **Step 4: Chạy lại `node test/validate.mjs --only check-partition`.** Mong đợi: PASS.
- [ ] **Step 5: Thêm vào `core/skills/artifact-templates/SKILL.md`** (ngay sau đoạn mô tả `check-request.mjs`, và mục "Tài nguyên" cuối file) một câu: `scripts/check-partition.mjs <thư-mục-request> [--strict]` cảnh báo P1/P2 khi task cùng nhóm `**Song song:**` ghi trùng file hoặc file chung; chọn tham gia, không có nhóm thì im.
- [ ] **Step 6: Dogfood.** Chạy `node core/skills/artifact-templates/scripts/check-partition.mjs docs/requests/2026-10-22-parallel-agents`. Mong đợi: `0 cảnh báo` (plan này tự đánh dấu nhóm `A`).
- [ ] **Step 7: Commit** `feat(core): add check-partition script for parallel task file overlap` qua `core:git-workflow`.

### Task 2: Contract hook trong worktree
**Phủ AC:** AC3.1, AC3.2
**Song song:** A
**Files:**
- Create: `test/contract/93-hooks-worktree.contract.mjs`

**Interfaces:**
- Consumes: `readGateConfig(dir: string): object | null` (`core/hooks/scripts/gate-config.mjs`); `decide(input, opts)` của `core/hooks/scripts/guard-files.mjs` (không truyền `rootOf` để dùng `gitRoot` thật; `scopes` là bảng `{ <tên-agent>: string[] }`).
- Produces: không có (chỉ test).

- [ ] **Step 1: Viết test.** Module `export default async function run({ ok, ctx })`. Dựng trong `fs.mkdtempSync(path.join(os.tmpdir(), 'aip-wt-'))` rồi `fs.realpathSync.native` (tránh lệch đường dẫn ngắn/dài trên Windows) một repo chính: `git init -q`, đặt `user.name`/`user.email` cục bộ, commit một file, `git worktree add <tmp>/wt -b wt-branch`; ghi `.claude/aip-gate.json` `{"stopGate":false}` chỉ ở repo chính (không commit). Dọn bằng `fs.rmSync(tmp, { recursive: true, force: true })` trong `finally`. Các khẳng định (tên mang ID):
  - `AC3.1: readGateConfig từ thư mục con của worktree lấy cấu hình repo chính` → `{ stopGate: false }`.
  - `AC3.1: worktree có file riêng thì dùng file của worktree` → ghi `{"stopGate":true}` vào `wt/.claude/aip-gate.json` → `{ stopGate: true }`.
  - `AC3.1: repo độc lập (không chung git-common-dir) không lấy cấu hình repo khác` → thư mục tạm thứ hai `git init` riêng → `null`.
  - `AC3.2: writeScope neo theo gốc worktree` → với `scopes = { tester: ['test/**'] }`, `decide({ tool_name: 'Write', cwd: wt, agent_type: 'p:tester', tool_input: { file_path: <wt>/test/a.test.js } }, { scopes })` → `null`; cùng input với `<wt>/src/a.js` → `decision === 'deny'`.
- [ ] **Step 2: Chạy `node test/validate.mjs --only hooks-worktree`.** Mong đợi: PASS. Nếu FAIL, đó là lỗi thật của hook trong worktree: dừng, báo, không sửa hook trong task này.
- [ ] **Step 3: Commit** `test(core): cover gate-config and guard-files inside a git worktree`.

### Task 3: Mục baseline `Parallel agents`
**Phủ AC:** AC1.1
**Song song:** A
**Files:**
- Modify: `core/agents/AGENTS.template.md`
- Modify: `AGENTS.md`
- Test: `test/content/25-parallel-agents-docs.pin.mjs`

**Interfaces:**
- Consumes: không có.
- Produces: heading `### Parallel agents` trong template, đặt giữa `### Agents in CI` và `### Model and session routing`; task 4 bổ sung vào cùng file test.

- [ ] **Step 1: Viết test (đỏ)** `test/content/25-parallel-agents-docs.pin.mjs`: lấy đoạn từ `### Parallel agents` tới heading `###` kế (làm phẳng khoảng trắng); khẳng định `AC1.1`: chứa `worktree-<slug>-t<n>`, `.claude/worktrees/`, `merge --no-ff`, `integration branch`, `3`, `disjoint`, `rm -rf`, `junction`, `once` (bước chạm file chung làm một lần); nằm giữa hai heading láng giềng; `AGENTS.md` giống template từng byte.
- [ ] **Step 2: Chạy `node test/validate.mjs --only parallel-agents`.** Mong đợi: FAIL.
- [ ] **Step 3: Viết mục** (tiếng Anh, ≤ 20 dòng, soft guidance) với sáu quy tắc đúng như design: (1) song song chỉ cho task độc lập có tập file ghi rời nhau, tập file khai báo trong `plan.md` bằng `**Files:**` + `**Song song:**`; (2) tên nhánh `worktree-<slug>-t<n>` tại `.claude/worktrees/<slug>-t<n>/`, cắt từ tip nhánh tích hợp `feature/<slug>`; (3) bước chạm file chung (bump version, lock, spec sống, README) làm một lần ở phiên chính sau khi gộp; (4) phiên chính gộp bằng `merge --no-ff` về nhánh tích hợp, chạy test của thành phần chạm tới sau mỗi lần gộp, xung đột ngoài tập khai báo = dừng và báo; con người duyệt cả nhánh, không PR riêng từng agent; (5) tối đa 3 agent song song ([Inference] heuristic, không phải số chính thức); (6) dọn bằng `git worktree remove`, không `rm -rf` thư mục có junction trên Windows, chỉ dọn worktree đã gộp và sạch. Nêu rõ chỉ `writeScope` + `guard-files` ép buộc; còn lại là hướng dẫn. Sao nguyên nội dung template sang `AGENTS.md` (byte-for-byte).
- [ ] **Step 4: Chạy lại `node test/validate.mjs --only parallel-agents`**, rồi `node test/validate.mjs --only bytes` (hoặc tên module `70-bytes`). Mong đợi: PASS.
- [ ] **Step 5: Commit** `docs(core): add Parallel agents section to the baseline`.

### Task 4: README EN/VI và CLAUDE.md
**Phủ AC:** AC1.2
**Files:**
- Modify: `README.md`
- Modify: `README_VI.md`
- Modify: `CLAUDE.md`
- Modify: `.gitignore` (chỉ khi bước 1 cho thấy cần)
- Test: `test/content/25-parallel-agents-docs.pin.mjs`

**Interfaces:**
- Consumes: mục baseline của task 3 (đã có trong cùng file test).
- Produces: đoạn in đậm `**Parallel agents.**` (EN) và `**Agent song song.**` (VI) trong mục `## Hooks`, đặt ngay sau đoạn `**Agents in CI.**`/`**Agent trong CI.**` và các đoạn kèm theo của P4, trước `**Limits / residual risk.**`.

- [ ] **Step 1: Kiểm `.gitignore`.** Chạy `git -C <checkout-chính> status --short` (chỉ đọc; checkout chính là thư mục cha của `.claude/worktrees/`; đường dẫn lấy từ `git worktree list`). Nếu `.claude/worktrees/` hiện là untracked, thêm đúng một dòng `.claude/worktrees/` vào `.gitignore`; nếu không, không đổi file này và ghi kết quả vào báo cáo task.
- [ ] **Step 2: Viết test (đỏ)** bổ sung vào `25-parallel-agents-docs.pin.mjs`: với từng cặp (`README.md`, `**Parallel agents.**`) và (`README_VI.md`, `**Agent song song.**`), đoạn từ mốc tới mốc `**Limits / residual risk.**` / `**Giới hạn / residual risk.**` (hàm `upTo` như `23-agent-permissions.pin.mjs`) phải chứa `claude --worktree`, `worktree-<slug>-t<n>`, `check-partition.mjs`, `[Verified`, `[Unverified`, `isolation: worktree`, `code.claude.com/docs/en/worktrees`, `merge --no-ff`, và câu aip không tự chạy agent (`does not run agents` / `không tự chạy agent`); `AC1.2`: `CLAUDE.md` (làm phẳng) chứa `check-partition.mjs`, `Parallel agents` và `worktree-<slug>-t<n>`.
- [ ] **Step 3: Chạy `node test/validate.mjs --only parallel-agents`.** Mong đợi: FAIL ở phần README/CLAUDE.
- [ ] **Step 4: Viết đoạn README EN rồi VI** (cùng nội dung): công thức từng bước (tạo worktree bằng `claude --worktree <slug>-t<n>` từ nhánh tích hợp, giao task, gộp `--no-ff`, dọn), bảng ngắn điều đã [Verified] kèm URL (worktrees/hooks/sub-agents/agent-teams/costs, đúng như mục "Vấn đề và lý do" của design) và điều [Unverified] (`isolation: worktree` với agent plugin và headless/SDK, tên nhánh worktree subagent, ràng buộc một-nhánh-một-worktree), nêu `aip` không tự chạy agent và chỉ `writeScope` + `guard-files` ép phạm vi ghi. Trước khi chép bảng, đọc lại hai trang `worktrees` và `sub-agents` trên code.claude.com để sửa bảng nếu khác design (phần `sub-agents` từng bị cắt khi tra); ghi chênh lệch vào báo cáo. Thêm vào `CLAUDE.md` (mục mô tả `check-request.mjs` và mục baseline/hook) nhắc `check-partition.mjs` và quy ước `worktree-<slug>-t<n>`.
- [ ] **Step 5: Chạy lại `node test/validate.mjs --only parallel-agents`.** Mong đợi: PASS.
- [ ] **Step 6: Commit** `docs: document parallel agents worktree convention in README and CLAUDE.md`.

### Task 5: Spec sống, version và kiểm toàn bộ
**Phủ AC:** AC4.1, AC5.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`
- Modify: `docs/requests/2026-10-22-parallel-agents/design.md`
- Modify: `docs/requests/2026-10-22-parallel-agents/plan.md`
- Test: `test/content/25-parallel-agents-docs.pin.mjs`

**Interfaces:**
- Consumes: kết quả task 1–4 (script, contract, baseline, README).
- Produces: `hooks-gates/R4`, `hooks-gates/R5` trong spec sống.

- [ ] **Step 1: Viết test (đỏ)** bổ sung vào `25-parallel-agents-docs.pin.mjs`: `AC4.1` — `docs/specs/hooks-gates/spec.md` có dòng `**hooks-gates/R4**` và `**hooks-gates/R5**` trong mục `## Yêu cầu`, mỗi dòng có link tới `2026-10-22-parallel-agents/design.md` và hai dòng mới trong bảng `Lịch sử`; `docs/specs/README.md` vẫn liệt kê đủ 7 năng lực.
- [ ] **Step 2: Chạy `node test/validate.mjs --only parallel-agents`.** Mong đợi: FAIL.
- [ ] **Step 3: Sửa spec** theo template `spec.template.md`: `R4` — khi chạy trong một git worktree, các hook đọc `aip-gate.json` ở gốc worktree trước, không có thì ở gốc repo chính; repo không chung `git-common-dir` thì không có cấu hình (`null`); `R5` — `guard-files` neo `writeScope` theo gốc git của file đích, nên phạm vi áp theo worktree chứa file. Cập nhật dòng `Cập nhật:` (2026-10-22), mục `Phạm vi` (thêm "hành vi trong worktree"), bảng `Lịch sử` (thêm, ngày 2026-10-22).
- [ ] **Step 4: Bump và khóa version.** Nâng `core/.manifest.json` `1.11.1` → `1.12.0`; chạy `npm run build`, rồi `node cli/lib/versions.mjs --lock`. Nếu lệnh từ chối vì thành phần khác đổi nội dung mà chưa bump, bump đúng thành phần nó nêu rồi chạy lại.
- [ ] **Step 5: Kiểm toàn bộ.** Chạy lần lượt: `npm test`, `npm run pack:verify`, `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-22-parallel-agents --base master` (mong đợi không W10–W14; W13 nay thỏa vì spec đã đổi), `node core/skills/artifact-templates/scripts/check-partition.mjs docs/requests/2026-10-22-parallel-agents`. Mọi lệnh xanh hoặc `0 cảnh báo`.
- [ ] **Step 6: Tick AC** AC1.1–AC5.1 trong `design.md` bằng `[x]` chỉ khi có lệnh ở Step 5 hoặc test đã chạy làm bằng chứng; tick các step đã làm trong `plan.md`; sửa dòng `Trạng thái` của design thành "đã duyệt và thực thi" kèm hash commit cuối (chưa có merge).
- [ ] **Step 7: Commit** `docs(requests): add hooks-gates R4-R5, bump core and tick P3 acceptance criteria`.

## Thực thi

Theo `CLAUDE.md` mục `Superpowers workflow defaults`: `superpowers:subagent-driven-development`, mỗi task một commit trên `feature/p3-parallel-agents`, `npm test` một lần sau vòng sửa cuối, `finishing-a-development-branch` mặc định giữ nhánh. Task 1–3 chạm tập file rời nhau và cùng nhóm `A` nên **có thể** chạy song song (mỗi task một worktree `worktree-parallel-agents-t<n>`, gộp `--no-ff` về `feature/p3-parallel-agents` theo thứ tự 1, 2, 3); thực thi tuần tự vẫn đúng và là mặc định. Task 4 và 5 chạy sau, ở phiên chính.
