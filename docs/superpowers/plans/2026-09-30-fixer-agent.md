# Fixer Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm skill `backend-fix`/`frontend-fix` + agent `backend-fixer`/`frontend-fixer`, publish chúng, rồi chuyển bước sửa code của `workflow-bugfix` (Bước 6), `workflow-security-review` (Bước 8), `workflow-performance` (Bước 4) từ "session chính" sang agent có gate kiểm diff.

**Architecture:** Nội dung canonical nằm ở `plugins/<id>/skills/<skill>/SKILL.md` và `plugins/<id>/agents/<agent>.md`, được `cli/lib/plugins.mjs` nạp và adapter chiếu ra `build/<provider>/`. Hợp đồng nội dung được `test/validate.mjs` kiểm bằng assert chuỗi/regex trên source; wizard chỉ offer workflow khi closure (skill của agent trong frontmatter `agents:`) đã publish trong `plugins/_published.json` (`cli/lib/install.mjs:355`). Vì vậy thứ tự bắt buộc: skill → agent → **publish** → nối workflow.

**Tech Stack:** Node.js 20+, ESM thuần, zero dependency. Test chạy bằng `node test/validate.mjs` và `npm test`. Không có build step cho code; `npm run build` chỉ chiếu nội dung.

**Spec:** [`docs/superpowers/specs/2026-09-30-fixer-agent-design.md`](../specs/2026-09-30-fixer-agent-design.md)

## Global Constraints

- Node.js `>=20`; zero runtime dependency (`package.json` `dependencies: {}`).
- File nguồn UTF-8 **không BOM**, LF. Nội dung skill/agent/workflow viết **tiếng Việt có dấu**; code identifier, frontmatter key tiếng Anh.
- Tên skill phải bắt đầu `<plugin>-` (`test/validate.mjs:216`); tên agent = tên file, prefix `<plugin>-`, không chứa `:` (`test/validate.mjs:276-286`).
- Agent body phải có đủ 4 heading `## Vai trò`, `## Phạm vi`, `## Quy trình`, `## Report trả về`.
- `order` skill unique trong plugin; recipe (`pipeline: false`) có `order` > số stage pipeline. Backend/frontend đều đã dùng 1–8 → skill mới dùng **9**.
- Mỗi bước workflow tham chiếu `agent <id>` phải có `<id>` trong frontmatter `agents:` (`test/validate.mjs:314-315`).
- **Không đánh số lại bước** của 3 workflow: bugfix 9 bước, security-review 10 bước, performance 7 bước.
- Mỗi task = 1 commit; header tiếng Anh `type(scope): summary`, body tiếng Việt; **không** thêm `Co-Authored-By`. Commit qua skill `core:git-workflow` (ghi message ra file UTF-8, `git commit -F`), người dùng duyệt diff trước.
- Không push lên `master`; làm trên nhánh `feature/fixer-agent` (cắt từ `master`).
- Comment trong code (nếu thêm vào test) chỉ giải thích *why*, tiếng Việt có dấu, 1–2 dòng.

## Review Focus

Năm tình huống spec ngầm định nhưng không task nào test bằng lệnh; mỗi dòng đã được ghim vào task sở hữu bằng một assert:

1. **Publish trước, nối sau.** Nếu ai đó nối workflow trước khi publish (hoặc sau này rút `*-fix` về draft), 3 workflow biến mất khỏi wizard mà không có lỗi nào — Task 5 thêm assert `offeredCatalog` chứa `workflows/workflow-bugfix|security-review|performance`.
2. **Chế độ `performance` không có oracle đỏ.** Skill dễ bị đọc thành "chạy test cho xanh là xong"; Task 1 assert body skill có câu skill **không tự tuyên bố nhanh hơn** và trỏ số đo về Bước 5.
3. **Agent tự mở rộng phạm vi thay vì `blocked`.** Task 2 assert body agent có `blocked` và "không tự mở".
4. **Gate diff nhưng không có mốc đầu bước.** Gate "⊆ danh sách" vô nghĩa nếu không ghi trạng thái đầu bước; Task 6–8 assert Gate bước sửa chứa `git status --porcelain` và `git diff --name-only`.
5. **Bước ⏸ trước không xuất danh sách file.** Fixer sẽ không có đầu vào F2; Task 6–8 assert Đầu ra của bước ⏸ trước có "danh sách file".

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-fix/SKILL.md` | Recipe sửa code backend theo oracle đỏ (F1–F5, 3 chế độ) | 1 |
| `plugins/frontend/skills/frontend-fix/SKILL.md` | Recipe sửa code frontend React/TS (F1–F5, 3 chế độ) | 1 |
| `plugins/backend/agents/backend-fixer.md` | Agent bọc `backend-fix` | 2 |
| `plugins/frontend/agents/frontend-fixer.md` | Agent bọc `frontend-fix` | 2 |
| `test/validate.mjs` (khối `// 18.` mới, cuối file trước phần in kết quả) | Assert hợp đồng skill/agent/publish/workflow của đợt này | 1, 2, 4, 5, 6, 7, 8 |
| `plugins/_published.json`, `plugins/_cowork.json`, `plugins/{backend,frontend}/.manifest.json` | Publish 2 skill | 4 |
| `test/install.test.mjs:183,194,205` | Số skill offer 8→9, 6→7 | 4 |
| `workflows/bugfix/WORKFLOW.md` | Bước 5 Đầu ra + Bước 6 sang fixer + frontmatter + tiền điều kiện + bảng lỗi | 6 |
| `workflows/security-review/WORKFLOW.md` | Bước 5 Đầu ra + Bước 8 sang fixer + … | 7 |
| `workflows/performance/WORKFLOW.md` | Bước 3 Đầu ra + Bước 4 sang fixer + … | 8 |
| `test/validate.mjs:959` | Assert agents của security-review | 7 |
| `README.md`, `README_VI.md` | Bảng agent + bảng workflow | 9 |
| `plugins/{backend,frontend}/skills/*-refactor/SKILL.md` | Pointer "sửa bug → `*-fix`" (thay `*-implement`) | 9 |
| `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` | §8.1 catalog 15, §9/§13 đánh dấu A4 xong | 9 |

Cách chạy test một khối: `node test/validate.mjs` in `KẾT QUẢ: N pass, M fail` và liệt kê từng dòng `✗` khi fail. Không có filter theo khối; đọc dòng `✗` để biết assert nào đỏ.

---

### Task 0: Tạo nhánh

**Files:** không.

- [ ] **Step 1: Cắt nhánh từ master**

```bash
git checkout master && git pull --ff-only && git checkout -b feature/fixer-agent
```

- [ ] **Step 2: Xác nhận baseline xanh**

Run: `npm test`
Expected: dòng cuối `KẾT QUẢ: 1560 pass, 0 fail` cho validate và các test file khác không có `✗`. Ghi lại số pass (1560) làm mốc.

---

### Task 1: Skill `backend-fix` + `frontend-fix`

**Files:**
- Create: `plugins/backend/skills/backend-fix/SKILL.md`
- Create: `plugins/frontend/skills/frontend-fix/SKILL.md`
- Modify: `test/validate.mjs` (thêm khối `// 18.` ngay trước dòng `// ───…` cuối cùng đứng trước `console.log('')`)

**Interfaces:**
- Produces: skill id `backend/backend-fix`, `frontend/frontend-fix` (dùng ở Task 2 `skills:`, Task 4 publish, Task 5 closure).
- Produces: tên cổng `F1`–`F5` và tên chế độ `bug` / `security` / `performance` (Task 6–8 trích dẫn).

- [ ] **Step 1: Viết assert đỏ cho 2 skill**

Thêm vào cuối `test/validate.mjs`, ngay trước khối `// ─────…` + `console.log('')`:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 18. SOURCE: *-fix skill + *-fixer agent + nối workflow (spec 2026-09-30-fixer-agent-design)
{
  const fixSkill = (p) => {
    const f = path.join(PLUGINS_DIR, p, 'skills', `${p}-fix`, 'SKILL.md');
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  };
  const flat18 = (t) => t.replace(/\s+/g, ' ');
  for (const p of ['backend', 'frontend']) {
    const s = fixSkill(p);
    ok(s.length > 0, `${p}-fix: có SKILL.md`);
    ok(/^order: 9$/m.test(s) && /^pipeline: false$/m.test(s) && /^runsIn: execute$/m.test(s),
      `${p}-fix: frontmatter order 9, pipeline false, runsIn execute`);
    // §3.2: ranh giới với implement/refactor phải nằm trong description để trigger đúng skill.
    ok(/^description: .*oracle/m.test(s) && /^description: .*-implement/m.test(s) && /^description: .*-refactor/m.test(s),
      `${p}-fix: description nêu oracle và ranh giới với ${p}-implement / ${p}-refactor`);
    for (const g of ['F1', 'F2', 'F3', 'F4', 'F5']) ok(s.includes(`| ${g} `), `${p}-fix: bảng gate có ${g}`);
    for (const m of ['`bug`', '`security`', '`performance`']) ok(s.includes(m), `${p}-fix: có chế độ ${m}`);
    ok(flat18(s).includes('không tự tuyên bố nhanh hơn') && flat18(s).includes('Bước 5'),
      `${p}-fix: chế độ performance không tự tuyên bố nhanh hơn, số đo thuộc Bước 5 của workflow`);
    ok(s.includes('blocked') && flat18(s).includes('không tự mở'),
      `${p}-fix: cần sửa ngoài danh sách → blocked, không tự mở phạm vi`);
    ok(/không sửa/i.test(s) && s.includes('snapshot'),
      `${p}-fix: F3 cấm sửa file test/fixture/snapshot`);
    ok(s.includes('che triệu chứng'), `${p}-fix: F4 có danh sách che triệu chứng`);
  }
  ok(fixSkill('backend').includes('@Disabled') && fixSkill('backend').includes('pytest.skip'),
    'backend-fix: danh sách che triệu chứng theo stack Java/Python');
  ok(fixSkill('frontend').includes('@ts-ignore') && fixSkill('frontend').includes('eslint-disable') && fixSkill('frontend').includes('tsc --noEmit'),
    'frontend-fix: danh sách che triệu chứng theo stack TS/React và lệnh tsc --noEmit');
}
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng chỗ**

