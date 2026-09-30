# backend-code-review trục performance (S4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trục **Performance** (N+1, thiếu index, query trong vòng lặp, tải eager thừa) vào skill `backend-code-review`, đồng bộ mẫu output và agent `backend-reviewer`, kèm assert trong `test/validate.mjs` (khối "14."). Sửa lỗi D12 của spec.

**Architecture:** Docs-only. Trục mới là mục "Trục 6 — Performance" trong `references/review-dimensions.md`; `SKILL.md` thêm một bullet ở bước 1 và một cụm trong `description`; `references/review-output-template.md` thêm `performance` vào danh sách trục hợp lệ và một dòng ví dụ; agent `backend-reviewer` nêu rủi ro hiệu năng ở phần Vai trò. Enum `category: performance` đã có sẵn trong `core/principles/workflow-output-contract.md` nên không đổi core. Finding hiệu năng từ đọc diff mặc định `suspected` vì contract đầu ra cấm kết luận hiệu năng khi không có số đo trước/sau.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §3.2 (lỗi D12), §3.3 (S4), §8.1 (hàng `backend-reviewer`: "trục performance (S4)"), §9 (pha P1).

## Quyết định của plan (spec không nêu — người duyệt có thể đổi)

| # | Quyết định | Lý do |
|---|---|---|
| D-1 | Finding hiệu năng từ đọc diff: nhãn `suspected`, `confidence` tối đa `medium`, không nêu con số trong `impact`, severity tối đa `major` khi chưa có số đo hay kế hoạch thực thi | `core/principles/workflow-output-contract.md`: "Không kết luận về hiệu năng nếu không có số đo trước/sau trên cùng điều kiện"; skill đã có gate R3 (không thổi suspected thành blocker) |
| D-2 | Cách đo chỉ được ĐỀ XUẤT (log SQL/đếm truy vấn, `EXPLAIN` trên môi trường local/test, profiler); không tự chạy trên môi trường thật; cần tối ưu có số đo → `workflow-performance` | Skill là READ-ONLY; `workflow-performance` đã có ở repo |
| D-3 | Thêm luôn `performance` vào template output và một câu ở agent `backend-reviewer` | Spec §8.1 ghi thay đổi agent này là "trục performance (S4)"; tránh trục có trong skill nhưng vắng ở mẫu báo cáo |
| D-4 | Không bump `plugins/backend/.manifest.json` version | S4 không nêu; bump phiên bản là việc của lần phát hành |

## Global Constraints

- Docs-only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `workflows/`, `plugins/_published.json`, plugin khác ngoài `plugins/backend`, skill/agent backend khác ngoài `backend-code-review` và `backend-reviewer`.
- Chỉ sửa 4 file nội dung: `plugins/backend/skills/backend-code-review/SKILL.md`, `.../references/review-dimensions.md`, `.../references/review-output-template.md`, `plugins/backend/agents/backend-reviewer.md`; và `test/validate.mjs` (khối "14." mới). Không thêm file test mới, không đổi frontmatter `order`/`pipeline` của skill.
- Giữ nguyên 5 trục hiện có và mọi assert cũ (`P0 S1` cấm chuỗi `sắp có` trong `backend-code-review/SKILL.md`: đừng viết chuỗi đó).
- Mọi nhận định về hành vi ORM/DB/công cụ đo (Hibernate, SQLAlchemy, `EXPLAIN`, …) là ví dụ hướng sửa, gắn `[Inference]` hoặc nêu "đối chiếu phiên bản của project"; không tuyên bố hiệu quả định lượng.
- File UTF-8 không BOM, LF. Nội dung hướng người dùng viết tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng (AGENTS.md → Comments).
- Không `rm -rf` thư mục chứa junction [[windows-junction-rm-hazard]]. Nếu `validate` báo "ship references/ (parity)" hoặc "thiếu SKILL.md" thì chạy `npm run build` trước rồi chạy lại.
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, commit bằng `git commit -F`, KHÔNG trailer `Co-Authored-By`). Push/PR/merge: chờ người dùng.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `plugins/backend/skills/backend-code-review/references/review-dimensions.md` | Thêm "Trục 6 — Performance" trước mục "Severity" | 1 |
| `plugins/backend/skills/backend-code-review/SKILL.md` | `description` + bullet Performance ở bước 1 | 1 |
| `plugins/backend/skills/backend-code-review/references/review-output-template.md` | Danh sách trục hợp lệ + dòng ví dụ | 1 |
| `plugins/backend/agents/backend-reviewer.md` | Vai trò nêu rủi ro hiệu năng | 1 |
| `test/validate.mjs` | Khối "14.": hợp đồng trục performance | 1 |

