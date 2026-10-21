# Dọn trạng thái design và gom trace lộ trình Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mọi design trong `docs/requests/` có trạng thái, commit merge, mã project và checkbox AC/plan khớp thực tế, và spec tổng là chỗ duy nhất trace lộ trình 9 xu hướng.
**Architecture:** Chỉ sửa tài liệu. Spec tổng (`design.md` cùng thư mục) là nguồn sự thật; các task sửa header của 6 design con, rồi tick AC/plan chỉ khi có bằng chứng chạy được. Không đụng code, không bump version.
**Tech Stack:** Markdown, `core/skills/artifact-templates/scripts/check-request.mjs`, `git`, `npm test`.
**Spec:** design.md
**Requirement:** không có

## Global Constraints

- Tiếng Việt có dấu, UTF-8 không BOM, LF.
- Chỉ file dưới `docs/` thay đổi; không bump version plugin, không chạy `versions.mjs --lock`.
- Làm trên nhánh `feature/docs-trends-master-spec`; commit mỗi task qua `core:git-workflow` (`git commit -F`), không dòng `Co-Authored-By`; không push, không đụng `master`.
- Chỉ tick `[x]` khi đã chạy lệnh hoặc đọc file chứng minh được; không chắc thì để `[ ]` và thêm ghi chú `[chưa kiểm]` cuối dòng.
- Không sửa nội dung kỹ thuật, ID hay lời văn AC của design con; chỉ sửa header và ký tự checkbox.
- Commit merge dùng đúng: 1b `c337dbc`, 1 `6913753`, 2a `dabc13f`, 2b `bb24f03`, 5a `4cb06ab`, 5b `aadc6c2`.
- Dòng lộ trình chuẩn: `- Thuộc lộ trình: [spec tổng](../2026-10-21-aip-trends-master-spec/design.md) — project <mã> (xu hướng <số>)`.

## Review Focus

- Tick nhầm AC chưa đạt (đặc biệt `verification-gate` AC3.1, AC3.2 phải giữ `[ ]`) → mỗi lần tick ghi lệnh/bằng chứng trong báo cáo task; kiểm ở Task 3.
- `[ ]` nằm trong ví dụ/template ở `docs-standard/design.md` (dòng 83, 113, 165) và ở plan của `artifact-templates`, `docs-standard` không phải checkbox thật → không tick, không đổi (Task 3).
- Commit merge ghi sai hash → kiểm `git merge-base --is-ancestor <hash> master` trước khi ghi (Task 2).
- Sửa header làm vỡ định dạng mà `check-request.mjs` đọc (dòng `- Ngày:`, `- Trạng thái:`) → chạy validator sau mỗi task và so số cảnh báo trước/sau (Task 2, 5).

---

### Task 1: Chốt spec tổng

**Phủ AC:** AC1.1
**Files:**
- Modify: `docs/requests/2026-10-21-aip-trends-master-spec/design.md`

**Interfaces:**
- Produces: spec có `Trạng thái: đã duyệt 2026-10-21` và 6 AC dạng `AC<n>.<m>` mà các task sau tham chiếu.

