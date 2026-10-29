# Kế hoạch: bổ sung bootstrap, TDD, debug, worktree và thực thi plan inline
- Design: [design.md](design.md)
- Nhánh: `feature/superpowers-gap-closure`

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** thêm lớp kỷ luật hành vi còn thiếu so với superpowers: bootstrap gọi skill, TDD, debug, worktree, thực thi plan inline.
**Architecture:** hai skill mới và một hook sửa trong `core`; hai skill mới trong `engineering`; một file tham chiếu và một hàm kiểm dòng trong `plan-execution`; không đổi contract đầu ra, không đổi cạnh graph.
**Tech Stack:** Markdown skill, Node 20 ESM không dependency, bộ test `test/validate.mjs`.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/skills/using-aip/SKILL.md` | Quy tắc gọi skill trước khi hành động | Task 1 |
| `core/hooks/scripts/session-start.mjs` | Nạp văn bản bootstrap khi mở phiên | Task 1 |
| `core/skills/git-worktree/SKILL.md` | Tạo và dọn worktree theo quy ước baseline | Task 2 |
| `core/skills/plan-execution/references/inline.md` | Giao thức thực thi plan trong session chính | Task 3 |
| `core/skills/plan-execution/scripts/ledger.mjs` | Ghi ledger và từ chối dòng inline thiếu evidence | Task 3 |
| `plugins/engineering/skills/engineering-tdd/` | Kỷ luật TDD và anti-pattern | Task 4 |
| `plugins/engineering/skills/engineering-debugging/` | Debug có hệ thống và bốn tài liệu bổ trợ | Task 5 |
| `workflows/bugfix/WORKFLOW.md`, `workflows/orchestrator/WORKFLOW.md` | Trỏ tới skill debug và định tuyến | Task 5 |
| `evals/core/bootstrap-skill-first/`, `evals/engineering/tdd-red-first/`, `evals/engineering/debugging-root-cause-first/` | Ba case đo hành vi | Task 6 |
| `test/content/32-superpowers-gap.pin.mjs` | Pin nội dung đặc thù của các skill mới | Task 1 (tạo), Task 2–5 (mở rộng) |

## Global Constraints
- Mô tả skill ≤ 500 ký tự theo mẫu "Dùng khi … Không dùng khi … → id"; thân skill có `## Quy trình…` và `## Ranh giới an toàn…`.
- Nội dung tiếng Việt có dấu; UTF-8 không BOM, LF; viết lại, không chép nguyên văn từ superpowers.
- Văn bản bootstrap ≤ 1200 ký tự; tổng `additionalContext` của `session-start` ≤ 9000 ký tự (`MAX_TOTAL`).
- Hook zero-dependency, fail-open, không ghi file; cấu hình `bootstrapInject` mặc định bật.
- Mỗi task đổi nội dung chiếu thì bump version của manifest sở hữu và chạy `node cli/lib/versions.mjs --lock`; test đếm số skill đỏ thì sửa con số trong cùng task, không thêm pin mới.
- Mỗi task kết thúc bằng một commit qua `core:git-workflow`, không `Co-authored-by` (AGENTS.md mục Safety). Giữa các task chỉ chạy `node test/validate.mjs --build`; full suite chạy một lần ở bước kết thúc nhánh.
- Tham chiếu `engineering-tdd` và `engineering-debugging` từ plugin khác phải ở dạng có điều kiện ("khi skill đã cài"), vì plugin `engineering` là opt-in.
- Task chạy tuần tự (chung `core/.manifest.json` và `plugins/_versions.lock.json`), không dùng `**Song song:**`.
- Kết thúc nhánh theo `finish.md`: cập nhật `docs/specs/hooks-gates/spec.md` (R12) và `docs/specs/workflows/spec.md` (R12, R13) theo `## Ảnh hưởng spec`.

## Review Focus
- Test `session-start` hiện có kỳ vọng `null` khi không có handoff/ledger sẽ đổi vì bootstrap luôn có mặt: Task 1 step 1 cập nhật chúng thành tham số hoá theo `bootstrapInject`.
- Tổng `additionalContext` vượt 9000 khi handoff dài cộng ledger đầy: Task 1 step 1 có ca handoff 20.000 ký tự.
- `validateLine` chặn nhầm dòng ledger cũ (`Task <n>: complete (…, review clean)`, `Ruling:`, `minor (deferred)`): Task 3 step 1 có ca cho từng dạng.
- Tham chiếu `engineering-tdd`/`engineering-debugging` làm gãy plugin `backend`/`frontend` khi chưa cài `engineering`: pin ở Task 4 và Task 5 kiểm cụm có điều kiện.
- Trigger trùng giữa `engineering-debugging`, `backend-fix`, `frontend-fix` và `workflow-bugfix`: Task 5 step 4 chạy `npm run overlap`.