---

### Task 0: Commit plan

**Files:**
- Commit: `docs/superpowers/plans/2026-09-30-backend-review-performance-axis.md` (file này)

**Interfaces:**
- Consumes: branch `feature/frontend-data-integration` (nhánh đang làm; người dùng đã yêu cầu làm tiếp trên nhánh này cho task trước).
- Produces: nhánh mà Task 1 commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ file plan untracked; branch `feature/frontend-data-integration`.

- [ ] **Step 2: Stage và commit qua `core:git-workflow`**

Run: `git add docs/superpowers/plans/2026-09-30-backend-review-performance-axis.md && git status --short`
Header đề xuất: `docs(specs): add backend-review performance axis implementation plan`

---

### Task 1: Trục Performance cho `backend-code-review`

**Files:**
- Modify: `plugins/backend/skills/backend-code-review/references/review-dimensions.md` (chèn trước dòng `## Severity — thang phân loại + evidence`)
- Modify: `plugins/backend/skills/backend-code-review/SKILL.md` (`description`; bước 1)
- Modify: `plugins/backend/skills/backend-code-review/references/review-output-template.md` (dòng "Trục hợp lệ", bảng finding)
- Modify: `plugins/backend/agents/backend-reviewer.md` (mục `## Vai trò`)
- Test: `test/validate.mjs` (khối "14." mới, trước dòng `// ─────…` cuối file, sau khối "13.")

**Interfaces:**
- Consumes: `PLUGINS_DIR`, `fs`, `path`, `ok` (đã có ở `test/validate.mjs`).
- Produces: mục `## Trục 6 — Performance` trong `review-dimensions.md`; bullet `- **Performance**` trong `SKILL.md`; nhãn trục `performance` trong template. Pha nối workflow sau này (`workflow-performance` Bước 6, `workflow-db-change` Bước 4) dựa vào các mục này.

- [ ] **Step 1: Viết assert (failing)**

Chèn khối "14." vào `test/validate.mjs`, ngay sau khối "13." và trước dòng `// ─────…` cuối file:

```js
// 14. SOURCE: backend-code-review — trục performance (spec 2026-09-29 §3.3 S4, lỗi D12)
{
  const brDir = path.join(PLUGINS_DIR, 'backend', 'skills', 'backend-code-review');
  const brRead = (rel) => fs.readFileSync(path.join(brDir, rel), 'utf8');
  const brDims = brRead('references/review-dimensions.md');
  const brSkill = brRead('SKILL.md');
  const brTemplate = brRead('references/review-output-template.md');
  const brAgent = fs.readFileSync(path.join(PLUGINS_DIR, 'backend', 'agents', 'backend-reviewer.md'), 'utf8');
  ok(brDims.includes('## Trục 6 — Performance'), 'backend-code-review: review-dimensions có "Trục 6 — Performance"');
  const brPerf = (brDims.split('## Trục 6 — Performance')[1] ?? '').split('\n## ')[0];
  ok(['N+1', 'index', 'vòng lặp', 'eager'].every((k) => brPerf.includes(k)),
    'backend-code-review: Trục 6 nêu đủ N+1, thiếu index, query trong vòng lặp, tải eager thừa');
  // Contract đầu ra cấm kết luận hiệu năng khi thiếu số đo; trục mới phải giữ đúng ràng buộc đó.
  ok(brPerf.includes('suspected') && brPerf.includes('số đo'),
    'backend-code-review: Trục 6 quy định finding hiệu năng không có số đo là suspected');
  ok(brSkill.includes('- **Performance**') && /^description: .*N\+1/m.test(brSkill),
    'backend-code-review: SKILL.md có bullet Performance ở bước 1 và nêu N+1 trong description');
  ok(brTemplate.includes('`performance`'), 'backend-code-review: mẫu output liệt kê trục performance');
  ok(/hiệu năng/.test(brAgent), 'backend-reviewer: Vai trò nêu rủi ro hiệu năng');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/validate.mjs 2>&1 | grep -E "backend-code-review|backend-reviewer|KẾT QUẢ"`