- [ ] **Step 1:** Tạo nhánh: `git switch -c feature/docs-trends-master-spec` (thư mục spec chưa track đi theo). Expected: `git branch --show-current` in `feature/docs-trends-master-spec`.
- [ ] **Step 2:** Đổi `- Trạng thái: chờ duyệt` thành `- Trạng thái: đã duyệt 2026-10-21`.
- [ ] **Step 3:** Thay mục "Tiêu chí chấp nhận" bằng 6 AC (giữ định dạng `- [ ] **AC<n>.<m>** — Given … Then …`): AC1.1 (9 xu hướng đều có dòng trace), AC2.1 (header "xong" ghi đúng commit merge), AC3.1 (6 design trỏ tới spec tổng kèm mã project), AC4.1 (`npm test` xanh, chỉ file dưới `docs/` đổi), và hai AC mới: **AC5.1** — Given `artifact-templates` và `superpowers-docs-standard`, Then mỗi AC thật được tick `[x]` khi có bằng chứng chạy được, AC không kiểm được giữ `[ ]` kèm `[chưa kiểm]`; **AC5.2** — Given plan của `long-session-context`, Then step đã thực hiện được tick theo commit trong git.
- [ ] **Step 4:** Thêm vào mục "Thiết kế" §4 một dòng cho `artifact-templates`/`docs-standard`: tick AC; và cho `long-session-context` plan: tick step; xoá câu "Chỉ sửa header trạng thái và dòng lộ trình" thay bằng "Chỉ sửa header, dòng lộ trình và ký tự checkbox".
- [ ] **Step 5:** Run `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-21-aip-trends-master-spec`. Expected: không còn cảnh báo W4; chỉ còn W7 cho AC chưa có test (chấp nhận được với việc chỉ sửa tài liệu).
- [ ] **Step 6:** Commit `docs(requests): approve trends master spec and add AC for checkbox cleanup`.

### Task 2: Header trạng thái và dòng lộ trình của 6 design

**Phủ AC:** AC2.1, AC3.1
**Files:**
- Modify: `docs/requests/2026-10-20-artifact-templates/design.md`, `docs/requests/2026-10-20-superpowers-docs-standard/design.md`, `docs/requests/2026-10-20-verification-gate/design.md`, `docs/requests/2026-10-20-workflow-graph/design.md`, `docs/requests/2026-10-21-model-session-routing/design.md`, `docs/requests/2026-10-21-long-session-context/design.md`

**Interfaces:**
- Consumes: bảng commit merge và mã project trong Global Constraints (spec §3).

- [ ] **Step 1:** Run `git merge-base --is-ancestor <hash> master` cho cả 6 hash. Expected: exit 0 cho mỗi hash; hash nào exit 1 thì dừng và báo.
- [ ] **Step 2:** Sửa dòng `- Trạng thái:` theo mẫu của `artifact-templates` (`**Đã duyệt và thực thi** — merge vào \`master\` = \`<hash>\` (<ngày>)`) cho `workflow-graph`, `model-session-routing`, `long-session-context`; ngày merge lấy từ `git log -1 --format=%cs <hash>`. `artifact-templates` và `docs-standard` giữ nguyên.
- [ ] **Step 3:** `verification-gate`: giữ nội dung hiện có, thêm "merge `dabc13f`" và "việc hoãn ghi ở mục 5 của spec tổng".
- [ ] **Step 4:** Thêm hoặc thay dòng `- Thuộc lộ trình:` (dòng chuẩn ở Global Constraints) ngay dưới `- Trạng thái:` trong cả 6 file, với mã/xu hướng: artifact-templates P1b (5), docs-standard P1 (3, 4), verification-gate P2a (7), workflow-graph P2b (7), model-session-routing P5a (9), long-session-context P5b (5). Với 3 file đã có dòng cũ thì thay dòng đó, giữ ý "tiền đề cho runner"/"2b làm sau" bằng cách dời vào cuối dòng nếu còn đúng.
- [ ] **Step 5:** Run `grep -c "Thuộc lộ trình: \[spec tổng\]" docs/requests/*/design.md`. Expected: `1` cho mỗi design con (6 file); spec tổng không cần dòng này.
- [ ] **Step 6:** Run `check-request.mjs` trên 6 thư mục. Expected: số cảnh báo không tăng so với trước (artifact-templates 6, docs-standard 6, verification-gate 1, workflow-graph 1, routing 1, long-session 0).
- [ ] **Step 7:** Commit `docs(requests): sync design status and roadmap links`.

### Task 3: Tick AC của `artifact-templates` và `superpowers-docs-standard`

**Phủ AC:** AC5.1
**Files:**
- Modify: `docs/requests/2026-10-20-artifact-templates/design.md:35-53`, `docs/requests/2026-10-20-superpowers-docs-standard/design.md:36-50`