Run: `node test/validate.mjs`
Expected: `fail` > 0; các dòng `✗` bắt đầu bằng `backend-fix:` / `frontend-fix:` (ít nhất `backend-fix: có SKILL.md`, `frontend-fix: có SKILL.md`). Không có `✗` nào khác.

- [ ] **Step 3: Viết `plugins/backend/skills/backend-fix/SKILL.md`**

```markdown
---
name: backend-fix
description: "Recipe on-demand: SỬA code BACKEND có sẵn (Java/Spring, Python) theo MỘT oracle đỏ — failing test tái hiện bug, regression test của finding bảo mật, hoặc giả thuyết bottleneck đã xác nhận — với phạm vi file được khoanh TRƯỚC. Áp fix tối thiểu cho oracle chuyển xanh; KHÔNG đụng file test/fixture/snapshot; KHÔNG sửa ngoài danh sách file (cần mở rộng → dừng, trả blocked); KHÔNG che triệu chứng (nuốt exception, skip test, nới timeout, hạ log). Ba chế độ: bug / security / performance. KHÁC với sinh code mới (đó là backend-implement) và KHÁC với dọn code giữ hành vi (đó là backend-refactor); chưa có oracle → chạy workflow-bugfix từ đầu để tái hiện. Dùng skill NÀY khi người dùng muốn \"sửa bug theo failing test\", \"fix finding bảo mật\", \"sửa theo root cause\", \"áp fix tối thiểu\", \"tối ưu theo bottleneck đã xác nhận\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn."
order: 9
stageNumber: "09"
title: "Backend Fix — Sửa code backend theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Backend Fix — Sửa code backend theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)

Recipe hướng dẫn agent **sửa mã nguồn BACKEND có sẵn** (Java/Spring, Python) để **một oracle đỏ chuyển
xanh**, trong **phạm vi file đã được khoanh trước**. Đây là **docs-only recipe** — hướng dẫn cách agent làm
việc, KHÔNG phải công cụ tự sửa. Gọi độc lập hoặc từ bước sửa của `workflow-bugfix`,
`workflow-security-review`, `workflow-performance`.

**Oracle** là thứ cho biết fix đúng hay chưa, và phải có TRƯỚC khi sửa: một failing test tái hiện bug, một
regression test đỏ cho finding bảo mật, hoặc (chế độ `performance`) một giả thuyết bottleneck đã có evidence
profile. Không có oracle → không sửa.

## Ranh giới với skill lân cận

| Skill | Đầu vào | Kết quả |
|---|---|---|
| `backend-implement` | use-case / contract mới | code **mới** (vertical slice) |
| `backend-refactor` | code có sẵn, test xanh | hành vi **không đổi** |
| **`backend-fix`** | code có sẵn + **oracle đỏ** + **danh sách file được sửa** | hành vi **đổi đúng một chỗ**, oracle xanh |

KHÔNG dùng skill này khi: cần viết feature mới (→ `backend-implement`); cần dọn code không đổi hành vi
(→ `backend-refactor`); chưa có oracle (→ chạy `workflow-bugfix` từ đầu để tái hiện bằng failing test).

## Ba chế độ

| Chế độ | Oracle | Gate xanh |
|---|---|---|
| `bug` | failing test tái hiện bug (bugfix Bước 3) | test đó xanh |
| `security` | regression test đỏ (security-review Bước 7) + finding đã chọn | test đó xanh; không che triệu chứng |
| `performance` | giả thuyết bottleneck đã xác nhận + file/hàm (performance Bước 3); **không có test đỏ** | build/test hiện có xanh. Skill **không tự tuyên bố nhanh hơn** — số đo trước/sau là việc của Bước 5 (Benchmark) của workflow |

## Ranh giới an toàn (CLAUDE.md)
- **Có oracle mới sửa.** Chạy oracle xác nhận đang ĐỎ đúng lý do trước khi động code. Đỏ vì lý do khác
  (thiếu dependency, môi trường) hoặc không đỏ → DỪNG, báo, không sửa.
- **Phạm vi khoanh trước.** Bước gọi (hoặc người dùng) đưa **danh sách file/module được sửa**. Chỉ sửa trong
  đó. Cần sửa ngoài danh sách → DỪNG, trả `blocked` kèm file đề nghị thêm; **không tự mở** phạm vi.
- **Không đụng test.** KHÔNG sửa/xoá/nới file test, fixture, snapshot, mock. Test sai thật → báo, để
  `backend-testing` (test-writer) xử lý ở lượt riêng.
- **Sửa nguyên nhân, không che triệu chứng.** Cấm: `try/catch` nuốt exception hoặc `except: pass`;
  `@Disabled`/`@Ignore`/`pytest.skip`/`xfail` mới; nới timeout/retry để qua; hạ mức log hoặc bỏ log thay vì sửa
  lỗ hổng; `@SuppressWarnings` mới; đổi assert trong test.
- **Không đổi thứ ngoài code.** Không sửa `docs/contracts/`, không thêm/sửa migration, không thêm dependency —
  cần thì DỪNG và báo (đó là việc của skill khác: `backend-api-contract`, `data-db-migration`).
- **Không push thẳng main.** Một fix = 1 commit; DỪNG cho người **duyệt diff** trước commit.
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng oracle đỏ → xanh với lệnh THẬT + exit code, `file:line` đã sửa. KHÔNG dùng
  "đảm bảo / loại bỏ / không còn lỗi". LUÔN nêu **residual risk** (chỗ cùng pattern chưa sửa vì ngoài phạm vi).

## Quy trình — cổng F1–F5

### 0. Nạp context
- Nhận **oracle** (lệnh chạy + kỳ vọng đỏ → xanh) và **danh sách file được sửa** từ bước gọi. Thiếu một trong
  hai → DỪNG, hỏi.
- Đọc `project-knowledge/architecture.md`, `code-convention.md`; dò lệnh build/test/lint THẬT từ
  `pom.xml`/`build.gradle`/`pyproject.toml`. Đọc code THẬT trong danh sách file, không đoán.

### 1. Xác nhận oracle đỏ — CỔNG F1
- Chạy oracle. Chế độ `bug`/`security`: phải ĐỎ đúng lý do (message/assert khớp bug hoặc finding). Chế độ
  `performance`: giả thuyết phải có evidence profile (`file:line` hoặc số đo) từ bước trước.
- Ghi trạng thái đầu bước: `git status --porcelain` (để bước gọi so diff sau).

### 2. Sửa tối thiểu trong danh sách — CỔNG F2, F3, F4
- Sửa đúng nguyên nhân gốc, ít thay đổi nhất làm oracle xanh. Không "nhân tiện" dọn code (đó là
  `backend-refactor`, lượt khác).
- Cần chạm file ngoài danh sách → DỪNG, trả `blocked` + danh sách file đề nghị thêm.
- Tự soát: có dòng nào thuộc danh sách "che triệu chứng" ở Ranh giới an toàn không → gỡ.

### 3. Xanh trước khi trả — CỔNG F5
- Chạy oracle → phải XANH. Chạy build + lint + test của module đụng → XANH.
- `git diff --name-only` + `git ls-files --others --exclude-standard` ⊆ danh sách file; không có file test.
- Chưa xanh → sửa tiếp trong danh sách; hết cách → `blocked`, nêu vì sao.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| F1 | Có oracle; oracle đang ĐỎ đúng lý do (bug/security) hoặc giả thuyết có evidence (performance) | 1 | DỪNG, không sửa |
| F2 | Chỉ sửa file trong danh sách được giao | 2 | `blocked` + file đề nghị thêm; không tự mở |
| F3 | Không sửa/xoá/nới file test, fixture, snapshot, mock | 2 | Gỡ thay đổi đó; test sai thật → báo test-writer |
| F4 | Không che triệu chứng (danh sách ở Ranh giới an toàn) | 2 | Gỡ, sửa lại nguyên nhân |
| F5 | Oracle xanh + build/lint xanh; diff ⊆ danh sách, không chứa file test | 3 | Sửa tiếp trong danh sách; hết cách → `blocked` |

## Sau khi xong
Báo: oracle trước/sau (`command`, `exit_code`); file đã sửa (`file:line`) và xác nhận ⊆ danh sách; kết quả
build/lint THẬT; **residual risk** (giả định về nguyên nhân, chỗ cùng pattern chưa sửa vì ngoài phạm vi, phần
chỉ kiểm bằng đọc). Cần dọn code sau fix → route `backend-refactor`; cần thêm test → route `backend-testing`.
```

- [ ] **Step 4: Viết `plugins/frontend/skills/frontend-fix/SKILL.md`**

Cùng cấu trúc; thay đổi các chỗ sau (viết file đầy đủ, không tham chiếu file backend):