Expected: FAIL 6 assert của khối "14." (`có "Trục 6 — Performance"`, `nêu đủ N+1…`, `quy định finding hiệu năng…`, `bullet Performance…`, `mẫu output liệt kê trục performance`, `Vai trò nêu rủi ro hiệu năng`); các assert cũ vẫn PASS.

- [ ] **Step 3: Thêm "Trục 6" vào `review-dimensions.md`**

Chèn đoạn sau ngay trước dòng `## Severity — thang phân loại + evidence` (giữ một dòng trống trước và sau):

```markdown
## Trục 6 — Performance

Đọc diff tĩnh chỉ cho thấy **rủi ro hiệu năng**, không cho thấy số đo. Contract đầu ra (`core:principles`) cấm kết
luận về hiệu năng khi không có số đo trước/sau trên cùng điều kiện, nên finding của trục này mặc định:

- nhãn **suspected**, `category: performance`, `confidence` tối đa `medium`;
- **không viết con số** (ms, %, số truy vấn) vào `impact` khi chưa đo;
- severity tối đa **major** khi chưa có số đo hay kế hoạch thực thi (`blocker` cần bằng chứng đo được).

Dấu hiệu:

- **N+1 query:** vòng lặp gọi `repository.findById(...)` cho từng phần tử; truy cập quan hệ lazy (vd `order.getItems()`)
  trong vòng lặp hoặc `stream().map(...)` sau khi đã tải danh sách cha; mapper DTO chạm quan hệ lazy. Python/ORM: truy
  cập quan hệ lazy trong vòng lặp mà không tải trước theo lô. Hướng sửa thường là tải theo lô hoặc `JOIN FETCH`/
  `@EntityGraph` (Hibernate), `selectinload`/`joinedload` (SQLAlchemy) `[Inference]` — đối chiếu ORM và phiên bản của
  project.
- **Query trong vòng lặp:** gọi DB, HTTP hoặc RPC trong `for`/`while`/`stream` thay vì gom thành một truy vấn theo
  lô (`IN`, batch, bulk).
- **Thiếu index:** điều kiện lọc, join hoặc sắp xếp mới trên cột chưa có index (kiểm migration trong diff và schema
  hiện có); `LIKE '%…'` đầu chuỗi; bọc cột bằng hàm trong điều kiện (`WHERE lower(col) = …`). `[Inference]` Ảnh hưởng
  phụ thuộc DB và kích thước dữ liệu, kiểm bằng kế hoạch thực thi; index thừa làm chậm ghi cũng đáng nêu ở mức minor.
- **Tải eager/thừa:** `FetchType.EAGER` trên quan hệ dạng tập hợp; tải cả aggregate để hiển thị vài trường (cân nhắc
  projection/read model); danh sách không phân trang hoặc không giới hạn (vd `findAll()` trên bảng lớn); tải cả bảng
  vào bộ nhớ rồi lọc bằng code.

Cách đo chỉ **đề xuất** trong finding (skill là READ-ONLY, không tự chạy trên môi trường thật): log SQL hoặc đếm
truy vấn trong test tích hợp, `EXPLAIN` trên môi trường local/test, profiler của stack. Cần tối ưu có số đo
trước/sau → `workflow-performance` (nếu project đã cài).
```

- [ ] **Step 4: Sửa `SKILL.md`**

