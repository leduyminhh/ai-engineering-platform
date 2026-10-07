# engineering-task-breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm skill docs-only `engineering-task-breakdown` vào plugin `engineering` để teamlead phân rã yêu cầu / use case / ARD / `requirement.md` thành task BE/FE giao được cho dev và agent, xuất `tasks.md` (+ Excel tuỳ chọn).

**Architecture:** Skill là recipe markdown (SKILL.md + 7 file `references/`), được CLI auto-discover và chiếu ra 4 provider; không có code runtime mới. Hợp đồng nội dung được ép bằng assert mới trong `test/validate.mjs` (khối 29a–29d), viết TRƯỚC nội dung (test-first). Tích hợp chỉ chạm manifest/cowork/README/CLAUDE.md và một câu trỏ trong `engineering-spec-writing`.

**Tech Stack:** Node.js 20+ ESM, zero-dependency; test bằng `node test/validate.mjs` (hàm `ok(cond, msg)`); nội dung tiếng Việt UTF-8 không BOM, LF.

**Spec:** `docs/superpowers/specs/2026-10-07-engineering-task-breakdown-design.md`

## Global Constraints

- Nội dung skill viết tiếng Việt CÓ DẤU, UTF-8 **không BOM**, line ending **LF**.
- `SKILL.md` phải có H2 bắt đầu bằng `## Quy trình` và `## Ranh giới an toàn` (`cli/lib/conventions.mjs`, kiểm ở `test/validate.mjs` khối 25).
- `description` ≤ 1024 ký tự; KHÔNG chứa câu "KHÔNG thuộc pipeline"; KHÔNG chứa chuỗi `" #"`; kết thúc bằng câu `Không dùng khi … → <id>` trỏ tới id có thật (khối 26).
- Cụm trong ngoặc kép của `description` được coi là trigger — KHÔNG được trùng nguyên văn trigger của skill/workflow khác (khối 26). Chỉ đặt trong ngoặc kép đúng 6 trigger: "tách task", "chia task", "phân rã yêu cầu", "breakdown task", "lập task BE FE", "task từ use case" (+ "skill").
- Câu đầu tiên của `description` ≤ 200 ký tự để dòng "Khi nào dùng" không bị cắt (`WHEN_TO_USE_MAX = 200`, `adapters/_shared/lib.mjs:82`).
- Tên file trong `references/` phải duy nhất trong plugin `engineering` (`test/validate.mjs:240`) — vì vậy checklist tên là `breakdown-checklist.md`.
- 6 loại task: `CT`, `DB`, `BE`, `FE-UI`, `FE-INT`, `E2E`; chuỗi lát dọc viết đúng `CT → DB → BE → FE-UI → FE-INT → E2E`.
- Size: S ≤ 0.5 ngày, M ≤ 2 ngày, L > 2 ngày → buộc tách.
- Không sửa: `cli/`, `adapters/`, `workflows/`, `plugins/_published.json`, `pack.config.json`, `package.json`.
- Commit qua skill `core:git-workflow`: header tiếng Anh `type(scope): summary`, body tiếng Việt có dấu (Changed/Reason), `git commit -F <file>`, KHÔNG có dòng `Co-authored-by` / `Co-Authored-By`. Branch làm việc: `feature/engineering-task-breakdown`.
- Comment trong code/test: tiếng Việt, chỉ giải thích *vì sao*, chỉ khi qua quality gate của AGENTS.md.

## Review Focus

- Use case không có API (chỉ UI tĩnh) hoặc chỉ có backend (job) → skill phải nói rõ KHÔNG sinh `CT`/`BE`/`FE-INT` hoặc `FE-UI`/`FE-INT`/`E2E`; test ở Task 2 (assert "Chỉ sinh loại cần" + "không sinh").
- Hai nguồn input mâu thuẫn (use case vs ARD) → không tự chọn, ghi Câu hỏi mở nêu cả hai phía; test ở Task 1 (assert `mâu thuẫn` trong `analysis.md`).
- Chạy lại khi `tasks.md` đã tồn tại → không ghi đè im lặng, hỏi cập nhật/ghi đè và giữ Owner/Trạng thái; test ở Task 3 (assert `đã tồn tại`).
- Ô CSV chứa dấu phẩy, ngoặc kép, xuống dòng (AC nhiều dòng) → quote mọi ô; test ở Task 3 (assert `QUOTE_ALL` + `utf-8-sig`).
- Project chưa có `project-knowledge/` → vẫn chạy, đánh dấu `[giả định]` ở "File dự kiến"/"Lệnh verify"; test ở Task 1 (assert `Thiếu \`project-knowledge/\``).

---

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` | Frontmatter + quy trình 0–6 + ranh giới + bản đồ tài liệu | 1 |
| `…/references/analysis.md` | Nhận diện input, ngưỡng mơ hồ, bảng Use case, nguồn mâu thuẫn | 1 |
| `…/references/sizing.md` | S/M/L + cách tách L | 1 |
| `…/references/breakdown-checklist.md` | DoD trước Checkpoint 2 | 1 |
| `…/references/task-template-common.md` | Loại task, ID, header chung, CT/DB/E2E, quy tắc điền | 2 |
| `…/references/task-template-backend.md` | Backend cần gì B1–B10 | 2 |
| `…/references/task-template-frontend.md` | Frontend cần gì F1–F9 | 2 |
| `…/references/output-formats.md` | `tasks.md`, Excel 3 sheet, CSV BOM, mẫu Python | 3 |
| `test/validate.mjs` | Khối assert 29a (Task 1), 29b (Task 2), 29c (Task 3), 29d (Task 4) | 1–4 |
| `plugins/engineering/.manifest.json`, `plugins/_cowork.json`, `README.md`, `README_VI.md`, `CLAUDE.md`, `plugins/engineering/skills/engineering-spec-writing/SKILL.md` | Tích hợp | 4 |

**Vị trí chèn khối assert:** mỗi khối mới chèn ngay TRƯỚC 2 dòng cuối file sau đây trong `test/validate.mjs` (khối sau chèn sau khối trước):

```js
// ─────────────────────────────────────────────────────────────────────────────
console.log('');
```

Biến có sẵn trong file dùng được: `fs`, `path`, `REPO_ROOT`, `PLUGINS_DIR`, `ok`.

---

### Task 1: SKILL.md + analysis/sizing/checklist

**Files:**
- Create: `plugins/engineering/skills/engineering-task-breakdown/SKILL.md`
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/analysis.md`
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/sizing.md`
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/breakdown-checklist.md`
- Modify: `test/validate.mjs` (chèn khối 29a trước `console.log('');` cuối file)

**Interfaces:**
- Consumes: không có.
- Produces: SKILL.md đã link tới đủ 7 file `references/` (4 file còn lại do Task 2–3 tạo, tên chính xác: `task-template-common.md`, `task-template-backend.md`, `task-template-frontend.md`, `output-formats.md`). Hằng `TB_DIR` chỉ sống trong khối 29a — các khối sau tự khai báo lại.

- [ ] **Step 1: Viết test đỏ (khối 29a)**