```markdown
---
name: frontend-fix
description: "Recipe on-demand: SỬA code FRONTEND có sẵn (React/TypeScript) theo MỘT oracle đỏ — failing test tái hiện bug, regression test của finding bảo mật, hoặc giả thuyết bottleneck đã xác nhận — với phạm vi file được khoanh TRƯỚC. Áp fix tối thiểu cho oracle chuyển xanh; KHÔNG đụng file test/fixture/snapshot; KHÔNG sửa ngoài danh sách file (cần mở rộng → dừng, trả blocked); KHÔNG che triệu chứng (any, non-null !, ts-ignore, eslint-disable, skip test, nới waitFor). Ba chế độ: bug / security / performance. KHÁC với dựng UI mới (đó là frontend-implement) và KHÁC với dọn component giữ hành vi (đó là frontend-refactor); chưa có oracle → chạy workflow-bugfix từ đầu để tái hiện. Dùng skill NÀY khi người dùng muốn \"sửa bug React theo failing test\", \"fix finding bảo mật frontend\", \"sửa theo root cause\", \"áp fix tối thiểu\", \"tối ưu theo bottleneck đã xác nhận\" — kể cả khi không nói chính xác chữ \"skill\". KHÔNG thuộc pipeline bắt buộc; gọi khi cần trên project đã có mã nguồn React."
order: 9
stageNumber: "09"
title: "Frontend Fix — Sửa code React theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)"
runsIn: execute
invoke: per-request
pipeline: false
next: null
---

# Frontend Fix — Sửa code React theo oracle đỏ, phạm vi khoanh trước (recipe on-demand)

Recipe hướng dẫn agent **sửa mã nguồn FRONTEND có sẵn** (React/TypeScript) để **một oracle đỏ chuyển xanh**,
trong **phạm vi file đã được khoanh trước**. Đây là **docs-only recipe** — hướng dẫn cách agent làm việc,
KHÔNG phải công cụ tự sửa. Gọi độc lập hoặc từ bước sửa của `workflow-bugfix`, `workflow-security-review`,
`workflow-performance`.

**Oracle** là thứ cho biết fix đúng hay chưa, và phải có TRƯỚC khi sửa: một failing test (Testing Library /
Vitest / Jest) tái hiện bug, một regression test đỏ cho finding bảo mật, hoặc (chế độ `performance`) một giả
thuyết bottleneck đã có evidence profile (React Profiler, bundle analyzer, số đo render). Không có oracle →
không sửa.

## Ranh giới với skill lân cận

| Skill | Đầu vào | Kết quả |
|---|---|---|
| `frontend-implement` | thiết kế (HTML/Figma/ảnh) | component **mới** presentational |
| `frontend-refactor` | component có sẵn, test xanh | hành vi **không đổi** |
| **`frontend-fix`** | code có sẵn + **oracle đỏ** + **danh sách file được sửa** | hành vi **đổi đúng một chỗ**, oracle xanh |

KHÔNG dùng skill này khi: cần dựng UI mới (→ `frontend-implement`); cần dọn component không đổi hành vi
(→ `frontend-refactor`); chưa có oracle (→ chạy `workflow-bugfix` từ đầu để tái hiện bằng failing test).

## Ba chế độ

| Chế độ | Oracle | Gate xanh |
|---|---|---|
| `bug` | failing test tái hiện bug (bugfix Bước 3) | test đó xanh |
| `security` | regression test đỏ (security-review Bước 7) + finding đã chọn | test đó xanh; không che triệu chứng |
| `performance` | giả thuyết bottleneck đã xác nhận + file/component (performance Bước 3); **không có test đỏ** | `tsc`/lint/test hiện có xanh. Skill **không tự tuyên bố nhanh hơn** — số đo trước/sau là việc của Bước 5 (Benchmark) của workflow |

## Ranh giới an toàn (CLAUDE.md)
- **Có oracle mới sửa.** Chạy oracle xác nhận đang ĐỎ đúng lý do trước khi động code. Đỏ vì lý do khác
  (thiếu dependency, môi trường, msw chưa bật) hoặc không đỏ → DỪNG, báo, không sửa.
- **Phạm vi khoanh trước.** Bước gọi (hoặc người dùng) đưa **danh sách file/component được sửa**. Chỉ sửa trong
  đó. Cần sửa ngoài danh sách → DỪNG, trả `blocked` kèm file đề nghị thêm; **không tự mở** phạm vi.
- **Không đụng test.** KHÔNG sửa/xoá/nới file test, fixture, snapshot, mock/msw handler. Test sai thật → báo,
  để `frontend-testing` (test-writer) xử lý ở lượt riêng.
- **Sửa nguyên nhân, không che triệu chứng.** Cấm: `any`, `!` non-null assertion, `// @ts-ignore` /
  `// @ts-expect-error`, `// eslint-disable` mới; `test.skip`/`it.skip`/`xit`; nới `waitFor` timeout; cập nhật
  snapshot cho khớp output sai (`-u`); `catch` nuốt lỗi; `key={index}` để tắt warning.
- **Không đổi thứ ngoài code.** Không sửa `docs/contracts/`, không đổi design-system token, không thêm
  dependency — cần thì DỪNG và báo.
- **Tôn trọng boundary.** Sửa trong slice/feature của file được giao; không cross-import ruột feature khác.
- **Không push thẳng main.** Một fix = 1 commit; DỪNG cho người **duyệt diff** trước commit.
- **Ngôn ngữ (bắt buộc):** báo cáo, commit message viết **tiếng Việt CÓ DẤU** (UTF-8).
- **Ngôn ngữ đo được:** báo bằng oracle đỏ → xanh với lệnh THẬT + exit code, `file:line` đã sửa. KHÔNG dùng
  "đảm bảo / loại bỏ / không còn lỗi". LUÔN nêu **residual risk**.

## Quy trình — cổng F1–F5

### 0. Nạp context
- Nhận **oracle** (lệnh chạy + kỳ vọng đỏ → xanh) và **danh sách file được sửa** từ bước gọi. Thiếu một trong
  hai → DỪNG, hỏi.
- Đọc `project-knowledge/architecture.md`, `code-convention.md`; dò lệnh THẬT từ `package.json` (`tsc --noEmit`,
  eslint, test runner, build). Đọc code THẬT trong danh sách file, không đoán.

### 1. Xác nhận oracle đỏ — CỔNG F1
- Chạy oracle. Chế độ `bug`/`security`: phải ĐỎ đúng lý do. Chế độ `performance`: giả thuyết phải có evidence
  profile từ bước trước.
- Ghi trạng thái đầu bước: `git status --porcelain`.

### 2. Sửa tối thiểu trong danh sách — CỔNG F2, F3, F4
- Sửa đúng nguyên nhân gốc (state/effect sai, điều kiện render, handler, race), ít thay đổi nhất làm oracle xanh.
  Không "nhân tiện" tách component hay đổi style (đó là `frontend-refactor`, lượt khác).
- Cần chạm file ngoài danh sách → DỪNG, trả `blocked` + danh sách file đề nghị thêm.
- Tự soát danh sách "che triệu chứng" → gỡ.

### 3. Xanh trước khi trả — CỔNG F5
- Chạy oracle → XANH. Chạy `tsc --noEmit` + lint + test của feature đụng + build → XANH.
- `git diff --name-only` + `git ls-files --others --exclude-standard` ⊆ danh sách file; không có file test.
- Chưa xanh → sửa tiếp trong danh sách; hết cách → `blocked`, nêu vì sao.

## Bảng gate
| # | Gate | Bước | Đỏ thì |
|---|------|------|--------|
| F1 | Có oracle; oracle đang ĐỎ đúng lý do (bug/security) hoặc giả thuyết có evidence (performance) | 1 | DỪNG, không sửa |
| F2 | Chỉ sửa file trong danh sách được giao | 2 | `blocked` + file đề nghị thêm; không tự mở |
| F3 | Không sửa/xoá/nới file test, fixture, snapshot, mock | 2 | Gỡ thay đổi đó; test sai thật → báo test-writer |
| F4 | Không che triệu chứng (danh sách ở Ranh giới an toàn) | 2 | Gỡ, sửa lại nguyên nhân |
| F5 | Oracle xanh + `tsc`/lint/build xanh; diff ⊆ danh sách, không chứa file test | 3 | Sửa tiếp trong danh sách; hết cách → `blocked` |

## Sau khi xong
Báo: oracle trước/sau (`command`, `exit_code`); file đã sửa (`file:line`) và xác nhận ⊆ danh sách; kết quả
`tsc`/lint/build THẬT; **residual risk** (giả định về nguyên nhân, chỗ cùng pattern chưa sửa vì ngoài phạm vi,
trạng thái UI chưa có test). Cần dọn component sau fix → route `frontend-refactor`; cần thêm test → route
`frontend-testing`.
```

- [ ] **Step 5: Chạy validate, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`; số pass tăng so mốc Task 0 (thêm ~26 assert của khối 18 + assert contract skill chung cho 2 skill mới).

- [ ] **Step 6: Build và kiểm skill xuất hiện ở 4 provider**

Run: `npm run build && ls build/claude/backend/skills | grep fix && ls build/codex/frontend | grep -i fix`
Expected: thấy `backend-fix` và `frontend-fix` (đường dẫn chính xác tuỳ adapter; điều cần thấy là tên skill xuất hiện ở output claude và codex).

- [ ] **Step 7: Commit**

Viết message vào file UTF-8 rồi `git commit -F` (qua `core:git-workflow`, người dùng duyệt diff trước):