### Task 1: Bootstrap `using-aip` và hook session-start
**Kind:** TOOLING
**Phủ AC:** AC1.1, AC1.2, AC1.3
**Files:**
- Create: `core/skills/using-aip/SKILL.md`, `test/content/32-superpowers-gap.pin.mjs`
- Modify: `core/hooks/scripts/session-start.mjs`, `core/.manifest.json`, `plugins/_versions.lock.json`, `CLAUDE.md`, `README.md`, `README_VI.md`
- Test: `test/contract/90-hooks.contract.mjs`, `test/content/32-superpowers-gap.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: skill id `using-aip`; khoá `bootstrapInject` (boolean, mặc định bật) trong `.claude/aip-gate.json`; `decide(input, deps)` của `session-start.mjs` vẫn trả `{ additionalContext } | null`, nay mở đầu bằng văn bản bootstrap khi `source` ∈ {`startup`, `clear`, `compact`}

- [ ] **Step 1: Test đỏ.** Trong `90-hooks.contract.mjs` tham số hoá các ca theo `source` và `bootstrapInject` (AC1.1, AC1.2): startup/clear/compact có bootstrap chứa `using-aip` và ≤ 1200 ký tự; handoff 20.000 ký tự + ledger vẫn cho tổng ≤ 9000; `bootstrapInject:false`, `resume`, `fork` không có bootstrap; chuyển các ca cũ kỳ vọng `null` sang `bootstrapInject:false`. Chạy `node test/validate.mjs --build --only hooks`. Mong đợi: fail ở các ca bootstrap.
- [ ] **Step 2: Viết skill.** Tạo `using-aip/SKILL.md` theo design (quy tắc gọi skill, thứ tự ưu tiên, `SUBAGENT-STOP`, bảng dấu hiệu tự biện minh); tạo pin kiểm ba mục này (AC1.3).
- [ ] **Step 3: Cài hook.** Thêm hằng văn bản bootstrap ≤ 1200 ký tự trong `session-start.mjs`, đặt trước handoff, trừ phần của nó khỏi `room`; bỏ qua khi `cfg.bootstrapInject === false`; giữ chú thích "chép nhỏ, không import skill".
- [ ] **Step 4: Chiếu.** Bump `core` (minor), cập nhật số skill ở `CLAUDE.md`, README cặp EN/VI và test đếm nếu đỏ; chạy `npm run build`, `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`. Mong đợi: 0 fail.
- [ ] **Step 5: Commit** `feat(core): add using-aip skill and session bootstrap`.

### Task 2: Skill `git-worktree`
**Kind:** DOCS
**Phủ AC:** AC4.1
**Files:**
- Create: `core/skills/git-worktree/SKILL.md`
- Modify: `test/content/32-superpowers-gap.pin.mjs`, `core/.manifest.json`, `plugins/_versions.lock.json`, `CLAUDE.md`, `README.md`, `README_VI.md`
- Test: `test/content/32-superpowers-gap.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: skill id `git-worktree`

- [ ] **Step 1: Pin đỏ.** Thêm vào pin: skill có `worktree-<slug>-t<n>`, `.claude/worktrees/<slug>-t<n>/`, `git worktree remove`, và cấm `rm -rf` (AC4.1). Chạy `node test/validate.mjs --build --only superpowers-gap`. Mong đợi: fail vì skill chưa có.
- [ ] **Step 2: Viết skill** (≤ 120 dòng): kiểm trước (thư mục bị git bỏ qua, nhánh tích hợp sạch, baseline test xanh trong worktree mới), tạo từ tip nhánh tích hợp, merge `--no-ff` ở session chính, dọn chỉ khi đã merge và sạch, cảnh báo junction Windows và dùng `fs.rmSync` khi cần; không thêm script.
- [ ] **Step 3: Chiếu.** Bump `core` (patch), cập nhật số skill, `npm run build`, `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`. Mong đợi: 0 fail.
- [ ] **Step 4: Commit** `feat(core): add git-worktree skill`.