(a) Trong `description` (frontmatter, một dòng), thay đúng cụm
`readability & naming theo code-convention, và test coverage (unit lõi + edge).`
bằng
`readability & naming theo code-convention, hiệu năng (N+1, thiếu index, query trong vòng lặp, tải eager thừa — nhãn suspected khi chưa có số đo), và test coverage (unit lõi + edge).`

(b) Ở bước "### 1. Review theo TRỤC", ngay sau bullet `- **Readability & naming** — …` và trước bullet `- **Test coverage** — …`, chèn:

```markdown
- **Performance** — N+1, query/HTTP trong vòng lặp, thiếu index cho điều kiện lọc/join/sắp xếp mới, tải eager
  hoặc không phân trang. Không có số đo thì nhãn **suspected**, không nêu con số; chỉ đề xuất cách đo.
```

- [ ] **Step 5: Sửa `review-output-template.md`**

(a) Thay đúng đoạn
```
Trục hợp lệ: `correctness` · `thiết-kế` (Dependency Rule/kiến trúc) · `đơn-giản-hoá` · `readability/naming` ·
`test-coverage`.
```
bằng
```
Trục hợp lệ: `correctness` · `thiết-kế` (Dependency Rule/kiến trúc) · `đơn-giản-hoá` · `readability/naming` ·
`performance` · `test-coverage`.
```

(b) Trong bảng finding, ngay sau dòng ví dụ `| 2 | major | `path/to/svc.py:88` | thiết-kế | suspected | … |` và trước dòng `| … | | | | | | |`, chèn:

```markdown
| 3 | major | `path/to/OrderQuery.java:57` | performance | suspected | Vòng lặp gọi `findByOrderId` cho từng đơn; nghi N+1, chưa đo | Tải theo lô hoặc `JOIN FETCH`; đo bằng log SQL trước khi sửa |
```

- [ ] **Step 6: Sửa agent `backend-reviewer.md`**

Trong mục `## Vai trò`, thay đúng câu
`Reviewer backend: đọc diff hoặc module được giao, tìm lỗi correctness, vi phạm kiến trúc, drift contract.`
bằng
`Reviewer backend: đọc diff hoặc module được giao, tìm lỗi correctness, vi phạm kiến trúc, rủi ro hiệu năng (N+1, thiếu index), drift contract.`

- [ ] **Step 7: Chạy lại validate + build + toàn bộ**

Run: `npm run build 2>&1 | tail -3 && node test/validate.mjs 2>&1 | grep -E "backend-code-review|backend-reviewer|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: build không lỗi; không còn FAIL chứa `backend-code-review` hay `backend-reviewer`; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`; không có dòng `fail [1-9]`. Nếu một assert cũ đỏ → đọc assert, nêu nguyên nhân và BÁO trước khi sửa assert cũ.

- [ ] **Step 8: Rà nhãn**

Run: `grep -n "Inference\|Unverified" plugins/backend/skills/backend-code-review/references/review-dimensions.md`
Expected: các nhãn `[Inference]` nằm đúng ở nhận định về hướng sửa ORM và hành vi index/DB (mục "Trục 6"); báo danh sách trong report task.

- [ ] **Step 9: Commit qua `core:git-workflow`**

Stage đúng 5 file trên. Header đề xuất: `feat(backend): add performance axis to backend-code-review`

---

## Ngoài plan này

- Cập nhật `backend/backend-code-review` trong `workflows/*` (P3): `workflow-performance` Bước 6 và `workflow-db-change` Bước 4 đã nhắc "performance/N+1"; sau S4 có thể trỏ thẳng "Trục 6" — WF12 của spec §5.3, thuộc pha P3.
- Bump version `plugins/backend/.manifest.json` khi phát hành.
- S7 (`frontend-testing` trỏ sang `frontend-e2e-testing`) chờ pha publish của skill e2e, vì trỏ tới skill draft sẽ tạo liên kết treo với người dùng chưa cài nó.
- ADR phân ranh `backend-db-migration` ↔ `data-oltp-implement` (spec Q5) cần người dùng chốt, không tự quyết.