```text
feat(skills): add backend-fix and frontend-fix recipes

Changed:
- Thêm skill backend-fix và frontend-fix (order 9): sửa code có sẵn theo một oracle đỏ với phạm vi file khoanh trước.
- Ba chế độ bug / security / performance; cổng F1–F5 (oracle đỏ, chỉ sửa trong danh sách, không đụng test, không che triệu chứng, xanh trước khi trả).
- Ranh giới rõ với *-implement (code mới) và *-refactor (giữ hành vi); danh sách che triệu chứng theo stack.
- Thêm khối validate 18 kiểm frontmatter, cổng, chế độ và ranh giới của 2 skill.

Reason:
- Bước sửa code của workflow bugfix/security-review/performance cần một skill có hợp đồng "sửa theo oracle" — hai skill implement hiện có được thiết kế cho sinh code mới (spec 2026-09-30-fixer-agent-design §3).
```

---

### Task 2: Agent `backend-fixer` + `frontend-fixer`

**Files:**
- Create: `plugins/backend/agents/backend-fixer.md`
- Create: `plugins/frontend/agents/frontend-fixer.md`
- Modify: `test/validate.mjs` (thêm vào trong khối `// 18.`)

**Interfaces:**
- Consumes: skill id `backend-fix`, `frontend-fix` (Task 1).
- Produces: agent id `backend-fixer`, `frontend-fixer` (Task 6–8 tham chiếu trong `agents:` và trong bước).

- [ ] **Step 1: Thêm assert đỏ cho 2 agent vào khối 18**

Thêm ngay sau vòng `for (const p of ['backend','frontend'])` của Task 1 (vẫn trong `{ … }` của khối 18):

```js
  const fixAgent = (p) => {
    const f = path.join(PLUGINS_DIR, p, 'agents', `${p}-fixer.md`);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  };
  for (const p of ['backend', 'frontend']) {
    const a = fixAgent(p);
    ok(a.length > 0, `${p}-fixer: có agent file`);
    ok(/^mode: write$/m.test(a) && new RegExp(`^skills: "${p}-fix"$`, 'm').test(a),
      `${p}-fixer: mode write, skills = ${p}-fix (đúng 1 skill)`);
    ok(/^description: .*oracle/m.test(a), `${p}-fixer: description nêu oracle`);
    ok(flat18(a).includes('file test') && flat18(a).includes('ngoài danh sách'),
      `${p}-fixer: phạm vi cấm sửa file test và cấm sửa ngoài danh sách`);
    ok(a.includes('blocked') && flat18(a).includes('không tự mở'),
      `${p}-fixer: cần mở rộng phạm vi → blocked, không tự mở`);
    ok(a.includes('core:principles') && a.includes('not_run'),
      `${p}-fixer: report theo contract core:principles, có not_run`);
    ok(a.includes('git diff --name-only'), `${p}-fixer: tự đối chiếu diff với danh sách trước khi trả`);
  }
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: các dòng `✗ backend-fixer: có agent file`, `✗ frontend-fixer: có agent file` và các assert fixer khác; không có `✗` ngoài nhóm fixer.

- [ ] **Step 3: Viết `plugins/backend/agents/backend-fixer.md`**

```markdown
---
name: backend-fixer
description: "Agent chỉ SỬA code backend có sẵn theo skill backend-fix: nhận một oracle đỏ (failing test, regression test, hoặc giả thuyết bottleneck đã xác nhận) và danh sách file được sửa, áp fix tối thiểu cho oracle xanh, không đụng test, không sửa ngoài danh sách. Cần sửa ngoài phạm vi → dừng và trả blocked. Dùng khi workflow bugfix/security-review/performance cần bước sửa code có khoá phạm vi."
mode: write
skills: "backend-fix"
---

## Vai trò

Sửa đúng một chỗ trong code backend có sẵn để oracle đỏ chuyển xanh, trong phạm vi file đã được người dùng
xác nhận ở bước trước của workflow.

## Phạm vi

- Được: đọc skill `backend-fix`, `project-knowledge/architecture.md`, `code-convention.md`, code trong danh
  sách file được giao; chạy oracle + build/lint/test để lấy evidence.
- Không được: sửa file test/fixture/snapshot/mock; sửa file ngoài danh sách; đổi `docs/contracts/`; thêm hay
  đổi migration; thêm dependency; commit/push; gọi agent khác.
- Bắt buộc: cần mở rộng phạm vi → trả `status: blocked` + danh sách file đề nghị thêm; **không tự mở**. Che
  triệu chứng (nuốt exception, skip test, nới timeout, hạ log) bị cấm theo F4 của skill.

## Quy trình

1. Đọc skill `backend-fix`; nhận oracle (lệnh + kỳ vọng đỏ → xanh) và danh sách file từ bước gọi. Thiếu một
   trong hai → dừng, báo thiếu gì.
2. Chạy oracle, xác nhận đang đỏ đúng lý do (F1); đỏ vì lý do khác hoặc không đỏ → báo, dừng. Ghi
   `git status --porcelain` làm mốc đầu bước.
3. Sửa tối thiểu trong danh sách (F2), không đụng test (F3), không che triệu chứng (F4).
4. Chạy oracle + build/lint/test module đụng (F5); chưa xanh → sửa tiếp trong danh sách; hết cách → `blocked`.
5. Tự đối chiếu `git diff --name-only` với danh sách file và với danh sách che triệu chứng của skill trước khi
   trả.

## Report trả về

- Oracle trước/sau: `command`, `exit_code`, `status` (đỏ → xanh).
- File đã sửa (`file:line`) và xác nhận ⊆ danh sách giao; evidence build/lint theo contract `core:principles`;
  không chạy được → `not_run` + `reason`.
- `remaining_risks`: giả định về nguyên nhân; chỗ cùng pattern chưa sửa vì ngoài phạm vi; phần chỉ kiểm bằng
  đọc, chưa có test.
```

- [ ] **Step 4: Viết `plugins/frontend/agents/frontend-fixer.md`**

```markdown
---
name: frontend-fixer
description: "Agent chỉ SỬA code frontend React/TypeScript có sẵn theo skill frontend-fix: nhận một oracle đỏ (failing test, regression test, hoặc giả thuyết bottleneck đã xác nhận) và danh sách file được sửa, áp fix tối thiểu cho oracle xanh, không đụng test, không sửa ngoài danh sách. Cần sửa ngoài phạm vi → dừng và trả blocked. Dùng khi workflow bugfix/security-review/performance cần bước sửa code có khoá phạm vi."
mode: write
skills: "frontend-fix"
---

## Vai trò

Sửa đúng một chỗ trong code React/TypeScript có sẵn để oracle đỏ chuyển xanh, trong phạm vi file đã được
người dùng xác nhận ở bước trước của workflow.

## Phạm vi

- Được: đọc skill `frontend-fix`, `project-knowledge/architecture.md`, `code-convention.md`, code trong danh
  sách file được giao; chạy oracle + `tsc --noEmit`/lint/test/build để lấy evidence.
- Không được: sửa file test/fixture/snapshot/mock/msw handler; sửa file ngoài danh sách; đổi `docs/contracts/`;
  đổi design-system token; thêm dependency; commit/push; gọi agent khác.
- Bắt buộc: cần mở rộng phạm vi → trả `status: blocked` + danh sách file đề nghị thêm; **không tự mở**. Che
  triệu chứng (`any`, `!`, `ts-ignore`, `eslint-disable`, skip test, nới `waitFor`) bị cấm theo F4 của skill.

## Quy trình

1. Đọc skill `frontend-fix`; nhận oracle (lệnh + kỳ vọng đỏ → xanh) và danh sách file từ bước gọi. Thiếu một
   trong hai → dừng, báo thiếu gì.
2. Chạy oracle, xác nhận đang đỏ đúng lý do (F1); đỏ vì lý do khác hoặc không đỏ → báo, dừng. Ghi
   `git status --porcelain` làm mốc đầu bước.
3. Sửa tối thiểu trong danh sách (F2), không đụng test (F3), không che triệu chứng (F4); tôn trọng import
   boundary của slice/feature.
4. Chạy oracle + `tsc --noEmit` + lint + test feature đụng + build (F5); chưa xanh → sửa tiếp trong danh sách;
   hết cách → `blocked`.
5. Tự đối chiếu `git diff --name-only` với danh sách file và với danh sách che triệu chứng của skill trước khi
   trả.

## Report trả về

- Oracle trước/sau: `command`, `exit_code`, `status` (đỏ → xanh).
- File đã sửa (`file:line`) và xác nhận ⊆ danh sách giao; evidence `tsc`/lint/build theo contract
  `core:principles`; không chạy được → `not_run` + `reason`.
- `remaining_risks`: giả định về nguyên nhân; chỗ cùng pattern chưa sửa vì ngoài phạm vi; trạng thái UI chưa có
  test.
```

- [ ] **Step 5: Chạy validate, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`. Các assert chung cho agent (`agent backend-fixer: name == tên file`, `…: có heading "## Vai trò"`, …) tự chạy cho 2 agent mới và pass.

- [ ] **Step 6: Build, kiểm agent xuất hiện**

Run: `npm run build && grep -rl "backend-fixer" build/claude | head -3 && grep -rl "backend_fixer\|backend-fixer" build/codex | head -3`
Expected: ít nhất 1 file ở mỗi provider chứa agent (Claude `.md` agent, Codex `.toml` với `name` snake_case theo `codexAgentName`).

- [ ] **Step 7: Commit**

```text
feat(agents): add backend-fixer and frontend-fixer agents

Changed:
- Thêm agent backend-fixer (skill backend-fix) và frontend-fixer (skill frontend-fix), mode write.
- Phạm vi: chỉ sửa trong danh sách file được giao, không đụng test, cần mở rộng → trả blocked, không tự mở.
- Quy trình 5 bước bám cổng F1–F5; report oracle đỏ → xanh theo contract core:principles.
- Thêm assert cho 2 agent vào khối validate 18.

Reason:
- Workflow cần một agent có hợp đồng "sửa theo oracle" để chuyển bước sửa code khỏi session chính (spec 2026-09-30-fixer-agent-design §4).
```