### Task 3: Thực thi plan inline
**Kind:** TOOLING
**Phủ AC:** AC5.1, AC5.2
**Files:**
- Create: `core/skills/plan-execution/references/inline.md`
- Modify: `core/skills/plan-execution/SKILL.md`, `core/skills/plan-execution/references/task-loop.md`, `core/skills/plan-execution/scripts/ledger.mjs`, `test/content/32-superpowers-gap.pin.mjs`, `core/.manifest.json`, `plugins/_versions.lock.json`
- Test: `test/contract/00-unit.contract.mjs`, `test/content/32-superpowers-gap.pin.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `validateLine(line: string): string | null` xuất từ `ledger.mjs` (`null` = hợp lệ, chuỗi = lý do từ chối); `main` trả exit 2 và không ghi khi bị từ chối; tệp `references/inline.md`

- [ ] **Step 1: Unit test đỏ.** Trong `00-unit.contract.mjs` thêm một test tham số hoá cho `validateLine` (AC5.2): từ chối `Task 2: complete (commits a..b, inline)` và `… inline, tests: npm test exit 1)`; chấp nhận `… inline, tests: npm test exit 0)`, `Task 2: complete (commits a..b, review clean)`, `Ruling: …`, `minor (deferred): …`, `Plan: complete`. Chạy `node test/validate.mjs --build --only unit`. Mong đợi: fail vì chưa có `validateLine`.
- [ ] **Step 2: Cài `validateLine`** và gọi nó trong `main` trước `appendLedger`; thêm chú thích lý do (dòng inline là bằng chứng duy nhất vì không có review từng task).
- [ ] **Step 3: Viết `inline.md`** theo design; sửa `SKILL.md` (liên kết, điều kiện bật, câu "không hỏi lại cách thực thi") và thay đoạn dự phòng trong `task-loop.md` bằng con trỏ tới `inline.md`; thêm vào pin các kiểm AC5.1.
- [ ] **Step 4: Chiếu.** Bump `core` (minor), `npm run build`, `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`. Mong đợi: 0 fail.
- [ ] **Step 5: Commit** `feat(plan-execution): add inline execution mode with ledger evidence check`.

### Task 4: Skill `engineering-tdd`
**Kind:** DOCS
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Create: `plugins/engineering/skills/engineering-tdd/SKILL.md`, `plugins/engineering/skills/engineering-tdd/references/anti-patterns.md`
- Modify: `plugins/backend/skills/backend-implement/SKILL.md`, `plugins/frontend/skills/frontend-implement/SKILL.md`, `plugins/engineering/.manifest.json`, `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`, `plugins/_versions.lock.json`, `test/content/32-superpowers-gap.pin.mjs`, `CLAUDE.md`
- Test: `test/content/32-superpowers-gap.pin.mjs`, `test/contract/40-conventions.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: skill id `engineering-tdd`; định dạng `tdd: { red, green }` của contract đầu ra không đổi

- [ ] **Step 1: Pin đỏ.** Pin kiểm (AC2.1) skill có luật test đỏ trước, bảng biện minh và dẫn chiếu "một hành vi một test"; (AC2.2) `backend-implement` và `frontend-implement` chứa `engineering-tdd` kèm cụm có điều kiện. Mong đợi: fail.
- [ ] **Step 2: Viết skill và `anti-patterns.md`**, căn theo mục Testing của `AGENTS.md` (không tăng số test để "đủ", không test chỉ assert mock).
- [ ] **Step 3: Sửa hai skill implement** để trỏ tới `engineering-tdd` ở bước viết test, nói rõ "khi skill đã cài; thiếu thì làm theo bước trong skill này".
- [ ] **Step 4: Chiếu.** Bump `engineering` (minor), `backend`, `frontend` (patch), cập nhật mô tả và số skill của `engineering`, `npm run build`, `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`. Mong đợi: 0 fail.
- [ ] **Step 5: Commit** `feat(engineering): add engineering-tdd skill`.

### Task 5: Skill `engineering-debugging`
**Kind:** DOCS
**Phủ AC:** AC3.1, AC3.2
**Files:**
- Create: `plugins/engineering/skills/engineering-debugging/SKILL.md`, `plugins/engineering/skills/engineering-debugging/references/root-cause-tracing.md`, `plugins/engineering/skills/engineering-debugging/references/defense-in-depth.md`, `plugins/engineering/skills/engineering-debugging/references/condition-based-waiting.md`, `plugins/engineering/skills/engineering-debugging/references/polluter-bisect.md`
- Modify: `workflows/bugfix/WORKFLOW.md`, `workflows/orchestrator/WORKFLOW.md`, `workflows/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/_versions.lock.json`, `test/content/32-superpowers-gap.pin.mjs`, `CLAUDE.md`
- Test: `test/contract/50-workflows.contract.mjs`, `test/content/32-superpowers-gap.pin.mjs`