**Interfaces:**
- Consumes: hành vi đã hiện thực trong `core/skills/artifact-templates/`, `templates/init/`, `core/agents/AGENTS.template.md`, `test/validate.mjs`.

- [ ] **Step 1:** Với từng AC trong hai khoảng dòng trên (19 + 15 AC thật), tìm bằng chứng: test trong `test/` (dùng `node test/validate.mjs --build --only <substr>` hoặc `node test/<tên>.test.mjs`), lệnh `grep`/`ls` trên file đích, hoặc chạy `check-request.mjs`. Ghi bảng `AC → lệnh → kết quả` vào báo cáo task.
- [ ] **Step 2:** Tick `[x]` đúng những AC có bằng chứng đạt. AC không có cách kiểm nào chạy được, hoặc kết quả sai, giữ `[ ]` và thêm ` [chưa kiểm]` cuối dòng. Riêng AC4.1/AC5.2 ("`npm test` xanh, bump version, lock") chỉ tick sau khi `npm test` xanh và `node cli/lib/versions.mjs --check` (hoặc test lock trong `npm test`) xác nhận lock khớp.
- [ ] **Step 3:** Không đổi các `[ ]` ở ví dụ/template trong `docs-standard/design.md` (dòng 83, 113, 165): Run `git diff -U0 docs/requests/2026-10-20-superpowers-docs-standard/design.md`. Expected: hunk chỉ nằm trong khoảng dòng 36–50.
- [ ] **Step 4:** Run `check-request.mjs` trên hai thư mục. Expected: số cảnh báo không tăng.
- [ ] **Step 5:** Commit `docs(requests): tick verified AC of artifact-templates and docs-standard`.

### Task 4: Tick plan của `long-session-context`

**Phủ AC:** AC5.2
**Files:**
- Modify: `docs/requests/2026-10-21-long-session-context/plan.md`

**Interfaces:**
- Consumes: commit đã có: `4a66eff`, `6a0ebfa`, `640daf0` (docs), `a21d78a` (handoff template), `da8b45f` + `71107b3` (SessionStart hook), `0ba9b97` (`aip stats`), `1f68c79` + `faf0ee4` (baseline), `90cfcd3` (README/release), `66d2b29`.

- [ ] **Step 1:** Với từng task trong plan, đọc `git show --stat <commit>` để xác nhận commit chứa đúng file mà task nêu; lập bảng `task → commit`.
- [ ] **Step 2:** Tick toàn bộ step của task có commit tương ứng; step "Run … xác nhận đỏ" tick theo cùng task vì không thể tái hiện trạng thái đỏ nay; task nào không tìm được commit thì để `[ ]` và ghi `[chưa kiểm]`.
- [ ] **Step 3:** Run `grep -c "\[ \]" docs/requests/2026-10-21-long-session-context/plan.md`. Expected: chỉ còn dòng ghi `[chưa kiểm]` và dòng header (dòng 3).
- [ ] **Step 4:** Commit `docs(requests): tick long-session-context plan from git history`.

### Task 5: Kiểm cuối

**Phủ AC:** AC4.1
**Files:**
- Test: toàn repo (`npm test`)

- [ ] **Step 1:** Run `git diff --stat master...HEAD`. Expected: mọi file bắt đầu bằng `docs/requests/`.
- [ ] **Step 2:** Run `npm test`. Expected: exit 0, validate `0 fail`, install `0 fail`, wizard `0 fail`.
- [ ] **Step 3:** Run `check-request.mjs` trên cả 7 thư mục. Expected: không còn W4; W7 chỉ còn ở AC kiểu "npm test xanh".
- [ ] **Step 4:** Tick AC1.1–AC5.2 trong spec tổng nếu các lệnh trên chứng minh; AC4.1 kèm kết quả bước 2. Commit `docs(requests): mark trends master spec AC done`.
- [ ] **Step 5:** Dừng, báo người dùng nhánh `feature/docs-trends-master-spec` và danh sách AC `[chưa kiểm]` (nếu có) để duyệt diff; không merge, không push.