---

### Task 3: (bỏ trống — gộp vào Task 4)

Không có Task 3. Đánh số giữ nguyên để khớp lộ trình FX-P1…FX-P6 của spec: Task 1 = FX-P1, Task 2 = FX-P2, Task 4 = FX-P3, Task 5–8 = FX-P4, Task 9 = FX-P5, Task 10 = FX-P6.

---

### Task 4: Publish 2 skill (FX-P3)

**Files:**
- Modify: `plugins/_published.json`
- Modify: `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`
- Modify: `plugins/_cowork.json`
- Modify: `test/install.test.mjs:183`, `:194`, `:205`
- Modify: `test/validate.mjs` (khối 18)

**Interfaces:**
- Produces: `backend/backend-fix`, `frontend/frontend-fix` nằm trong `offeredCatalog()` (Task 5 phụ thuộc).

- [ ] **Step 1: Thêm assert đỏ về publish vào khối 18**

```js
  const pub18 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_published.json'), 'utf8')).published;
  ok(pub18.includes('backend/backend-fix') && pub18.includes('frontend/frontend-fix'),
    '_published.json: có backend/backend-fix và frontend/frontend-fix (publish cùng đợt nối workflow, spec F-Q3)');
  const cowork18 = JSON.parse(fs.readFileSync(path.join(PLUGINS_DIR, '_cowork.json'), 'utf8')).skills;
  ok(cowork18.includes('backend:backend-fix') && cowork18.includes('frontend:frontend-fix'),
    '_cowork.json: có backend:backend-fix và frontend:frontend-fix');
```

(Assert manifest liệt kê đủ skill đã có sẵn ở `P0 PL2`, dòng 785-789 — sẽ tự đỏ khi có skill mới mà manifest chưa nêu.)

- [ ] **Step 2: Chạy validate + install test, xác nhận đỏ đúng chỗ**

Run: `node test/validate.mjs; node test/install.test.mjs`
Expected: validate đỏ ở `_published.json: …`, `_cowork.json: …`, và `P0 PL2: manifest backend nêu đủ skill … (thiếu: backend-fix)`, `P0 PL2: manifest frontend … (thiếu: frontend-fix)`. Install test **xanh** (chưa publish nên số offer vẫn 8/6).

- [ ] **Step 3: Sửa `plugins/_published.json`**

Thêm 2 dòng vào mảng `published` (sau `"backend/backend-api-contract"` và sau `"frontend/frontend-migrate-architecture"`):

```json
    "backend/backend-api-contract",
    "backend/backend-fix",
```
```json
    "frontend/frontend-migrate-architecture",
    "frontend/frontend-fix",
```

- [ ] **Step 4: Sửa manifest backend**

`plugins/backend/.manifest.json`: nối vào cuối `description` (trước dấu `.` cuối) `, backend-fix (sửa code có sẵn theo oracle đỏ, phạm vi khoanh trước)`; đổi `"version": "1.3.0"` → `"1.4.0"`.

- [ ] **Step 5: Sửa manifest frontend**

`plugins/frontend/.manifest.json`: sau đoạn `frontend-migrate-architecture (Feature-Based/FSD/Micro-FE);` chèn `frontend-fix (sửa code React có sẵn theo oracle đỏ, phạm vi khoanh trước);`; đổi `"version": "1.4.0"` → `"1.5.0"`.

- [ ] **Step 6: Sửa `plugins/_cowork.json`**

Thêm `"backend:backend-fix",` sau `"backend:backend-migrate-vault-consul",` và `"frontend:frontend-fix",` sau `"frontend:frontend-migrate-architecture",`.

- [ ] **Step 7: Chạy install test, xác nhận đỏ ở số đếm**

Run: `node test/install.test.mjs`
Expected: `✗ offeredCatalog: vẫn offer đủ 8 skill backend đã publish` và 2 dòng `✗ … 6 skill frontend …`.

- [ ] **Step 8: Sửa 3 assert đếm trong `test/install.test.mjs`**

Dòng 183: `beOff.skillIds.length === 8` → `=== 9`, message `'offeredCatalog: vẫn offer đủ 9 skill backend đã publish'`.
Dòng 194: `feOff.skillIds.length === 6` → `=== 7`, message `'offeredCatalog: vẫn offer đủ 7 skill frontend đã publish'`.
Dòng 205: `feOff.skillIds.length === 6` → `=== 7`, message `'offeredCatalog: vẫn offer đủ 7 skill frontend đã publish (e2e-testing chưa publish)'`.

- [ ] **Step 9: Chạy toàn bộ test**

Run: `npm test && npm run pack:verify`
Expected: validate `0 fail`; install/wizard/managed-block/pack-guard/args không có `✗`; pack-guard pass (thư mục `plugins/backend/`, `plugins/frontend/` đã trong allowlist, không đổi).

- [ ] **Step 10: Commit**

```text
feat(publish): publish backend-fix and frontend-fix skills

Changed:
- Thêm backend/backend-fix và frontend/frontend-fix vào plugins/_published.json và _cowork.json.
- Manifest backend 1.4.0, frontend 1.5.0: description liệt kê skill mới.
- Sửa assert đếm skill offer trong install.test.mjs (backend 9, frontend 7); thêm assert publish vào validate.

Reason:
- offeredCatalog ẩn workflow có closure chưa publish (cli/lib/install.mjs:355); phải publish 2 skill TRƯỚC khi nối agent fixer vào workflow, nếu không 3 workflow đang publish sẽ biến mất khỏi wizard (spec 2026-09-30 F-Q3, §7).
```

---

### Task 5: Assert "3 workflow vẫn được offer" (viết trước khi nối)

**Files:**
- Modify: `test/validate.mjs` (khối 18)

**Interfaces:**
- Consumes: `offeredCatalog` — cần import từ `../cli/lib/install.mjs` nếu validate chưa import (kiểm dòng import đầu file; hiện `validate.mjs` **không** import `install.mjs`).

- [ ] **Step 1: Thêm import (nếu chưa có) ở đầu `test/validate.mjs`**

Sau dòng 13 (`import { checkWorkflowBody, … } from '../cli/lib/workflows.mjs';`):

```js
import { offeredCatalog } from '../cli/lib/install.mjs';
```

- [ ] **Step 2: Thêm assert vào khối 18**

```js
  // Review Focus 1: nối agent fixer vào workflow chỉ hợp lệ khi closure đã publish; nếu ai đó rút *-fix về
  // draft, 3 workflow sẽ bị wizard ẩn lặng lẽ — assert này bắt đúng điểm đó.
  const offeredWf = offeredCatalog().plugins.find((p) => p.id === 'workflows')?.skillIds ?? [];
  for (const w of ['workflow-bugfix', 'workflow-security-review', 'workflow-performance']) {
    ok(offeredWf.includes(`workflows/${w}`), `offeredCatalog: vẫn offer workflows/${w} (closure fixer đã publish)`);
  }
```

- [ ] **Step 3: Chạy validate, xác nhận xanh ngay (chưa nối agent, closure hiện tại đã publish)**

Run: `node test/validate.mjs`
Expected: `0 fail`; 3 assert `offeredCatalog: vẫn offer workflows/…` pass.

- [ ] **Step 4: Kiểm assert có "răng": tạm rút publish và xem nó đỏ**

Chạy tạm (không commit): xoá dòng `"backend/backend-fix",` trong `_published.json`, chạy `node test/validate.mjs`.
Expected: assert `_published.json: có backend/backend-fix…` đỏ; 3 assert `offeredCatalog` **vẫn xanh** (vì chưa nối agent). Đây là kỳ vọng đúng ở thời điểm này; sau Task 6–8 cùng thao tác sẽ làm 3 assert đỏ. Hoàn lại dòng đã xoá (`git checkout plugins/_published.json`).

- [ ] **Step 5: Commit**

```text
test(validate): assert fixer workflows stay offered by wizard

Changed:
- Import offeredCatalog vào validate; assert workflow-bugfix, security-review, performance vẫn nằm trong offeredCatalog.

Reason:
- Sau khi nối agent fixer, closure của 3 workflow phụ thuộc backend-fix/frontend-fix đã publish; nếu skill bị rút về draft, wizard ẩn workflow mà không báo lỗi (spec 2026-09-30 §6.2).
```

---

### Task 6: Nối `workflow-bugfix` (Bước 5 Đầu ra, Bước 6 → fixer)

**Files:**
- Modify: `workflows/bugfix/WORKFLOW.md` — frontmatter dòng 9; mục Điều kiện tiên quyết; Bước 5 (dòng ~93-105); Bước 6 (dòng 107-118); bảng Xử lý lỗi & rollback
- Modify: `test/validate.mjs` (khối 18)

**Interfaces:**
- Consumes: agent id `backend-fixer`, `frontend-fixer` (Task 2).

- [ ] **Step 1: Thêm assert đỏ cho bugfix vào khối 18**