**Interfaces:**
- Consumes: skill id `engineering-tdd` (Task 4), dùng ở pha sửa để viết test tái hiện
- Produces: skill id `engineering-debugging`; một dòng định tuyến trong bảng "Yêu cầu chạy trực tiếp bằng skill" của orchestrator

- [ ] **Step 1: Pin đỏ.** Pin kiểm (AC3.1) skill có bốn pha và `SKILL.md` liên kết đủ bốn file `references/`; (AC3.2) bugfix Bước 4–5 chứa `engineering-debugging` kèm cụm có điều kiện, orchestrator có dòng định tuyến. Mong đợi: fail.
- [ ] **Step 2: Viết skill và bốn tài liệu bổ trợ**; `condition-based-waiting.md` cấm `sleep` cố định, khớp `AGENTS.md`.
- [ ] **Step 3: Sửa `workflow-bugfix`** (Bước 4–5, `requires` nếu validator đòi) và orchestrator; không đổi cạnh, `max_attempts`, gate. Chạy `npm run build`; nếu `checkGraphAgainstBody` đòi `run.skills` thì chỉ thêm id skill vào `graph.json`.
- [ ] **Step 4: Kiểm trùng lặp.** Chạy `npm run overlap`; chỉnh mô tả nếu trigger của skill mới lặp nguyên văn trigger của `backend-fix`, `frontend-fix`, `workflow-bugfix`.
- [ ] **Step 5: Chiếu.** Bump `engineering`, `workflows` (minor), `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`. Mong đợi: 0 fail.
- [ ] **Step 6: Commit** `feat(engineering): add engineering-debugging skill and bugfix routing`.

### Task 6: Ba case eval
**Kind:** TOOLING
**Phủ AC:** AC6.1
**Files:**
- Create: `evals/core/bootstrap-skill-first/prompt.md`, `evals/core/bootstrap-skill-first/graders/*.md`, `evals/engineering/tdd-red-first/prompt.md`, `evals/engineering/tdd-red-first/case.yaml`, `evals/engineering/tdd-red-first/scaffold.sh`, `evals/engineering/tdd-red-first/graders/*.md`, `evals/engineering/debugging-root-cause-first/prompt.md`, `evals/engineering/debugging-root-cause-first/case.yaml`, `evals/engineering/debugging-root-cause-first/scaffold.sh`, `evals/engineering/debugging-root-cause-first/graders/*.md`
- Modify: `evals/README.md`, `evals/README_VI.md`
- Test: `test/contract/95-evals.contract.mjs`

**Interfaces:**
- Consumes: skill id `using-aip` (Task 1), `engineering-tdd` (Task 4), `engineering-debugging` (Task 5)
- Produces: không có

- [ ] **Step 1: Viết ba case.** `bootstrap-skill-first`: prompt có test đỏ lạ, grader `skill-used` trước Edit đầu tiên. `tdd-red-first`: yêu cầu sửa bug, grader kiểm test đỏ được ghi trước Edit vào `src/`. `debugging-root-cause-first`: grader kiểm có giả thuyết kèm evidence trước Edit đầu và không có lần sửa thứ hai khi lần một thất bại. Case cần Bash gắn tag `linux-only` và giới hạn `Bash(<pattern>)`.
- [ ] **Step 2: Kiểm cấu trúc.** `node test/validate.mjs --build --only evals`. Mong đợi: 0 fail.
- [ ] **Step 3: Chạy thật — cần người dùng đồng ý trước.** Mỗi case `node scripts/eval-run.mjs --plugin <id> --max-cost-usd 2.5 --runs 3 --scaffold --case <tên>` (tối đa khoảng 7,5 USD cho ba case). Case `linux-only` chạy trong WSL2; không có WSL2 thì ghi `not_run` kèm lý do. Ghi n, chi phí, Δ và nhãn Δ đo cái gì vào hai README. Không đọc Δ như bằng chứng skill tốt hơn.
- [ ] **Step 4: Commit** `test(evals): add bootstrap, tdd and debugging cases`.