Chèn vào `test/validate.mjs` ngay trước `// ───…` + `console.log('');` cuối file:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 29a. SOURCE: engineering-task-breakdown — SKILL.md + analysis/sizing/checklist (spec 2026-10-07 §4, §6.1)
// ─────────────────────────────────────────────────────────────────────────────
{
  const TB_DIR = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown');
  const tbRead = (rel) => { const p = path.join(TB_DIR, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const skill = tbRead('SKILL.md');
  ok(skill !== '', 'engineering-task-breakdown: có SKILL.md');
  ok(/^order: 7$/m.test(skill) && /^runsIn: plan$/m.test(skill) && /^invoke: per-request$/m.test(skill),
    'engineering-task-breakdown: frontmatter order 7, runsIn plan, invoke per-request');
  for (const f of ['analysis.md', 'task-template-common.md', 'task-template-backend.md', 'task-template-frontend.md',
    'sizing.md', 'output-formats.md', 'breakdown-checklist.md']) {
    ok(skill.includes(`(references/${f})`), `engineering-task-breakdown: SKILL.md link tới references/${f}`);
  }
  ok(skill.includes('CT → DB → BE → FE-UI → FE-INT → E2E'), 'engineering-task-breakdown: SKILL.md nêu chuỗi lát dọc đủ 6 loại');
  ok(skill.includes('Checkpoint 1') && skill.includes('Checkpoint 2'), 'engineering-task-breakdown: có 2 checkpoint teamlead duyệt');
  ok(skill.includes('engineering-spec-writing') && skill.includes('ngưỡng mơ hồ'),
    'engineering-task-breakdown: input mơ hồ → chuyển engineering-spec-writing');
  ok(skill.includes('Thiếu `project-knowledge/`') && skill.includes('[giả định]'),
    'engineering-task-breakdown: thiếu project-knowledge vẫn chạy, đánh dấu [giả định]');
  const analysis = tbRead('references/analysis.md');
  ok(analysis.includes('Ngưỡng mơ hồ') && analysis.includes('mâu thuẫn') && analysis.includes('| ID | Tên | Actor |'),
    'engineering-task-breakdown: analysis có ngưỡng mơ hồ, xử lý nguồn mâu thuẫn, bảng Use case');
  const sizing = tbRead('references/sizing.md');
  ok(['| S |', '| M |', '| L |'].every((s) => sizing.includes(s)) && sizing.includes('Buộc tách'),
    'engineering-task-breakdown: sizing có S/M/L và quy tắc buộc tách L');
  const checklist = tbRead('references/breakdown-checklist.md');
  ok(checklist.includes('vòng phụ thuộc') && checklist.includes('N/A — <lý do>') && checklist.includes('size `L`'),
    'engineering-task-breakdown: checklist kiểm vòng phụ thuộc, mục N/A, task L');
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL, có các dòng `✗ engineering-task-breakdown: có SKILL.md`, `✗ … link tới references/…` (7 dòng), `✗ … analysis có ngưỡng mơ hồ…`, `✗ … sizing…`, `✗ … checklist…`. Các assert cũ vẫn pass.

- [ ] **Step 3: Tạo `SKILL.md`**

Nội dung đầy đủ (file `plugins/engineering/skills/engineering-task-breakdown/SKILL.md`):

````markdown
---
name: engineering-task-breakdown
description: "Skill capability (plugin engineering) để teamlead PHÂN RÃ yêu cầu, use case, ARD hoặc requirement.md thành danh sách task BE/FE giao được cho dev và agent. Phân tích ra bảng use case (actor, AC đo được, NFR), tách theo lát dọc CT → DB → BE → FE-UI → FE-INT → E2E, điền template chuẩn cho Backend và Frontend, ước lượng size S/M/L (L buộc tách), kiểm phủ AC và phụ thuộc, rồi xuất tasks.md vào docs/requests/ (tuỳ chọn Excel: xlsx hoặc CSV UTF-8 có BOM). Docs-only, không sinh code, không gán người. Dùng skill NÀY khi người dùng muốn \"tách task\", \"chia task\", \"phân rã yêu cầu\", \"breakdown task\", \"lập task BE FE\", \"task từ use case\" — kể cả khi không nói chính xác chữ \"skill\". Gọi khi cần ở giai đoạn plan. Không dùng khi yêu cầu còn mơ hồ cần khảo sát → engineering-spec-writing; làm feature end-to-end → workflow-feature."
order: 7
title: "Task Breakdown — phân rã yêu cầu thành task BE/FE giao được"
runsIn: plan
invoke: per-request
---

# Task Breakdown (skill dùng chung)

Biến yêu cầu thô, use case, ARD hoặc `requirement.md` thành **danh sách task giao được** cho hai đối tượng: dev
trong team đọc markdown trong repo, và agent AI (`backend-implementer`, `frontend-implementer`…) nhận từng task để
code. Skill này là **docs-only recipe** — hướng dẫn agent phân tích và viết tài liệu task, KHÔNG sinh code.

Tách theo **use case — lát dọc** `CT → DB → BE → FE-UI → FE-INT → E2E`, chỉ sinh loại task thật sự cần. Mỗi task
**tự đủ nghĩa**: người hoặc agent nhận một task không cần đọc lại toàn bộ input. `tasks.md` là **nguồn sự thật**;
Excel chỉ là bản xuất.

Teamlead giữ chốt ở hai điểm: duyệt danh sách use case (**Checkpoint 1**) và duyệt bản tách task (**Checkpoint 2**).

## Khi nào dùng

- Teamlead/manager muốn tách task, chia task, phân rã yêu cầu thành việc cho team Backend/Frontend.
- Đã có use case, ARD hoặc `requirement.md` (ví dụ do `engineering-spec-writing` viết) và cần biến thành task có
  ID, phụ thuộc, size, AC.
- Cần giao việc cho agent theo từng task: "làm task `UC01-BE-01` trong `tasks.md`".

KHÔNG dùng khi yêu cầu còn mơ hồ (chạy `engineering-spec-writing` trước), hay khi muốn làm feature end-to-end
(dùng `workflow-feature`).

## Ranh giới an toàn

- **Docs-only** — KHÔNG sinh code; chỉ ghi trong `docs/requests/`.
- **KHÔNG bịa yêu cầu.** Thiếu thông tin → đánh dấu **[giả định]** hoặc đưa vào Câu hỏi mở; không âm thầm điền.
- KHÔNG tự chốt quyết định kiến trúc → ghi Câu hỏi mở + gợi ý `engineering-adr`.
- KHÔNG gán người: cột `Owner` để trống cho teamlead.
- Đổi schema DB → nêu rõ trong task `DB` + gợi ý `workflow-db-change`.
- KHÔNG ghi đè `requirement.md` / `plan.md` có sẵn; `tasks.md` đã tồn tại → hỏi trước (xem output-formats).
- Ngôn ngữ đo được; không tuyên bố tuyệt đối.
- Con người **duyệt** ở Checkpoint 1 và Checkpoint 2 trước khi task được giao.

## Quy trình — phân rã task

0. **Nạp context (BẮT BUỘC).**
   Đọc `project-knowledge/` (`architecture.md` BE/FE, `data-model.md`, `design-system.md`, `code-convention.md`),
   `docs/contracts/`, `docs/decisions/`, `CLAUDE.md`. Thiếu `project-knowledge/` → nói rõ (fail-loud), vẫn tách
   được nhưng đánh dấu **[giả định]** ở mục "File dự kiến" và "Lệnh verify" của mọi task.

1. **Nhận diện input.**
   Xác định dạng input (yêu cầu thô / use case / ARD / `requirement.md`, có thể nhiều nguồn) theo
   [references/analysis.md](references/analysis.md). Có `requirement.md` → dùng làm nguồn chính. Chạm
   **ngưỡng mơ hồ** (không trích được use case nào có actor + mục tiêu, HOẶC không có AC đo được) → DỪNG, đề nghị
   chạy `engineering-spec-writing` trước.

2. **Phân tích → bảng Use case. ⏸ Checkpoint 1**
   Mỗi use case: ID `UC<nn>`, actor, mục tiêu, luồng chính/phụ, AC đo được, NFR, nguồn truy vết. Nguồn mâu thuẫn
   hoặc thiếu → Câu hỏi mở. Trình bảng Use case + Câu hỏi mở cho teamlead duyệt TRƯỚC khi tách task.

3. **Tách task theo lát dọc.**
   Với mỗi use case sinh task theo thứ tự `CT → DB → BE → FE-UI → FE-INT → E2E`, chỉ sinh loại cần (bảng loại và
   điều kiện ở [references/task-template-common.md](references/task-template-common.md)). Phụ thuộc chuẩn:

   | Task | Phụ thuộc |
   |---|---|
   | `BE` | `CT`, `DB` của cùng use case (nếu có) |
   | `FE-UI` | không chờ `BE` — làm song song khi có contract hoặc mock |
   | `FE-INT` | `CT`, `FE-UI` |
   | `E2E` | `BE`, `FE-INT` |

   Nền tảng dùng chung (auth, layout, shared component) → nhóm `UC00`, chỉ khi ≥ 2 use case cần.

4. **Điền template + size.**
   Task `BE` theo [references/task-template-backend.md](references/task-template-backend.md); `FE-UI` / `FE-INT`
   theo [references/task-template-frontend.md](references/task-template-frontend.md); header chung + `CT` / `DB` /
   `E2E` theo task-template-common. Size theo [references/sizing.md](references/sizing.md): S ≤ 0.5 ngày,
   M ≤ 2 ngày, L → buộc tách. Mục không áp dụng ghi `N/A — <lý do>`, không bỏ trống.

5. **Kiểm tra. ⏸ Checkpoint 2**
   Chạy [references/breakdown-checklist.md](references/breakdown-checklist.md): phủ AC, không vòng phụ thuộc,
   không task L, không mục trống, ID duy nhất. Nêu rõ phần còn thiếu (fail-loud); trình bảng tổng task cho
   teamlead duyệt.

6. **Xuất file.**
   Hỏi định dạng (nếu chưa nói): `md` (mặc định) hoặc `md + excel`. Ghi
   `docs/requests/<yyyy-mm-dd>-<slug>/tasks.md` (+ `tasks.xlsx` hoặc `tasks.csv`) theo
   [references/output-formats.md](references/output-formats.md). `plan.md` đã có → chỉ thêm 1 dòng link tới
   `tasks.md`.

## Verification (trước khi báo hoàn thành)

- Đã nạp context; phần suy đoán đánh dấu **[giả định]**; teamlead đã duyệt Checkpoint 1 và Checkpoint 2.
- Mọi AC của use case được phủ bởi ≥ 1 task; không vòng phụ thuộc; không còn task size L.
- Mọi task có đủ header chung + mục theo loại; không mục trống.
- `tasks.md` đặt đúng `docs/requests/<yyyy-mm-dd>-<slug>/`; Excel (nếu chọn) khớp `tasks.md`; nêu rõ nếu đã
  fallback CSV.
- Tiếng Việt còn nguyên dấu.

## Bản đồ tài liệu

Nạp đúng file khi cần, đừng nạp tất cả:

- [references/analysis.md](references/analysis.md): nhận diện input, ngưỡng mơ hồ, bảng Use case, nguồn mâu thuẫn.
- [references/task-template-common.md](references/task-template-common.md): loại task, quy ước ID, header chung,
  template `CT` / `DB` / `E2E`, quy tắc điền.
- [references/task-template-backend.md](references/task-template-backend.md): Backend cần gì — 10 mục B1–B10 +
  template chép được.
- [references/task-template-frontend.md](references/task-template-frontend.md): Frontend cần gì — 9 mục F1–F9 +
  template chép được.
- [references/sizing.md](references/sizing.md): quy ước S/M/L + cách tách task L.
- [references/output-formats.md](references/output-formats.md): cấu trúc `tasks.md`, Excel 3 sheet, CSV UTF-8 có BOM.
- [references/breakdown-checklist.md](references/breakdown-checklist.md): Definition of Done trước Checkpoint 2.
````

- [ ] **Step 4: Tạo `references/analysis.md`**

````markdown
# Phân tích input → bảng Use case

## 1. Nhận diện input

| Dạng input | Đọc gì | Lấy ra |
|---|---|---|
| Yêu cầu thô (chat, email, ticket) | Toàn văn | Actor, mục tiêu, hành động chính → nháp use case |
| Use case (UC spec, user story) | Actor, tiền điều kiện, luồng chính/phụ, hậu điều kiện | Use case gần như 1–1; AC từ hậu điều kiện + luồng phụ |
| ARD (Architecture Requirements Document) | Ràng buộc kiến trúc, NFR, tích hợp, quyết định đã chốt | NFR + ràng buộc gắn vào use case liên quan; quyết định chưa chốt → Câu hỏi mở |
| `requirement.md` (từ `engineering-spec-writing`) | Functional requirements, AC, phạm vi, NFR | **Nguồn chính**; không phân tích lại phần đã chốt |

Nhiều nguồn cùng lúc: thứ tự ưu tiên làm nguồn chính là `requirement.md` > use case > ARD > yêu cầu thô; các nguồn
còn lại bổ sung.

## 2. Ngưỡng mơ hồ — khi nào DỪNG

DỪNG và đề nghị `engineering-spec-writing` khi một trong hai đúng:

- Không trích được **use case nào** có đủ actor + mục tiêu.
- Không có **AC đo được** nào (chỉ có mô tả cảm tính như "nhanh", "thân thiện", "dễ dùng" mà không có ngưỡng).

Thiếu vài chi tiết (validation cụ thể, mã lỗi) KHÔNG phải ngưỡng mơ hồ → tiếp tục, ghi **[giả định]** hoặc Câu hỏi mở.

## 3. Bảng Use case

```markdown
| ID | Tên | Actor | Mục tiêu | AC | NFR | Nguồn |
|---|---|---|---|---|---|---|
| UC01 | Đăng ký tài khoản | Khách | Tạo tài khoản bằng email | AC1.1 Given email chưa dùng When gửi form hợp lệ Then tạo tài khoản và gửi mail xác nhận trong ≤ 1 phút; AC1.2 Given email đã dùng When gửi form Then báo lỗi "Email đã tồn tại" | p95 ≤ 500 ms | requirement.md §3.1 |
```

- ID use case: `UC01`, `UC02`… theo thứ tự xuất hiện trong nguồn chính. `UC00` dành cho nền tảng dùng chung.
- AC đánh số `AC<uc>.<n>` (vd `AC1.2`) để task truy vết được.
- AC viết Given/When/Then hoặc tiêu chí kiểm được có ngưỡng.
- Cột Nguồn trỏ về vị trí cụ thể trong input (file + mục, hoặc đoạn trích ngắn).

## 4. Nguồn mâu thuẫn hoặc thiếu

- Hai nguồn **mâu thuẫn** (vd use case nói "admin duyệt", ARD nói "tự động duyệt") → KHÔNG tự chọn; ghi Câu hỏi
  mở, nêu cả hai phía + task bị ảnh hưởng.
- Thiếu thông tin nhưng có giá trị hợp lý → ghi **[giả định] <giá trị>** ngay tại chỗ + thêm vào Câu hỏi mở để
  teamlead xác nhận.
- Quyết định kiến trúc chưa chốt (chọn message broker, cách xác thực…) → Câu hỏi mở + gợi ý `engineering-adr`.

## 5. Câu hỏi mở

```markdown
| # | Câu hỏi | Ảnh hưởng tới | Trạng thái |
|---|---|---|---|
| Q1 | Duyệt tài khoản thủ công hay tự động? (UC spec §2 vs ARD §4.1) | UC01-BE-01, UC01-FE-01 | Mở |
```

Trình bảng Use case + Câu hỏi mở cho teamlead ở **Checkpoint 1** trước khi tách task.
````

- [ ] **Step 5: Tạo `references/sizing.md`**

````markdown
# Ước lượng size S/M/L

| Size | Quy ước | Xử lý |
|---|---|---|
| S | ≤ 0.5 ngày công | Giữ |
| M | ≤ 2 ngày công | Giữ |
| L | > 2 ngày công | **Buộc tách** thành nhiều task S/M trước Checkpoint 2 |

Size là **gợi ý** cho teamlead, không phải cam kết; teamlead chỉnh ở Checkpoint 2.

## Dấu hiệu task sẽ thành L

- Một task `BE` gồm nhiều command/query.
- Một task `FE-UI` gồm nhiều màn hình, hoặc một màn hình có nhiều tab/bước độc lập.
- AC của task trải trên nhiều use case.
- Một task `DB` có hơn một thay đổi schema độc lập.

## Cách tách task L

| Loại | Tách theo |
|---|---|
| `BE` | Mỗi command/query một task; tách riêng phần tích hợp ngoài (gateway, message) nếu nặng |
| `FE-UI` | Mỗi màn hình một task; màn hình lớn → tách theo vùng (bảng, form, dialog) |
| `FE-INT` | Mỗi nhóm API (đọc / ghi) một task |
| `DB` | Mỗi migration độc lập một task; backfill dữ liệu tách task riêng |
| `CT` | Mỗi resource một task |
| `E2E` | Mỗi luồng đầu-cuối một task |

Sau khi tách: đánh số lại ID liên tục, cập nhật phụ thuộc, và truy vết AC cho từng task con.
````

- [ ] **Step 6: Tạo `references/breakdown-checklist.md`**

````markdown
# Checklist trước Checkpoint 2

Chạy từng mục; mục nào chưa đạt → nêu rõ (fail-loud), không báo hoàn thành.

## Phủ & truy vết

- [ ] Mọi AC của mọi use case được phủ bởi ≥ 1 task (lập bảng AC → task để kiểm).
- [ ] Mọi task có ≥ 1 AC truy vết về `AC<uc>.<n>`.
- [ ] Mọi task có trường Nguồn trỏ về input.

## Cấu trúc

- [ ] ID duy nhất, đúng dạng `UC<nn>-<loại>-<nn>`.
- [ ] Không có vòng phụ thuộc; phụ thuộc chỉ trỏ tới ID có thật.
- [ ] Phụ thuộc theo bảng chuẩn: `BE` ← `CT`/`DB`; `FE-INT` ← `CT`/`FE-UI`; `E2E` ← `BE`/`FE-INT`; `FE-UI` không chờ `BE`.
- [ ] Không còn task size `L`.

## Nội dung

- [ ] Mọi task có đủ header chung (task-template-common §3).
- [ ] Task `BE` có đủ B1–B10; task `FE-UI` / `FE-INT` có đủ F1–F9; task `CT` / `DB` / `E2E` có đủ mục theo loại.
- [ ] Không mục nào bỏ trống: mục không áp dụng ghi `N/A — <lý do>`.
- [ ] Phần suy đoán đánh dấu **[giả định]** và có trong Câu hỏi mở.
- [ ] Đổi schema có task `DB` + gợi ý `workflow-db-change`.
- [ ] Không có quyết định kiến trúc tự chốt (nếu có → Câu hỏi mở + `engineering-adr`).

## Đầu ra

- [ ] `tasks.md` đặt đúng `docs/requests/<yyyy-mm-dd>-<slug>/`.
- [ ] Excel (nếu chọn) có cùng số task với bảng tổng của `tasks.md`; nếu fallback CSV đã báo rõ.
- [ ] Tiếng Việt còn nguyên dấu.
````

- [ ] **Step 7: Chạy test, xác nhận khối 29a xanh**

Run: `node test/validate.mjs`
Expected: mọi assert `engineering-task-breakdown:` của khối 29a PASS (kể cả 7 assert link — chỉ kiểm SKILL.md chứa link). Khối 25 (`engineering-task-breakdown: khung SKILL.md hợp lệ`) và khối 26 (`description hợp lệ`, `không có trigger trùng`, `whenToUse…`) PASS. Kết quả cuối `0 fail`.

Nếu khối 26 báo `whenToUse: đa số dòng thật bị cắt…` hoặc `≤ 200 ký tự`: câu đầu description vượt 200 ký tự → rút ngắn câu đầu, không đổi trigger.

- [ ] **Step 8: Commit qua `core:git-workflow`**

Stage đúng 5 file: SKILL.md, 3 file references, `test/validate.mjs`. Message:

```
feat(engineering): add task-breakdown skill core and analysis references

Changed:
- Thêm skill engineering-task-breakdown: quy trình 0–6, 2 checkpoint teamlead, ranh giới docs-only
  • Tách theo use case dạng lát dọc CT → DB → BE → FE-UI → FE-INT → E2E
- Thêm references analysis, sizing, breakdown-checklist
- Thêm khối assert 29a trong test/validate.mjs cho hợp đồng SKILL.md và 3 references

Reason:
- Teamlead cần phân rã yêu cầu thành task giao được cho dev và agent (spec 2026-10-07)
```

---

### Task 2: Template task — common / backend / frontend

**Files:**
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/task-template-common.md`
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/task-template-backend.md`
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/task-template-frontend.md`
- Modify: `test/validate.mjs` (chèn khối 29b ngay sau khối 29a)

**Interfaces:**
- Consumes: SKILL.md (Task 1) đã link tới 3 file này bằng đúng tên trên.
- Produces: mục `B1.`–`B10.` và `F1.`–`F9.` mà `breakdown-checklist.md` (Task 1) tham chiếu; quy ước anchor id chữ thường (`uc01-be-01`) mà `output-formats.md` (Task 3) dùng.

- [ ] **Step 1: Viết test đỏ (khối 29b)**

Chèn ngay sau dấu `}` đóng khối 29a:

```js
// ─────────────────────────────────────────────────────────────────────────────
// 29b. SOURCE: engineering-task-breakdown — template task common/backend/frontend (spec 2026-10-07 §3)
// ─────────────────────────────────────────────────────────────────────────────
{
  const TB_REF = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown', 'references');
  const tbRef = (f) => { const p = path.join(TB_REF, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; };
  const common = tbRef('task-template-common.md');
  ok(['CT', 'DB', 'BE', 'FE-UI', 'FE-INT', 'E2E'].every((t) => common.includes(`| \`${t}\` |`)),
    'engineering-task-breakdown: template common có bảng đủ 6 loại task');
  ok(['Use case', 'Loại', 'Size', 'Phụ thuộc', 'Owner', 'Trạng thái', 'Skill gợi ý', 'Nguồn'].every((h) => common.includes(`| ${h} |`))
    && ['**Ngữ cảnh:**', '**Acceptance criteria:**', '**File dự kiến:**', '**Lệnh verify:**', '**DoD:**'].every((h) => common.includes(h)),
    'engineering-task-breakdown: template common có đủ header chung');
  ok(common.includes('N/A — <lý do>') && common.includes('[giả định]'),
    'engineering-task-breakdown: template common có quy tắc N/A và [giả định]');
  ok(common.includes('Chỉ sinh loại cần') && common.includes('không sinh `CT`, `BE`, `FE-INT`')
    && common.includes('không sinh `FE-UI`, `FE-INT`, `E2E`'),
    'engineering-task-breakdown: use case không có API / chỉ backend thì không sinh loại task thừa');
  ok(['### CT', '### DB', '### E2E'].every((h) => common.includes(h)), 'engineering-task-breakdown: có template CT/DB/E2E');
  const be = tbRef('task-template-backend.md');
  ok(Array.from({ length: 10 }, (_, i) => `### B${i + 1}. `).every((h) => be.includes(h))
    && Array.from({ length: 10 }, (_, i) => `**B${i + 1}. `).every((h) => be.includes(h)),
    'engineering-task-breakdown: template backend có đủ B1–B10 (hướng dẫn + template chép được)');
  const fe = tbRef('task-template-frontend.md');
  ok(Array.from({ length: 9 }, (_, i) => `### F${i + 1}. `).every((h) => fe.includes(h))
    && Array.from({ length: 9 }, (_, i) => `**F${i + 1}. `).every((h) => fe.includes(h)),
    'engineering-task-breakdown: template frontend có đủ F1–F9 (hướng dẫn + template chép được)');
  ok(fe.includes('đồng bộ với B4') && fe.includes('msw'), 'engineering-task-breakdown: FE đồng bộ validation với BE, mock API bằng msw');
  ok(![common, be, fe].some((t) => /\bTODO\b|\bTBD\b/.test(t)), 'engineering-task-breakdown: template không còn TODO/TBD');
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL đúng 8 assert đầu của khối 29b (`bảng đủ 6 loại`, `header chung`, `N/A`, `không sinh loại task thừa`, `CT/DB/E2E`, `B1–B10`, `F1–F9`, `msw`); assert `không còn TODO/TBD` PASS (file rỗng).

- [ ] **Step 3: Tạo `references/task-template-common.md`**

`````markdown
# Template chung — loại task, ID, header

## 1. Loại task

| Loại | Khi nào sinh | Skill / agent gợi ý |
|---|---|---|
| `CT` | Use case có API mới hoặc đổi API | `backend-api-contract` |
| `DB` | Đổi bảng / cột / index | `data-db-migration` (luồng `workflow-db-change`) |
| `BE` | Mỗi command/query | `backend-implement` → agent `backend-implementer` |
| `FE-UI` | Mỗi màn hình / component | `frontend-implement` → agent `frontend-implementer` |
| `FE-INT` | Nối UI với API | `frontend-data-integration` |
| `E2E` | AC là luồng UI đầu-cuối, không chứng minh được ở unit/integration | `frontend-e2e-testing` |

Chỉ sinh loại cần: use case không có API (UI tĩnh, tính toán phía client) → không sinh `CT`, `BE`, `FE-INT`; use
case chỉ có backend (job, API nội bộ) → không sinh `FE-UI`, `FE-INT`, `E2E`.

Unit/integration test nằm trong DoD của task `BE` / `FE-UI` / `FE-INT`, không tách task test riêng.

## 2. Quy ước ID

`UC<nn>-<loại>-<nn>`:

- `UC01-CT-01`, `UC01-DB-01`, `UC01-BE-01`, `UC01-BE-02`, `UC01-FE-01` (FE-UI), `UC01-FE-02` (FE-INT), `UC01-E2E-01`.
- `FE-UI` và `FE-INT` dùng chung tiền tố `FE`, đánh số liên tục trong use case; trường Loại phân biệt hai loại.
- `UC00-…` cho nền tảng dùng chung, chỉ khi ≥ 2 use case cần.
- Anchor của task trong `tasks.md` là ID viết chữ thường (`uc01-be-01`), đặt bằng `<a id="uc01-be-01"></a>` ngay
  trên heading để link ổn định trên mọi renderer markdown.

## 3. Header chung (mọi task)

````markdown
<a id="uc01-be-01"></a>
### UC01-BE-01 — <tiêu đề ngắn, bắt đầu bằng động từ>

| Trường | Giá trị |
|---|---|
| Use case | UC01 — <tên> |
| Loại | BE |
| Size | S |
| Phụ thuộc | UC01-CT-01, UC01-DB-01 |
| Owner |  |
| Trạng thái | Todo |
| Skill gợi ý | backend-implement |
| Nguồn | requirement.md §3.1 |

**Ngữ cảnh:** <2–3 dòng: vì sao có task này, nằm ở đâu trong luồng use case>

**Acceptance criteria:**
- [ ] AC1.1 — <tiêu chí đo được, trích hoặc thu hẹp từ AC của use case>

**File dự kiến:** <đường dẫn theo architecture.md / source-structure.md, hoặc [giả định]>

**Lệnh verify:** <lệnh build/test thật của project, hoặc [giả định]>

**DoD:**
- [ ] Đạt mọi AC ở trên
- [ ] Test bắt buộc của loại task đã viết và xanh
- [ ] Build/lint xanh
- [ ] Con người duyệt diff

<mục riêng theo loại: B1–B10 cho BE, F1–F9 cho FE-UI/FE-INT, hoặc mục CT/DB/E2E ở §4>
````

Owner luôn để trống — teamlead điền. Trạng thái khởi tạo `Todo`.

## 4. Template theo loại

### CT — Contract

- **Endpoint cần chốt:** method + path + `operationId`.
- **Request/response schema:** field, kiểu, bắt buộc/tuỳ chọn.
- **Mã lỗi:** case → mã lỗi → HTTP status.
- **Versioning / tương thích ngược:** thay đổi có breaking không; nếu có, lộ trình deprecate.
- **Test bắt buộc:** contract hợp lệ OpenAPI 3.1; kiểm drift theo `backend-api-contract`.

### DB — Schema

- **Thay đổi:** bảng / cột / index / constraint.
- **Backfill dữ liệu:** có / không; khối lượng ước tính.
- **Rollback:** cách quay lui; thay đổi nào không đảo ngược được.
- **Luồng:** chạy qua `workflow-db-change` (skill `data-db-migration`).
- **Test bắt buộc:** migration chạy lên/xuống trên DB cục bộ.

### E2E — Luồng đầu-cuối

- **Luồng:** các bước người dùng từ đầu tới cuối.
- **AC phủ:** danh sách `AC<uc>.<n>`.
- **Dữ liệu seed:** dữ liệu cần có trước khi chạy.
- **Lý do cần e2e:** vì sao không chứng minh được ở unit/integration.
- **Test bắt buộc:** chạy ổn định khi lặp lại (theo `frontend-e2e-testing`).

## 5. Quy tắc điền

- Mục không áp dụng → ghi `N/A — <lý do>` (vd `N/A — query chỉ đọc, không có transaction ghi`). KHÔNG bỏ trống:
  mục trống bị hiểu là quên.
- Thiếu thông tin → ghi **[giả định] <giá trị>** tại chỗ và thêm vào Câu hỏi mở; KHÔNG bịa.
- Mỗi task phải đọc được độc lập: không viết "như task trên"; lặp lại thông tin cần thiết.
`````

- [ ] **Step 4: Tạo `references/task-template-backend.md`**

`````markdown
# Backend cần gì — template task BE

Task `BE` = một command hoặc một query của một use case (một vertical slice theo `backend-implement`). Điền header
chung (task-template-common §3) + 10 mục dưới. Mục không áp dụng → `N/A — <lý do>`.

## Template chép được

````markdown
#### Backend

- **B1. Endpoint:** <METHOD> <path> — operationId `<id>` (contract: docs/contracts/<file>)
- **B2. Use case:** <command | query> — <tên use case trong code>
- **B3. Aggregate + invariant:** <aggregate root>; invariant: <quy tắc luôn đúng>
- **B4. Validation:**

  | Field | Rule | Thông báo lỗi |
  |---|---|---|
  | <field> | <rule> | <thông báo> |

- **B5. Phân quyền:** <role/scope được gọi>; chưa đăng nhập → 401; không đủ quyền → 403
- **B6. Dữ liệu chạm:** đọc <bảng>; ghi <bảng>; đổi schema → <UC..-DB-..> hoặc `N/A — không đổi schema`
- **B7. Bảng lỗi:**

  | Case | Mã lỗi | HTTP |
  |---|---|---|
  | <case> | <mã> | <status> |

- **B8. Transaction / idempotency / concurrency:** <ranh giới transaction; idempotency; khoá đồng thời>
- **B9. NFR:** hiệu năng <ngưỡng>; audit/log <sự kiện>; dữ liệu nhạy cảm <cách xử lý>
- **B10. Test bắt buộc:** unit lõi (mock/fake port) cho <case>; integration adapter cho <case>
````

## Hướng dẫn từng mục

### B1. Endpoint

Method + path + `operationId` khớp contract ở `docs/contracts/`. Chưa có contract → task phụ thuộc task `CT` của
use case. Use case không qua HTTP (job, consumer) → ghi trigger thay endpoint (vd `consumer topic order.created`).

### B2. Use case

Command (đổi trạng thái) hay query (chỉ đọc). Một task = một command hoặc một query; nhiều hơn → tách theo sizing.md.

### B3. Aggregate + invariant

Aggregate root bị đổi/đọc và các quy tắc nghiệp vụ phải luôn đúng (vd "tổng tiền đơn = tổng dòng − giảm giá",
"không huỷ đơn đã giao"). Lấy từ `data-model.md` và AC; không có → **[giả định]**.

### B4. Validation

Rule cho từng field đầu vào: bắt buộc, kiểu, độ dài, định dạng, miền giá trị. Đây là nguồn để FE đồng bộ ở F5.

### B5. Phân quyền

Role/scope được gọi; người chưa đăng nhập nhận 401, không đủ quyền nhận 403. Ràng buộc theo dữ liệu (vd chỉ chủ sở
hữu được sửa) ghi rõ.

### B6. Dữ liệu chạm

Bảng đọc / ghi. Đổi schema → tham chiếu task `DB`; không đổi schema trong task `BE`.

### B7. Bảng lỗi

Mỗi case lỗi nghiệp vụ/kỹ thuật → mã lỗi ứng dụng → HTTP status. Khớp contract; FE dùng bảng này ở F6.

### B8. Transaction / idempotency / concurrency

Ranh giới transaction (một transaction một aggregate); request lặp lại có an toàn không (idempotency key); tranh
chấp đồng thời (optimistic lock / version). Query chỉ đọc → `N/A — query chỉ đọc`.

### B9. NFR

Hiệu năng (vd p95 ≤ 300 ms ở 50 rps), audit/log (sự kiện cần ghi; không log dữ liệu nhạy cảm), dữ liệu nhạy cảm
(mask, mã hoá). Lấy từ NFR của use case hoặc ARD.

### B10. Test bắt buộc

Unit lõi với mock/fake port cho invariant + validation + phân quyền; integration adapter cho persistence/gateway.
Liệt kê case cụ thể gắn AC (vd "AC1.2 → test email trùng trả 409").
`````

- [ ] **Step 5: Tạo `references/task-template-frontend.md`**

`````markdown
# Frontend cần gì — template task FE-UI / FE-INT

Task `FE-UI` dựng màn hình/component từ thiết kế (presentational, theo `frontend-implement`); task `FE-INT` nối UI
đó với API thật theo contract (theo `frontend-data-integration`). Hai loại dùng chung 9 mục; mục ngoài phạm vi loại
task → `N/A — <lý do>` (vd F6 trong `FE-UI`: `N/A — nối API ở UC01-FE-02`).

## Template chép được

````markdown
#### Frontend

- **F1. Route / màn hình:** <path route> — <tên màn hình>
- **F2. Nguồn thiết kế:** <link Figma frame | file HTML | ảnh>
- **F3. Component:** tái dùng <component từ design-system / component lib>; mới <component>
- **F4. Trạng thái:** loading <...>; empty <...>; error <...>; success <...>
- **F5. Form & validation:**

  | Field | Rule (đồng bộ B4) | Thông báo lỗi |
  |---|---|---|
  | <field> | <rule> | <thông báo> |

- **F6. API dùng:** operationId `<id>`; 401 → <xử lý>; 403 → <xử lý>; 4xx → <xử lý>; 5xx → <xử lý>
- **F7. Phân quyền hiển thị:** <role nào thấy / ẩn / disable phần nào>
- **F8. i18n / a11y / responsive:** i18n <key>; a11y <label, role, bàn phím, focus>; breakpoint <...>
- **F9. Test bắt buộc:** render + interaction cho <case>; mock API bằng msw cho <case>
````

## Hướng dẫn từng mục

### F1. Route / màn hình

Path route + tên màn hình; component con thì ghi màn hình cha chứa nó.

### F2. Nguồn thiết kế

Link Figma (frame cụ thể), file HTML, hoặc ảnh. Không có thiết kế → **[giả định]** dựng theo `design-system.md` +
Câu hỏi mở.

### F3. Component

Ưu tiên tái dùng từ design-system / component lib của project (đọc `component-map.md` nếu có); chỉ liệt kê
component mới khi lib không có.

### F4. Trạng thái

Đủ 4 trạng thái loading / empty / error / success: hiển thị gì, thông điệp gì. Trạng thái không xảy ra →
`N/A — <lý do>`.

### F5. Form & validation

Field + rule + thông báo lỗi, **đồng bộ với B4** của task `BE` tương ứng (cùng rule, cùng ngưỡng). Màn hình không
có form → `N/A — không có form`.

### F6. API dùng

`operationId` trong contract; map lỗi: 401 → về đăng nhập; 403 → thông báo không đủ quyền; 4xx → thông báo theo
bảng B7; 5xx → thông báo chung + cho thử lại. Trong `FE-UI` thường là `N/A — nối API ở <ID task FE-INT>`.

### F7. Phân quyền hiển thị

Role nào thấy / ẩn / disable phần nào. Đây là UX — kiểm quyền thật nằm ở B5.

### F8. i18n / a11y / responsive

Chuỗi cần dịch (key i18n nếu project có); a11y: label, role, điều hướng bàn phím, focus; breakpoint hỗ trợ theo
`design-system.md`.

### F9. Test bắt buộc

Render + interaction bằng Testing Library cho các trạng thái F4 và form F5; `FE-INT` mock API bằng msw cho thành
công + từng nhóm lỗi F6. Gắn từng case với AC.
`````

- [ ] **Step 6: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `KẾT QUẢ: … pass, 0 fail`. Riêng khối 4 (tên file references không trùng trong plugin `engineering`) vẫn PASS.

- [ ] **Step 7: Commit qua `core:git-workflow`**

Stage đúng 4 file: 3 template + `test/validate.mjs`. Message:

```
feat(engineering): add backend and frontend task templates

Changed:
- Thêm template chung: 6 loại task, quy ước ID và anchor, header chung, mục CT/DB/E2E, quy tắc N/A và [giả định]
- Thêm template Backend cần gì (B1–B10) và Frontend cần gì (F1–F9), mỗi bản có khối chép được + hướng dẫn từng mục
  • FE F5 đồng bộ validation với BE B4; F6 map lỗi theo bảng B7
- Thêm khối assert 29b trong test/validate.mjs

Reason:
- Template cố định giúp dev và agent nhận task không cần hỏi lại; N/A có lý do phân biệt "không cần" với "quên"
```

---

### Task 3: Định dạng đầu ra — tasks.md / Excel / CSV

**Files:**
- Create: `plugins/engineering/skills/engineering-task-breakdown/references/output-formats.md`
- Modify: `test/validate.mjs` (chèn khối 29c ngay sau khối 29b)

**Interfaces:**
- Consumes: anchor `<a id="uc01-be-01"></a>` từ task-template-common §2 (Task 2); tên sheet/cột theo spec §5.4.
- Produces: không có (file cuối của skill).

- [ ] **Step 1: Viết test đỏ (khối 29c)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 29c. SOURCE: engineering-task-breakdown — định dạng đầu ra (spec 2026-10-07 §5)
// ─────────────────────────────────────────────────────────────────────────────
{
  const p = path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-task-breakdown', 'references', 'output-formats.md');
  const out = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  ok(out.includes('nguồn sự thật') && out.includes('docs/requests/<yyyy-mm-dd>-<slug>/'),
    'engineering-task-breakdown: tasks.md là nguồn sự thật, đặt trong docs/requests/<ngày>-<slug>/');
  ok(['`Tasks`', '`UseCases`', '`OpenQuestions`'].every((s) => out.includes(s)), 'engineering-task-breakdown: Excel có 3 sheet');
  ok(out.includes('UTF-8 có BOM') && out.includes('utf-8-sig') && out.includes('QUOTE_ALL'),
    'engineering-task-breakdown: CSV UTF-8 có BOM, quote mọi ô');
  ok(out.includes('openpyxl') && out.includes('fallback'), 'engineering-task-breakdown: xlsx khi có openpyxl, không có thì fallback CSV');
  ok(out.includes('tasks.md#uc01-be-01') && out.includes('<a id="uc01-ct-01"></a>'),
    'engineering-task-breakdown: link chi tiết Excel trỏ anchor ổn định trong tasks.md');
  ok(out.includes('đã tồn tại') && out.includes('Owner'), 'engineering-task-breakdown: tasks.md đã tồn tại → hỏi, giữ Owner/Trạng thái');
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL đúng 6 assert của khối 29c.

- [ ] **Step 3: Tạo `references/output-formats.md`**

`````markdown
# Định dạng đầu ra

## 1. Chọn định dạng

Hỏi một lần ở bước 6 (bỏ qua nếu người dùng đã nói từ đầu):

| Lựa chọn | Sinh ra |
|---|---|
| `md` (mặc định) | `tasks.md` |
| `md + excel` | `tasks.md` + `tasks.xlsx` (môi trường hỗ trợ) hoặc `tasks.csv` (fallback) |

`tasks.md` **luôn sinh** và là **nguồn sự thật**. Excel là bản xuất: sửa task thì sửa `tasks.md` rồi xuất lại;
không sửa ngược từ Excel.

## 2. Vị trí

```
docs/requests/<yyyy-mm-dd>-<slug>/
├── requirement.md   # có sẵn nếu đã chạy engineering-spec-writing — KHÔNG ghi đè
├── plan.md          # có sẵn → chỉ thêm 1 dòng link tới tasks.md
├── tasks.md         # nguồn sự thật
└── tasks.xlsx       # hoặc tasks.csv — chỉ khi chọn excel
```

- Đã có thư mục cho yêu cầu này → ghi vào đó; chưa có → tạo theo ngày hôm nay + slug tiếng Anh kebab-case.
- `tasks.md` **đã tồn tại** → KHÔNG ghi đè im lặng. Hỏi người dùng: (a) cập nhật — giữ nguyên Owner/Trạng thái đã
  điền của các task trùng ID, thêm task mới, đánh dấu task bị bỏ; hoặc (b) ghi đè toàn bộ.
- Dòng link thêm vào `plan.md`: `Chi tiết task: [tasks.md](tasks.md)`.

## 3. Cấu trúc `tasks.md`

````markdown
# Tasks: <tên yêu cầu>

## 1. Tóm tắt

- Nguồn input: <file / mô tả>
- Use case: <n> · Task: <n> (CT <n> · DB <n> · BE <n> · FE-UI <n> · FE-INT <n> · E2E <n>)
- Size: S <n> · M <n>

## 2. Use case

| ID | Tên | Actor | AC | Nguồn |
|---|---|---|---|---|

## 3. Bảng tổng task

| ID | UC | Loại | Tiêu đề | Size | Phụ thuộc | Owner | Trạng thái | Skill gợi ý |
|---|---|---|---|---|---|---|---|---|
| [UC01-CT-01](#uc01-ct-01) | UC01 | CT | Chốt contract đăng ký | S | — |  | Todo | backend-api-contract |

## 4. Thứ tự thực hiện gợi ý

1. UC01-CT-01, UC01-DB-01
2. Song song: UC01-BE-01 ∥ UC01-FE-01
3. UC01-FE-02
4. UC01-E2E-01

## 5. Chi tiết task

<a id="uc01-ct-01"></a>
### UC01-CT-01 — Chốt contract đăng ký

<header chung + mục theo loại — task-template-common / task-template-backend / task-template-frontend>

## 6. Câu hỏi mở & giả định

| # | Câu hỏi | Ảnh hưởng tới | Trạng thái |
|---|---|---|---|
````

Mỗi task có `<a id="<id chữ thường>"></a>` ngay trên heading; bảng tổng và Excel link tới anchor này, không phụ
thuộc cách renderer sinh anchor từ heading tiếng Việt.

## 4. Excel

### Sheet và cột

| Sheet | Cột |
|---|---|
| `Tasks` | ID · UC · Loại · Tiêu đề · Size · Phụ thuộc · Owner · Trạng thái · Skill gợi ý · AC · Link chi tiết |
| `UseCases` | ID · Tên · Actor · AC · Nguồn |
| `OpenQuestions` | # · Câu hỏi · Ảnh hưởng tới · Trạng thái |

- Cột AC: nhiều AC trong một ô, mỗi AC một dòng.
- Link chi tiết: `tasks.md#<id chữ thường>` (vd `tasks.md#uc01-be-01`). Excel không chứa chi tiết đầy đủ để tránh hai
  nguồn lệch nhau.
- Số dòng sheet `Tasks` phải bằng số task trong bảng tổng của `tasks.md`.

### Chọn `.xlsx` hay CSV

1. Môi trường có công cụ tạo xlsx (skill xlsx của provider, hoặc Python có `openpyxl`) → sinh `tasks.xlsx` 3 sheet.
   Kiểm `openpyxl`: `python -c "import openpyxl"` (exit 0 = có).
2. Không có → sinh `tasks.csv` (chỉ sheet `Tasks`) và **báo rõ** đã fallback CSV vì môi trường không có công cụ tạo
   xlsx. Không tự cài package vào môi trường người dùng khi chưa hỏi.

### Quy tắc CSV

- Mã hoá **UTF-8 có BOM** (Python: `encoding="utf-8-sig"`) để Excel trên Windows hiển thị đúng dấu tiếng Việt.
- Quote **mọi ô** (`csv.QUOTE_ALL`): ô chứa dấu phẩy, ngoặc kép hoặc xuống dòng (AC nhiều dòng) vẫn đúng cột;
  ngoặc kép trong nội dung được nhân đôi `""` (module `csv` tự làm).
- Dấu phân cách `,`.

### Mẫu sinh file (Python, chạy tạm — không thêm vào mã nguồn project)

```python
import csv

TASK_COLS = ["ID", "UC", "Loại", "Tiêu đề", "Size", "Phụ thuộc", "Owner",
             "Trạng thái", "Skill gợi ý", "AC", "Link chi tiết"]


def write_tasks_csv(path, tasks):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=TASK_COLS, quoting=csv.QUOTE_ALL)
        w.writeheader()
        w.writerows(tasks)


def write_tasks_xlsx(path, tasks, use_cases, questions):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font

    wb = Workbook()
    sheets = [
        ("Tasks", TASK_COLS, tasks),
        ("UseCases", ["ID", "Tên", "Actor", "AC", "Nguồn"], use_cases),
        ("OpenQuestions", ["#", "Câu hỏi", "Ảnh hưởng tới", "Trạng thái"], questions),
    ]
    for i, (name, cols, rows) in enumerate(sheets):
        ws = wb.active if i == 0 else wb.create_sheet()
        ws.title = name
        ws.append(cols)
        for c in ws[1]:
            c.font = Font(bold=True)
        for r in rows:
            ws.append([r.get(k, "") for k in cols])
        for row in ws.iter_rows(min_row=2):
            for c in row:
                c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes = "A2"
    wb.save(path)
```

`tasks`, `use_cases`, `questions` là `list[dict]` với key đúng tên cột; AC là chuỗi nhiều dòng (`"\n"`).
`````

- [ ] **Step 4: Chạy test, xác nhận xanh**

Run: `node test/validate.mjs`
Expected: `0 fail`.

- [ ] **Step 5: Kiểm mẫu Python chạy được (nhánh CSV)**

Chép khối Python ở Step 3 vào file tạm trong scratchpad (không phải trong repo), thêm 3 dòng gọi:

```python
write_tasks_csv("tasks.csv", [{"ID": "UC01-BE-01", "UC": "UC01", "Loại": "BE", "Tiêu đề": "Tạo tài khoản, gửi \"mail\"",
    "Size": "M", "Phụ thuộc": "UC01-CT-01", "Owner": "", "Trạng thái": "Todo", "Skill gợi ý": "backend-implement",
    "AC": "AC1.1 Given…\nAC1.2 Given…", "Link chi tiết": "tasks.md#uc01-be-01"}])
print(open("tasks.csv", "rb").read(3) == b"\xef\xbb\xbf")
```

Run: `python <file>` trong scratchpad.
Expected: in `True`; mở `tasks.csv` thấy 2 bản ghi logic (header + 1 task), ô Tiêu đề chứa `""mail""`, ô AC nằm trong ngoặc kép có xuống dòng. Nếu không có `python`: ghi rõ "chưa chạy được mẫu Python" trong báo cáo task, không bỏ qua im lặng. Nếu có `openpyxl` (`python -c "import openpyxl"` exit 0) thì gọi thêm `write_tasks_xlsx("tasks.xlsx", <tasks trên>, [], [])` và xác nhận file tạo ra; không có thì báo rõ chỉ kiểm nhánh CSV. Xoá file tạm sau khi kiểm.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage đúng 2 file: `output-formats.md` + `test/validate.mjs`. Message:

```
feat(engineering): define task-breakdown output formats

Changed:
- Thêm output-formats: tasks.md là nguồn sự thật, cấu trúc 6 mục với anchor ổn định cho từng task
- Excel 3 sheet Tasks/UseCases/OpenQuestions; xlsx khi có openpyxl, không có thì fallback CSV UTF-8 có BOM, quote mọi ô
  • Kèm mẫu Python chạy tạm để sinh CSV/xlsx
- tasks.md đã tồn tại thì hỏi cập nhật hay ghi đè, giữ Owner/Trạng thái
- Thêm khối assert 29c trong test/validate.mjs

Reason:
- Teamlead cần chọn md hoặc Excel; CSV không BOM bị Excel trên Windows hiển thị sai dấu tiếng Việt
```

---

### Task 4: Tích hợp — manifest, cowork, README, CLAUDE.md, spec-writing

**Files:**
- Modify: `plugins/engineering/.manifest.json`
- Modify: `plugins/_cowork.json`
- Modify: `README.md:131` (dòng plugin engineering) và dòng `| G9 |` trong mục Roadmap (~:237)
- Modify: `README_VI.md:126` và dòng `| G9 |` (~:237)
- Modify: `CLAUDE.md` (cụm `` `engineering` (6 skills) ``)
- Modify: `plugins/engineering/skills/engineering-spec-writing/SKILL.md:30`
- Modify: `test/validate.mjs` (chèn khối 29d ngay sau khối 29c)

**Interfaces:**
- Consumes: skill hoàn chỉnh từ Task 1–3.
- Produces: không có.

- [ ] **Step 1: Viết test đỏ (khối 29d)**

```js
// ─────────────────────────────────────────────────────────────────────────────
// 29d. SOURCE: engineering-task-breakdown — tích hợp manifest/cowork/README/spec-writing (spec 2026-10-07 §6.2)
// ─────────────────────────────────────────────────────────────────────────────
{
  const read29 = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
  const mf = JSON.parse(read29('plugins/engineering/.manifest.json'));
  ok(mf.description.includes('7 skill') && mf.description.includes('engineering-task-breakdown') && mf.version === '1.3.0',
    'engineering manifest: 7 skill, có engineering-task-breakdown, version 1.3.0');
  ok(JSON.parse(read29('plugins/_cowork.json')).skills.includes('engineering:engineering-task-breakdown'),
    '_cowork.json: có engineering:engineering-task-breakdown');
  for (const f of ['README.md', 'README_VI.md']) {
    const t = read29(f);
    ok(/^\| `engineering` \|.*engineering-task-breakdown/m.test(t), `${f}: dòng plugin engineering nêu engineering-task-breakdown`);
    ok(!/^\| G9 \|/m.test(t), `${f}: Roadmap không còn gap G9 (đã lấp)`);
  }
  ok(read29('plugins/engineering/skills/engineering-spec-writing/SKILL.md').includes('→ `engineering-task-breakdown`'),
    'engineering-spec-writing: trỏ phần phân rã task sang engineering-task-breakdown');
}

```

- [ ] **Step 2: Chạy test, xác nhận đỏ**

Run: `node test/validate.mjs`
Expected: FAIL đúng 7 assert của khối 29d (manifest, cowork, 2×2 README, spec-writing).

- [ ] **Step 3: Sửa `plugins/engineering/.manifest.json`**

- `"version": "1.2.1"` → `"version": "1.3.0"`.
- Trong `description`: thay `6 skill:` bằng `7 skill:`; chèn ngay sau cụm `engineering-spec-writing (khảo sát yêu cầu + viết feature spec đo được), ` đoạn:
  `engineering-task-breakdown (phân rã yêu cầu/use case/ARD thành task BE/FE giao được cho dev và agent, xuất tasks.md + Excel tuỳ chọn), `

- [ ] **Step 4: Sửa `plugins/_cowork.json`**

Thêm dòng ngay sau `"engineering:engineering-convention-enforce",`:

```json
    "engineering:engineering-task-breakdown",
```

- [ ] **Step 5: Sửa README**

`README.md` — dòng 131 thay bằng:

```markdown
| `engineering` | Cross-cutting engineering capabilities (quality gate, spec, task breakdown, diagram, ADR, release notes, convention). | `engineering-quality-gate`, `engineering-spec-writing`, `engineering-task-breakdown`, `engineering-adr` |
```

và xoá nguyên dòng `| G9 | \`engineering-task-breakdown\` | engineering | WF01 |` trong mục Roadmap.

`README_VI.md` — dòng 126 thay bằng:

```markdown
| `engineering` | Capability kỹ thuật xuyên suốt (quality gate, spec, phân rã task, diagram, ADR, release notes, convention). | `engineering-quality-gate`, `engineering-spec-writing`, `engineering-task-breakdown`, `engineering-adr` |
```

và xoá nguyên dòng `| G9 | …engineering-task-breakdown… |` trong mục Roadmap.

- [ ] **Step 6: Sửa `CLAUDE.md`**

Thay đúng cụm `` `engineering` (6 skills) `` bằng `` `engineering` (7 skills) ``; giữ nguyên phần còn lại của câu.

- [ ] **Step 7: Sửa `engineering-spec-writing/SKILL.md:30`**

Thay dòng:

```markdown
KHÔNG dùng skill này để phân rã story/task chi tiết, sinh code, hay dựng lại artifact FIS (xem mục Ghi chú).
```

bằng:

```markdown
KHÔNG dùng skill này để phân rã story/task chi tiết (→ `engineering-task-breakdown`), sinh code, hay dựng lại artifact FIS (xem mục Ghi chú).
```

- [ ] **Step 8: Chạy toàn bộ verification**

Run lần lượt:

```bash
npm run build
npm test
npm run overlap
npm run pack:verify
```

Expected:
- `npm run build`: exit 0; tồn tại `build/claude/**/engineering-task-breakdown/SKILL.md` và `references/` đủ 7 file ở mọi provider (khối 4 của validate kiểm parity).
- `npm test`: mọi file test pass, `0 fail`.
- `npm run overlap`: advisory — ghi lại các cặp có `engineering-task-breakdown` nếu tỉ lệ trùng dòng > 0.3; không phải gate.
- `npm run pack:verify`: pass (plugin engineering không ship npm; không đổi `pack.config.json`).

Nếu validate báo thiếu `SKILL.md` ở build: chạy lại `npm run build` rồi `npm test` (theo CLAUDE.md).

- [ ] **Step 9: Commit qua `core:git-workflow`**

Stage đúng 7 file: manifest, `_cowork.json`, `README.md`, `README_VI.md`, `CLAUDE.md`, `engineering-spec-writing/SKILL.md`, `test/validate.mjs`. Message:

```
feat(engineering): wire task-breakdown skill into manifest, cowork and docs

Changed:
- Manifest engineering lên 7 skill, version 1.3.0; thêm engineering:engineering-task-breakdown vào _cowork.json
- README và README_VI nêu skill ở dòng plugin engineering, xoá gap G9 khỏi Roadmap
- CLAUDE.md cập nhật engineering (7 skills)
- engineering-spec-writing trỏ phần phân rã task sang engineering-task-breakdown
- Thêm khối assert 29d trong test/validate.mjs

Reason:
- Skill mới cần được offer, đóng gói Cowork và nối tiếp spec-writing để teamlead đi từ spec sang task
```

---

### Task 5: Pilot thật trên yêu cầu mẫu (không commit)

**Files:** không sửa file trong repo. Làm trong thư mục tạm (scratchpad), dọn bằng Node `fs.rmSync` (không `rm -rf` sandbox có junction — xem CLAUDE.md).

**Interfaces:**
- Consumes: skill đã build ở Task 4.
- Produces: báo cáo pilot (pass/fail theo checklist) gửi cho controller.

- [ ] **Step 1: Tạo sandbox + input mẫu**

Trong scratchpad tạo thư mục `pilot/` với `docs/requests/2026-10-07-user-signup/requirement.md`:

```markdown
# Requirement: Đăng ký tài khoản
## Yêu cầu gốc
Khách đăng ký bằng email + mật khẩu; email đã dùng thì báo lỗi; sau khi đăng ký gửi mail xác nhận.
Admin xem danh sách tài khoản mới trong ngày.
## Ràng buộc
API REST, p95 ≤ 500 ms. Mật khẩu tối thiểu 8 ký tự.
## Tiêu chí chấp nhận
- [ ] Given email chưa dùng When gửi form hợp lệ Then tạo tài khoản và gửi mail xác nhận trong ≤ 1 phút
- [ ] Given email đã dùng When gửi form Then báo lỗi "Email đã tồn tại"
- [ ] Given admin đăng nhập When mở trang tài khoản mới Then thấy danh sách tài khoản tạo trong ngày
```

- [ ] **Step 2: Chạy skill như agent**

Đọc `plugins/engineering/skills/engineering-task-breakdown/SKILL.md` + references, thực hiện bước 0–6 trên sandbox, với các quyết định checkpoint do chính agent pilot đóng vai teamlead (ghi rõ trong báo cáo là tự duyệt cho pilot). Chọn định dạng `md + excel`.

- [ ] **Step 3: Kiểm đầu ra theo `breakdown-checklist.md`**

Expected:
- `tasks.md` có 2 use case (đăng ký; admin xem danh sách), mọi AC được phủ, có `UC01-CT-01`, `UC01-BE-01`, `UC01-FE-01`, `UC01-FE-02`; không task L; không mục trống; phần thiếu (vd thiếu thiết kế UI → F2) có `[giả định]` + Câu hỏi mở; có Câu hỏi mở về việc thiếu `project-knowledge/`.
- `tasks.csv` (hoặc `tasks.xlsx` nếu có openpyxl): 3 byte đầu `EF BB BF` với CSV; số dòng task = số task trong bảng tổng.

- [ ] **Step 4: Báo cáo + dọn sandbox**

Báo cáo: từng mục checklist pass/fail + đoạn trích chứng minh; điểm nào skill hướng dẫn thiếu/mơ hồ khiến agent phải đoán. Nếu có điểm cần sửa nội dung skill → controller tạo task sửa riêng (commit `fix(engineering): …`) — không sửa trong Task 5. Dọn: `node -e "require('fs').rmSync('<pilot dir>', {recursive:true, force:true})"`.