```js
  const wf18 = (id) => workflows.stages.find((s) => s.id === id);
  const step18 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) : undefined) ?? { title: '', body: '', checkpoint: false };
  const fixStepOk = (id, prevN, fixN, prevTitleRe, fixTitleRe) => {
    const w = wf18(id);
    const prev = step18(w, prevN), fix = step18(w, fixN);
    ok(prevTitleRe.test(prev.title) && flat18(prev.body).includes('danh sách file'),
      `${id} Bước ${prevN}: bước ⏸ trước xuất danh sách file được sửa (đầu vào F2)`);
    ok(fixTitleRe.test(fix.title) && fix.body.includes('agent `backend-fixer`') && fix.body.includes('agent `frontend-fixer`'),
      `${id} Bước ${fixN}: Thực hiện là agent backend-fixer ∥ frontend-fixer`);
    ok(!flat18(fix.body).includes('Thực hiện:** session chính'), `${id} Bước ${fixN}: không còn session chính`);
    ok(fix.body.includes('git status --porcelain') && fix.body.includes('git diff --name-only')
      && flat18(fix.body).includes('⊆ danh sách') && flat18(fix.body).includes('không chứa file test'),
      `${id} Bước ${fixN}: Gate so diff với mốc đầu bước, ⊆ danh sách, không chứa file test`);
    ok(flat18(fix.body).includes('blocked'), `${id} Bước ${fixN}: Khi fail xử lý agent trả blocked`);
    ok(w && w.agents.includes('backend-fixer') && w.agents.includes('frontend-fixer'),
      `${id}: frontmatter agents có backend-fixer, frontend-fixer`);
    ok(flat18(w?.body ?? '').includes('Fixer trả `blocked`'), `${id}: bảng lỗi có hàng Fixer trả blocked`);
  };
  fixStepOk('workflow-bugfix', 5, 6, /^Root cause/, /^Fix tối thiểu/);
  ok(parseSteps(wf18('workflow-bugfix')?.body ?? '').length === 9, 'workflow-bugfix: vẫn 9 bước');
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm `workflow-bugfix`**

Run: `node test/validate.mjs`
Expected: các `✗ workflow-bugfix Bước 5/6 …`, `✗ workflow-bugfix: frontmatter agents …`, `✗ workflow-bugfix: bảng lỗi …`; `workflow-bugfix: vẫn 9 bước` xanh.

- [ ] **Step 3: Sửa frontmatter `workflows/bugfix/WORKFLOW.md:9`**

```yaml
agents: "backend-test-writer,frontend-test-writer,backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer,engineering-quality-auditor"
```

- [ ] **Step 4: Sửa Điều kiện tiên quyết**

Thay dòng đầu mục:

```markdown
- Skill/agent đã cài: `backend-test-writer`, `frontend-test-writer`, `backend-fixer`, `frontend-fixer`,
  `backend-reviewer`, `frontend-reviewer`, `engineering-quality-auditor`, skill `core/git-workflow`.
```

- [ ] **Step 5: Sửa Bước 5 — Đầu ra và Evidence**

Thay dòng `- **Đầu ra:** giải thích root cause, có trích dẫn evidence.` bằng:

```markdown
- **Đầu ra:** giải thích root cause, có trích dẫn evidence; **danh sách file/module được sửa** suy từ chuỗi nhân
  quả (đầu vào cho Bước 6), người dùng xác nhận cùng root cause.
```

Thay dòng Evidence bằng:

```markdown
- **Evidence:** đoạn giải thích root cause + trích dẫn evidence tương ứng + danh sách file được sửa + xác nhận
  của người dùng.
```

- [ ] **Step 6: Thay toàn bộ Bước 6**

```markdown
### Bước 6 — Fix tối thiểu

- **Thực hiện:** agent `backend-fixer` ∥ agent `frontend-fixer` (chỉ phía có lỗi theo Bước 2)
- **Đầu vào:** oracle = failing test của Bước 3 + root cause và danh sách file được sửa đã xác nhận ở Bước 5
- **Hành động:** agent sửa đúng nguyên nhân gốc theo skill `backend-fix`/`frontend-fix` (chế độ `bug`), phạm vi
  thay đổi tối thiểu trong danh sách file; chạy lại failing test của Bước 3 và build/lint của module đụng.
- **Ràng buộc:** cấm sửa khi chưa tái hiện được bug hoặc chưa có evidence mạnh; cấm chỉ sửa triệu chứng (che
  lỗi mà không sửa nguyên nhân); cấm xoá/nới điều kiện test cho qua; không sửa ngoài danh sách file — cần mở
  rộng → agent trả `blocked`, session chính hỏi người dùng rồi gọi lại.
- **Đầu ra:** code fix + failing test của Bước 3 chuyển xanh + build/lint xanh.
- **Gate:** failing test chuyển xanh; build/lint xanh; so với trạng thái ghi lại ở đầu bước
  (`git status --porcelain`), file thay đổi hoặc mới trong bước (`git diff --name-only` và
  `git ls-files --others --exclude-standard`) ⊆ danh sách file của Bước 5 và không chứa file test/fixture/snapshot.
- **Khi fail:** agent trả `blocked` → người dùng mở rộng danh sách (ghi bổ sung vào Đầu ra Bước 5) → gọi lại; fix
  không làm test xanh, hoặc test vẫn đỏ vì lý do khác → quay lại Bước 5 xem lại root cause; diff lệch danh sách
  → revert phần lệch, không nhận.
- **Evidence:** report của agent (lệnh chạy lại đúng test của Bước 3, exit code đỏ → 0) + danh sách file thay
  đổi hoặc mới trong bước so với trạng thái đầu bước.
```

- [ ] **Step 7: Thêm hàng vào bảng Xử lý lỗi & rollback**

Sau hàng `| Cấm: xoá/nới điều kiện test cho qua | … |` thêm:

```markdown
| Fixer trả `blocked` (Bước 6) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
```

- [ ] **Step 8: Chạy validate, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`. Đặc biệt: `workflow-bugfix bước 6: agent "backend-fixer" có trong frontmatter agents` (assert chung dòng 315) pass; `offeredCatalog: vẫn offer workflows/workflow-bugfix` pass.

- [ ] **Step 9: Kiểm assert Task 5 có răng (một lần, ở workflow đầu tiên được nối)**

Tạm xoá `"backend/backend-fix",` trong `_published.json` → `node test/validate.mjs` → Expected: `✗ offeredCatalog: vẫn offer workflows/workflow-bugfix …` đỏ. Hoàn lại bằng `git checkout plugins/_published.json`, chạy lại → `0 fail`.

- [ ] **Step 10: Commit**

```text
fix(workflows): dispatch bugfix fix step to fixer agents with diff gate

Changed:
- Bước 5 Root cause xuất thêm danh sách file/module được sửa, người dùng xác nhận cùng root cause.
- Bước 6 Fix tối thiểu: Thực hiện là agent backend-fixer ∥ frontend-fixer (chế độ bug); Gate so diff với mốc đầu bước, ⊆ danh sách, không chứa file test; Khi fail xử lý agent trả blocked.
- Frontmatter agents và tiền điều kiện thêm 2 agent fixer; bảng lỗi thêm hàng "Fixer trả blocked".
- Thêm assert khối 18 cho bugfix; số bước giữ 9.

Reason:
- Bước sửa code chỉ ràng buộc phạm vi bằng lời văn; chuyển sang agent có hợp đồng riêng và gate kiểm diff (spec 2026-09-30 §5, A4/Q2 của spec 2026-09-29).
```

---

### Task 7: Nối `workflow-security-review` (Bước 5 Đầu ra, Bước 8 → fixer)

**Files:**
- Modify: `workflows/security-review/WORKFLOW.md` — frontmatter dòng 9; Điều kiện tiên quyết; Bước 5 (dòng ~97-108); Bước 8 (dòng 145-156); bảng lỗi
- Modify: `test/validate.mjs:959` và khối 18

- [ ] **Step 1: Thêm assert đỏ vào khối 18**

```js
  fixStepOk('workflow-security-review', 5, 8, /^Kế hoạch remediation/, /^Sửa/);
  ok(parseSteps(wf18('workflow-security-review')?.body ?? '').length === 10, 'workflow-security-review: vẫn 10 bước');
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm**

Run: `node test/validate.mjs`
Expected: `✗ workflow-security-review Bước 5/8 …`, frontmatter, bảng lỗi đỏ; `vẫn 10 bước` xanh.

- [ ] **Step 3: Sửa frontmatter dòng 9**

```yaml
agents: "engineering-quality-auditor,backend-test-writer,frontend-test-writer,backend-fixer,frontend-fixer"
```

- [ ] **Step 4: Sửa assert cũ `test/validate.mjs:959`**

Đọc dòng 957-959 hiện tại (assert `sec.agents` gồm auditor + 2 test-writer). Sửa message và điều kiện để chấp nhận thêm 2 fixer, ví dụ:

```js
  ok(sec && ['engineering-quality-auditor', 'backend-test-writer', 'frontend-test-writer', 'backend-fixer', 'frontend-fixer'].every((a) => sec.agents.includes(a)),
    'workflow-security-review: agents gồm auditor + 2 test-writer (regression test) + 2 fixer (sửa)');
```

(Giữ nguyên các biến `sec`, `secStep` đã có ở dòng 955-957.)

- [ ] **Step 5: Sửa Điều kiện tiên quyết**

```markdown
- Skill/agent đã cài: `engineering-quality-auditor`, `backend-test-writer`, `frontend-test-writer`,
  `backend-fixer`, `frontend-fixer` (test-writer và fixer chỉ phía có finding cần sửa), skill `core/git-workflow`.
```

- [ ] **Step 6: Sửa Bước 5 — Đầu ra và Evidence**

Thay dòng Đầu ra:

```markdown
- **Đầu ra:** danh sách finding người dùng chọn sửa + **danh sách file được sửa cho mỗi finding đã chọn** (đầu
  vào cho Bước 8) + danh sách finding được chấp nhận rủi ro (nếu có).
```

Thay dòng Evidence:

```markdown
- **Evidence:** danh sách finding người dùng chọn sửa/chấp nhận kèm file được sửa cho mỗi finding, trích dẫn xác
  nhận của người dùng.
```

- [ ] **Step 7: Thay toàn bộ Bước 8**

```markdown
### Bước 8 — Sửa

- **Thực hiện:** agent `backend-fixer` ∥ agent `frontend-fixer` (chỉ phía có finding cần sửa)
- **Đầu vào:** oracle = test regression đỏ của Bước 7 + danh sách finding và danh sách file được sửa từ Bước 5
- **Hành động:** agent sửa đúng finding đã chọn theo skill `backend-fix`/`frontend-fix` (chế độ `security`),
  phạm vi tối thiểu trong danh sách file; chạy lại build/test của phạm vi đã sửa, gồm test regression ở Bước 7
  (phải chuyển từ đỏ sang xanh).
- **Ràng buộc:** không sửa ngoài phạm vi finding đã chọn và danh sách file — cần mở rộng → agent trả `blocked`,
  session chính hỏi người dùng rồi gọi lại; không chỉ che triệu chứng (vd log giảm chi tiết thay vì sửa lỗ hổng
  thật); không xoá hay nới test regression để qua.
- **Đầu ra:** code đã sửa, build/test xanh, test regression xanh.
- **Gate:** build/test xanh, gồm test regression; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`),
  file thay đổi hoặc mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) ⊆
  danh sách file của Bước 5 và không chứa file test/fixture/snapshot.
- **Khi fail:** agent trả `blocked` → người dùng mở rộng danh sách (ghi bổ sung vào Đầu ra Bước 5) → gọi lại; sửa
  xong vẫn đỏ → chẩn đoán lại, sửa tiếp trong danh sách, không bỏ qua; diff lệch danh sách → revert phần lệch,
  không nhận.
- **Evidence:** report của agent (lệnh build/test + exit code 0, test regression đã từ đỏ sang xanh) + danh sách
  file thay đổi hoặc mới trong bước so với trạng thái đầu bước.
```

- [ ] **Step 8: Thêm hàng vào bảng lỗi**

Sau hàng `| Test regression không đỏ đúng lý do (Bước 7) | … |`:

```markdown
| Fixer trả `blocked` (Bước 8) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
```

- [ ] **Step 9: Chạy validate, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`, gồm assert `workflow-security-review: 10 bước, Sửa ở Bước 8, Re-scan ở Bước 9, Commit ở Bước 10` (dòng 969) vẫn pass.

- [ ] **Step 10: Commit**

```text
fix(workflows): dispatch security-review fix step to fixer agents with diff gate

Changed:
- Bước 5 Kế hoạch remediation xuất thêm danh sách file được sửa cho mỗi finding đã chọn.
- Bước 8 Sửa: Thực hiện là agent backend-fixer ∥ frontend-fixer (chế độ security); Gate so diff với mốc đầu bước, ⊆ danh sách, không chứa file test; Khi fail xử lý blocked.
- Frontmatter agents, tiền điều kiện, bảng lỗi cập nhật; sửa assert agents của security-review và thêm assert khối 18.

Reason:
- Bước sửa finding chỉ ràng buộc bằng lời văn; cần agent có hợp đồng riêng và gate kiểm diff (spec 2026-09-30 §5).
```

---

### Task 8: Nối `workflow-performance` (Bước 3 Đầu ra, Bước 4 → fixer)

**Files:**
- Modify: `workflows/performance/WORKFLOW.md` — frontmatter dòng 9; Điều kiện tiên quyết; Bước 3 (dòng 60-70); Bước 4 (dòng 72-81); bảng lỗi
- Modify: `test/validate.mjs` (khối 18)

- [ ] **Step 1: Thêm assert đỏ vào khối 18**

```js
  fixStepOk('workflow-performance', 3, 4, /^Profile & giả thuyết/, /^Tối ưu/);
  ok(parseSteps(wf18('workflow-performance')?.body ?? '').length === 7, 'workflow-performance: vẫn 7 bước');
  // Review Focus 2: chế độ performance không có oracle đỏ — bước phải nói rõ số đo thuộc Bước 5.
  ok(flat18(step18(wf18('workflow-performance'), 4).body).includes('Bước 5'),
    'workflow-performance Bước 4: không kết luận hiệu năng, số đo thuộc Bước 5');
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm**

Run: `node test/validate.mjs`
Expected: `✗ workflow-performance Bước 3/4 …` và frontmatter/bảng lỗi đỏ; `vẫn 7 bước` xanh.

- [ ] **Step 3: Sửa frontmatter dòng 9**

```yaml
agents: "backend-fixer,frontend-fixer,backend-reviewer,frontend-reviewer"
```

- [ ] **Step 4: Sửa Điều kiện tiên quyết**

```markdown
- Skill/agent đã cài: `backend-fixer`, `frontend-fixer`, `backend-reviewer`, `frontend-reviewer`, skill
  `core/git-workflow`.
```

- [ ] **Step 5: Sửa Bước 3 — Đầu ra và Evidence**

Thay `- **Đầu ra:** bottleneck + giả thuyết đã xác nhận.` bằng:

```markdown
- **Đầu ra:** bottleneck + giả thuyết đã xác nhận + **danh sách file/hàm bottleneck được sửa** (đầu vào cho
  Bước 4).
```

Thay Evidence:

```markdown
- **Evidence:** kết quả profile (file:line hoặc số đo) trong report bước + danh sách file được sửa + xác nhận
  của người dùng.
```

- [ ] **Step 6: Thay toàn bộ Bước 4**

```markdown
### Bước 4 — Tối ưu

- **Thực hiện:** agent `backend-fixer` ∥ agent `frontend-fixer` (chỉ phía có đụng)
- **Đầu vào:** giả thuyết đã xác nhận + danh sách file/hàm bottleneck từ Bước 3 (không có test đỏ; oracle là giả
  thuyết có evidence profile)
- **Hành động:** agent áp thay đổi theo giả thuyết theo skill `backend-fix`/`frontend-fix` (chế độ
  `performance`), trong danh sách file; chạy build/test sau mỗi thay đổi. Agent **không kết luận nhanh hơn** —
  số đo trước/sau thuộc Bước 5.
- **Ràng buộc:** không tối ưu ngoài bottleneck đã xác nhận và danh sách file — cần mở rộng → agent trả
  `blocked`, session chính hỏi người dùng rồi gọi lại; không nới test hay skip test để qua.
- **Đầu ra:** code đã tối ưu, build/test xanh.
- **Gate:** build/test xanh; so với trạng thái ghi lại ở đầu bước (`git status --porcelain`), file thay đổi hoặc
  mới trong bước (`git diff --name-only` và `git ls-files --others --exclude-standard`) ⊆ danh sách file của Bước
  3 và không chứa file test/fixture/snapshot.
- **Khi fail:** agent trả `blocked` → người dùng mở rộng danh sách (ghi bổ sung vào Đầu ra Bước 3) → gọi lại;
  build/test đỏ → sửa hoặc revert thay đổi, không giữ thay đổi đỏ; diff lệch danh sách → revert phần lệch, không
  nhận.
- **Evidence:** report của agent (lệnh build/test + exit code) + danh sách file thay đổi hoặc mới trong bước so
  với trạng thái đầu bước.
```

- [ ] **Step 7: Thêm hàng vào bảng lỗi**

Sau hàng `| Người dùng không đồng ý hướng tối ưu (sau Bước 3 ⏸) | … |`:

```markdown
| Fixer trả `blocked` (Bước 4) | Người dùng mở rộng danh sách file có xác nhận, gọi lại agent; không tự mở phạm vi |
```

- [ ] **Step 8: Chạy toàn bộ test**

Run: `npm test`
Expected: validate `0 fail`; các test khác không có `✗`. Ghi số pass mới.

- [ ] **Step 9: Commit**

```text
fix(workflows): dispatch performance optimise step to fixer agents with diff gate

Changed:
- Bước 3 Profile & giả thuyết xuất thêm danh sách file/hàm bottleneck được sửa.
- Bước 4 Tối ưu: Thực hiện là agent backend-fixer ∥ frontend-fixer (chế độ performance, không kết luận hiệu năng — số đo thuộc Bước 5); Gate so diff với mốc đầu bước, ⊆ danh sách, không chứa file test.
- Frontmatter agents, tiền điều kiện, bảng lỗi cập nhật; thêm assert khối 18, số bước giữ 7.

Reason:
- Bước tối ưu chỉ ràng buộc "không ngoài bottleneck" bằng lời văn; cần agent có hợp đồng riêng và gate kiểm diff (spec 2026-09-30 §5, §3.3 chế độ performance).
```

---

### Task 9: Tài liệu — README, pointer refactor → fix, cập nhật spec 2026-09-29 (FX-P5)

**Files:**
- Modify: `README.md:157-162` (bảng agent), `README.md:181,185,188` (bảng workflow)
- Modify: `README_VI.md` (các dòng tương ứng: bảng agent ~153-158, bảng workflow 177/181/184)
- Modify: `plugins/backend/skills/backend-refactor/SKILL.md:34`, `plugins/frontend/skills/frontend-refactor/SKILL.md:36-38`
- Modify: `docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md` §8.1, §9, §13
- Modify: `test/validate.mjs` (khối 18)

- [ ] **Step 1: Thêm assert đỏ cho README vào khối 18**

```js
  for (const f of ['README.md', 'README_VI.md']) {
    const rd = fs.readFileSync(path.join(REPO_ROOT, f), 'utf8');
    const row = (agent) => rd.split('\n').find((l) => l.startsWith(`| \`${agent}\` |`)) ?? '';
    ok(['WF02', 'WF06', 'WF09'].every((w) => row('backend-fixer').includes(w) && row('frontend-fixer').includes(w)),
      `${f}: bảng agent có backend-fixer, frontend-fixer dùng ở WF02, WF06, WF09`);
  }
  // §3.2: refactor không còn trỏ "sửa bug → *-implement"; đích đúng là *-fix.
  for (const p of ['backend', 'frontend']) {
    const r = fs.readFileSync(path.join(PLUGINS_DIR, p, 'skills', `${p}-refactor`, 'SKILL.md'), 'utf8');
    ok(flat18(r).includes(`sửa bug`) && flat18(r).includes(`\`${p}-fix\``),
      `${p}-refactor: câu "cần đổi hành vi (sửa bug…)" trỏ sang ${p}-fix`);
  }
```

- [ ] **Step 2: Chạy validate, xác nhận đỏ đúng nhóm**

Run: `node test/validate.mjs`
Expected: 2 dòng `✗ README*.md: bảng agent …` và 2 dòng `✗ *-refactor: …`.

- [ ] **Step 3: Sửa bảng agent `README.md`**

Sau dòng `| \`backend-reviewer\` | … |` thêm:

```markdown
| `backend-fixer` | backend | write | backend-fix | WF02, WF06, WF09 |
```

Sau dòng `| \`frontend-reviewer\` | … |` thêm:

```markdown
| `frontend-fixer` | frontend | write | frontend-fix | WF02, WF06, WF09 |
```

- [ ] **Step 4: Sửa bảng workflow `README.md`**

- Dòng WF02: cột agent → `BE/FE test-writer, BE/FE fixer, BE/FE reviewer, quality-auditor`
- Dòng WF06: → `quality-auditor, backend-test-writer, frontend-test-writer, backend-fixer, frontend-fixer`
- Dòng WF09: → `backend-fixer, frontend-fixer, backend-reviewer, frontend-reviewer`

- [ ] **Step 5: Sửa `README_VI.md` tương ứng**

Cùng 2 dòng agent (sau `backend-reviewer` dòng ~155 và `frontend-reviewer` dòng ~158) và 3 dòng workflow (177, 181, 184) với nội dung y hệt Step 3–4 (bảng dùng cùng id tiếng Anh).

- [ ] **Step 6: Sửa pointer trong `backend-refactor/SKILL.md:34`**

Thay `gọi \`backend-implement\`` trong câu "Cần đổi hành vi (sửa bug, đổi quy tắc) → đó là bước RIÊNG, tách khỏi refactor, gọi `backend-implement`" bằng:

```markdown
  side-effect quan sát được. Cần đổi hành vi (sửa bug, đổi quy tắc) → đó là bước RIÊNG, tách khỏi
  refactor: sửa bug theo oracle đỏ gọi `backend-fix`, thêm nghiệp vụ mới gọi `backend-implement`; KHÔNG trộn
  "dọn code" với "đổi logic" trong một bước.
```

- [ ] **Step 7: Sửa pointer trong `frontend-refactor/SKILL.md:36-38`**

```markdown
  cùng UI render + cùng side-effect (request phát ra, điều hướng, message). Cần đổi hành vi (sửa bug,
  đổi UX, đổi luồng) → đó là bước RIÊNG, tách khỏi refactor: sửa bug theo oracle đỏ gọi `frontend-fix`, dựng
  UI mới gọi `frontend-implement`; KHÔNG trộn "dọn component" với "đổi logic" trong một bước.
```

- [ ] **Step 8: Cập nhật spec 2026-09-29**

- §8.1 tiêu đề `### 8.1 Catalog sau nâng cấp (11 → 13)` → `(11 → 15)`; thêm 2 dòng bảng:
  `| **backend-fixer** | backend | write | backend-fix | bugfix, security-review, performance | **mới** (A4, spec 2026-09-30) |`
  và dòng tương ứng cho `frontend-fixer`.
- §9 hàng P3: cột Trạng thái đổi `◐ … còn A4, G10` → `◐ … A4 xong (spec 2026-09-30-fixer-agent-design); còn G10`.
- §13.2: xoá hàng `A4 / Q2`; §13.1 thêm hàng `A4/Q2: fixer agent | <merge hash khi có> | <commit Task 1–9>` (ghi hash thật sau khi merge; trước đó ghi tên nhánh `feature/fixer-agent`).
- §11 Q2: gạch ngang, ghi "Đã chốt (2026-09-30): spec `2026-09-30-fixer-agent-design.md`".

- [ ] **Step 9: Chạy validate**

Run: `node test/validate.mjs`
Expected: `0 fail`.

- [ ] **Step 10: Commit**

```text
docs: document fixer agents in README, refactor pointers and upgrade spec

Changed:
- README/README_VI: bảng agent thêm backend-fixer, frontend-fixer (WF02, WF06, WF09); bảng workflow cập nhật cột agent của WF02/WF06/WF09.
- backend-refactor/frontend-refactor: câu "cần đổi hành vi (sửa bug…)" trỏ sang *-fix thay cho *-implement.
- Spec 2026-09-29: §8.1 catalog 15 agent, §9/§11/§13 đánh dấu A4/Q2 xong.
- Thêm assert README và pointer refactor vào khối validate 18.

Reason:
- Tài liệu và pointer chéo skill phải khớp catalog mới; ranh giới refactor ↔ fix là một phần của thiết kế (spec 2026-09-30 §3.2, §4.4).
```

---

### Task 10: Smoke install trong sandbox (FX-P6)

**Files:** không sửa source. Chỉ chạy lệnh và báo kết quả.

- [ ] **Step 1: Build mới nhất**

Run: `npm run build`
Expected: không lỗi.

- [ ] **Step 2: Cài workflow-bugfix vào sandbox, kiểm closure**

Sandbox đặt trong scratchpad, dọn bằng Node (không `rm -rf`, xem Global Constraints về junction):

```bash
SB="$(node -e "console.log(require('os').tmpdir())")/aip-fixer-smoke" && node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true});require('fs').mkdirSync(process.argv[1],{recursive:true})" "$SB" && AIE_INSTALL_ROOT="$SB" node cli/index.mjs install --provider claude --skill workflows/workflow-bugfix --yes && node -e "const m=require(process.argv[1]+'/.ai-engineering/manifest.json');console.log(JSON.stringify(m,null,1).split('\n').filter(l=>/fix/.test(l)).join('\n'))" "$SB"
```

Expected: manifest có đường dẫn chứa `backend-fix`, `frontend-fix`, `backend-fixer`, `frontend-fixer` (closure kéo skill + agent theo `expandWorkflowDeps`). Nếu lệnh `install` từ chối workflow vì thiếu skill → đó là lỗi publish, quay lại Task 4.

- [ ] **Step 3: Dọn sandbox bằng Node**

```bash
node -e "require('fs').rmSync(process.argv[1],{recursive:true,force:true})" "$SB"
```

Expected: thư mục biến mất; `git status --short` trong repo **sạch** (không có file nào trong `build/` bị xoá — nếu có, junction đã bị đi xuyên; chạy `npm run build` để dựng lại và báo).

- [ ] **Step 4: Báo kết quả**

Ghi vào report cuối: lệnh đã chạy, exit code, danh sách đường dẫn khớp `fix` trong manifest. Mục "Client thật (`/agents` trong Claude Code)" và "Hành vi trên project mẫu" là `[Unverified]` — không tuyên bố.

Không có commit ở task này.

---

## Self-Review

**1. Spec coverage**

| Spec | Task |
|---|---|
| §3 skill (vị trí, frontmatter, ranh giới, 3 chế độ, F1–F5, che triệu chứng theo stack, trigger) | 1 |
| §4.1–4.3 agent + assert | 2 |
| §4.4 README | 9 |
| §5.1 không đánh số lại | 6, 7, 8 (assert số bước) |
| §5.2–5.3 bước ⏸ xuất danh sách file; bước sửa khung mới | 6, 7, 8 |
| §5.4 frontmatter, `validate.mjs:959`, bảng lỗi | 6, 7 (959), 8 |
| §5.5 fallback preamble | không cần sửa (đã có) |
| §6.1 publish/manifest/cowork | 4 |
| §6.2 install.test 183/194/205; assert "3 workflow vẫn offer" | 4, 5 |
| §6.3 kiểm chứng (validate/build/test/smoke) | mọi task; 10 |
| §7 thứ tự FX-P3 trước FX-P4 | Task 4 trước 5–8 |
| §3.2 ranh giới refactor ↔ fix (pointer) | 9 |
| Spec 2026-09-29 §8.1/§9/§13 | 9 |

Không có gap.

**2. Placeholder scan:** không có TBD/TODO. Task 3 để trống có chủ ý và ghi rõ lý do. Hash merge ở Task 9 Step 8 được chỉ định ghi tên nhánh cho tới khi có hash thật — đây là dữ liệu chưa tồn tại, không phải placeholder.

**3. Type consistency:** helper `flat18`, `fixSkill`, `fixAgent`, `wf18`, `step18`, `fixStepOk` định nghĩa trong khối 18 (Task 1, 2, 6) và dùng ở Task 6–9 cùng tên. `parseSteps`, `workflows`, `PLUGINS_DIR`, `REPO_ROOT`, `ok`, `fs`, `path` đã tồn tại ở đầu `validate.mjs`. `offeredCatalog` được import ở Task 5 trước khi dùng.

**4. Review Focus:** (1) → Task 5 + Task 6 Step 9; (2) → Task 1 assert "không tự tuyên bố nhanh hơn" + Task 8 assert Bước 4 nhắc Bước 5; (3) → Task 2 assert `blocked`/"không tự mở"; (4) → `fixStepOk` assert `git status --porcelain` + `git diff --name-only`; (5) → `fixStepOk` assert Đầu ra bước ⏸ có "danh sách file".
