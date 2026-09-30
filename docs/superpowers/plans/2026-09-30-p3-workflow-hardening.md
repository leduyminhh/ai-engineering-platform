# P3: WF3-b, WF11, WF12, A3 và đồng bộ vùng rủi ro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm nốt phần còn lại của spec 2026-09-29 mà **không cần pilot và không dùng skill/agent draft**: (1) WF3-b: `workflow-db-change` Bước 6 verify theo công cụ (Flyway forward-only không có rollback); (2) A3: cổng `git diff --name-only` cho mọi bước test-writer; (3) WF12: `workflow-incident` có thang severity mặc định, bước cập nhật stakeholder và cửa sổ theo dõi phục hồi; (4) đồng bộ 3 vùng rủi ro mới của `workflow-security-review` với `engineering-quality-gate/references/security-review-areas.md`; (5) WF11: bước "Baseline build/test" đo được (W-a) cho `feature`, `bugfix`, `testing`, `api`, `security-review`. Assert hợp đồng ở `test/validate.mjs` (khối "17.").

**Architecture:** Docs-only. Sửa `workflows/<slug>/WORKFLOW.md` theo khung `cli/lib/workflows.mjs` (`checkWorkflowBody`: 8 trường mỗi bước, đánh số liên tục từ 1, ít nhất một bước ⏸; agent nêu trong `Hành động` phải có trong `Thực hiện` của cùng bước và trong frontmatter `agents`) và một file reference của `engineering-quality-gate`. Các bước chèn thêm buộc đánh số lại: dùng **quy trình đánh số lại** ở mục Global Constraints. Không thêm agent hay workflow mới, không đổi `risk`, nên orchestrator và README không đổi.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §5.2 (W-a), §5.3 (WF3, WF11, WF12), §8.5 (A3), §12 (rủi ro Flyway forward-only), §9 (pha P2–P3).

## Quyết định của plan (spec không nêu — người duyệt có thể đổi)

| # | Quyết định | Lý do |
|---|---|---|
| D-1 | WF3-b chỉ sửa cách verify ở Bước 6 (và các câu nhắc "up → rollback → up"); KHÔNG gọi `data-db-migration` | Skill đó là draft; phần WF3 dùng skill chờ pha publish |
| D-2 | WF11 áp dụng cho `feature`, `bugfix`, `testing`, `api`, `security-review`. Loại trừ: `refactor` (đã có Bước 3 Baseline), `release` (đã có Bước 1 Baseline), `performance` (Bước 2 đã đo baseline), `db-change` (tiền điều kiện là DB test, không phải build), `incident`/`docs`/`code-review` (không sửa code hoặc không cần baseline) | Tránh baseline thứ hai và đánh số lại không cần thiết |
| D-3 | Baseline của `bugfix`: build phải xanh, số mốc test của vùng nghi ngờ được ghi (test có thể đỏ đúng vì bug) | Bug tái hiện bằng test đỏ; đòi test xanh sẽ chặn chính workflow |
| D-4 | A3: gate `git diff --name-only` chỉ chứa file test áp dụng cho mọi bước có `agent \`backend-test-writer\`` hoặc `agent \`frontend-test-writer\`` trong `Thực hiện`, và được kiểm bằng một assert tổng quát | Mode `write` của agent chỉ sinh `disallowedTools` theo mode, không khoá theo đường dẫn `[Inference]` (spec §8.5 A3) |
| D-5 | WF12-incident: thang severity mặc định SEV1–SEV4 chỉ dùng khi project chưa có thang; "đủ thời gian" theo dõi phục hồi thành **cửa sổ theo dõi do người dùng chốt ở Bước 4**, không hard-code số phút | Không bịa ngưỡng; người dùng biết chu kỳ tải của hệ thống |
| D-6 | Bước cập nhật stakeholder chỉ **soạn** nội dung, người dùng tự gửi | Workflow không gửi tin nhắn thay người dùng |
| D-7 | Không làm: A4/Q2 (chuyển bước sửa code ở session chính sang agent implementer), G10 (chủ sở hữu profiling), S7/S8, pha publish P1b/P1c | Cần quyết định thiết kế hoặc evidence pilot; xem "Ngoài plan này" |

## Global Constraints

- Docs/tests only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `plugins/_published.json`, agent nào, workflow ngoài `db-change`, `incident`, `feature`, `bugfix`, `testing`, `api`, `security-review` và (chỉ A3) `refactor`; KHÔNG sửa `workflows/orchestrator/`, README.
- Giữ nguyên `name`, `order`, `title`, `kind`, `tier`, `risk`, `requires`, `runsIn`, `invoke` và danh sách `agents` của mọi workflow (không thêm/bớt agent).
- KHÔNG nhắc skill/agent draft (`frontend-data-integrator`, `frontend-e2e-test-writer`, `frontend-data-integration`, `frontend-e2e-testing`, `data-db-migration`, `backend-db-migration`) trong nội dung workflow/skill.
- Khung bước theo `checkWorkflowBody`: mọi bước đủ 8 trường `Thực hiện`/`Đầu vào`/`Hành động`/`Ràng buộc`/`Đầu ra`/`Gate`/`Khi fail`/`Evidence`; đánh số liên tục từ 1; agent nêu trong `Hành động` chỉ khi có trong `Thực hiện` của cùng bước.
- Không in/không yêu cầu in giá trị secret; không thêm khẳng định về tiêu chuẩn bên ngoài (mã OWASP/CWE) ngoài những mã đã có sẵn trong file được sửa.
- **Quy trình đánh số lại** (mọi task chèn bước): chèn bước ở vị trí `k`. Mọi tham chiếu `Bước n` có `n ≥ k` trong toàn file (tiêu đề bước, `Đầu vào`, `Hành động`, `Khi fail`, `Evidence`, bảng Checkpoint, bảng Xử lý lỗi, Điều kiện dừng, Rollback, Definition of Done, comment YAML) tăng thêm 1. Khoảng `Bước a–b`: nếu `a` là bước đầu tiên (1) thì giữ `a` (để gồm cả bước mới), còn `b ≥ k` thì `b+1`; nếu `a ≥ k` thì cả hai +1. Đếm bằng `grep -n "Bước [0-9]"` trước và sau; sau khi sửa, `parseSteps` phải cho các bước liên tục từ 1, các ⏸ trùng bảng Checkpoint, và không còn tham chiếu trỏ nhầm bước. Có thể dùng script tạm trong `<scratchpad>` (không commit) nhưng phải rà lại từng tham chiếu bằng mắt.
- File UTF-8 không BOM, LF (index LF; working tree Windows có thể CRLF do autocrlf: giữ nguyên kiểu xuống dòng hiện có để diff chỉ có dòng cần sửa). Nội dung tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng.
- Chỉ thêm assert vào `test/validate.mjs` (khối "17." mới, sau khối "16."); không thêm file test mới; không sửa assert cũ.
- Nếu `validate` báo "ship references/ (parity)" hoặc "thiếu SKILL.md" thì chạy `npm run build` rồi chạy lại. Không `rm -rf` thư mục chứa junction [[windows-junction-rm-hazard]].
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, commit bằng `git commit -F`, KHÔNG trailer `Co-Authored-By`). Push/PR/merge: chờ người dùng.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `workflows/db-change/WORKFLOW.md` | WF3-b: Bước 6 verify theo công cụ | 1 |
| workflow có bước test-writer: `feature`, `bugfix`, `testing`, `refactor`, `api`, `db-change`, `security-review` | A3: Gate `git diff --name-only` | 2 |
| `workflows/incident/WORKFLOW.md` | WF12: thang severity, Bước 5 cập nhật stakeholder, cửa sổ theo dõi | 3 |
| `plugins/engineering/skills/engineering-quality-gate/references/security-review-areas.md` | Bảng ánh xạ 8 vùng của workflow ↔ 5 vùng; bullet authorization/SSRF/misconfiguration | 4 |
| `workflows/feature`, `bugfix`, `testing` | WF11: Bước 1 Baseline | 5 |
| `workflows/api`, `security-review` | WF11: Bước 1 Baseline | 6 |
| `test/validate.mjs` | Khối "17." | 1–6 |

---

### Task 0: Branch và commit plan

**Files:**
- Commit: `docs/superpowers/plans/2026-09-30-p3-workflow-hardening.md` (file này)

**Interfaces:**
- Consumes: branch `master` (1d8b42f hoặc mới hơn), working tree sạch trừ file plan.
- Produces: branch `feature/p3-workflow-hardening` mà mọi task sau commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ file plan untracked; branch `master`.

- [ ] **Step 2: Tạo branch và commit plan qua `core:git-workflow`**

Run: `git checkout -b feature/p3-workflow-hardening && git add docs/superpowers/plans/2026-09-30-p3-workflow-hardening.md && git status --short`
Header đề xuất: `docs(specs): add P3 workflow hardening plan`

---

### Task 1: WF3-b — `workflow-db-change` verify theo công cụ

**Files:**
- Modify: `workflows/db-change/WORKFLOW.md`
- Test: `test/validate.mjs` (khối "17." mới, trước dòng `// ─────…` cuối file, sau khối "16.")

**Interfaces:**
- Consumes: `workflows`, `parseSteps`, `ok`, `fs`, `path`, `REPO_ROOT` (đã có ở `test/validate.mjs`).
- Produces: khối "17." định nghĩa `wf17(id)`, `noStep17`, `step17(wf, n)` mà Task 2–6 dùng.

- [ ] **Step 1: Viết assert (failing)**

Chèn khối "17." vào `test/validate.mjs`, ngay sau khối "16." và trước dòng `// ─────…` cuối file:

```js
// 17. SOURCE: P3 — WF3-b, A3, WF12, vùng rủi ro, WF11 (spec 2026-09-29 §5.3, §8.5)
{
  const wf17 = (id) => workflows.stages.find((s) => s.id === id);
  const noStep17 = { title: '', body: '', checkpoint: false };
  const step17 = (wf, n) => (wf ? parseSteps(wf.body).find((s) => s.n === n) ?? noStep17 : noStep17);
  const flat17 = (t) => t.replace(/\s+/g, ' ');

  // WF3-b: Flyway forward-only không có rollback nên "up → rollback → up" không thực hiện được với mọi công cụ.
  const dbc17 = wf17('workflow-db-change');
  const dbcVerify = step17(dbc17, 6);
  ok(/Chạy thử|verify/i.test(dbcVerify.title) && flat17(dbcVerify.body).includes('forward-only') && flat17(dbcVerify.body).includes('migration bù'),
    'workflow-db-change Bước 6: verify theo công cụ, có nhánh forward-only dùng migration bù');
  ok(/chu trình verify/.test(flat17(dbcVerify.body.split('**Gate:**')[1] ?? '').split('- **')[0]),
    'workflow-db-change Bước 6: Gate nêu chu trình verify theo công cụ');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-db-change Bước 6|KẾT QUẢ"`
Expected: FAIL 2 assert `workflow-db-change Bước 6: …`; mọi assert khác PASS.

- [ ] **Step 3: Sửa `workflows/db-change/WORKFLOW.md`**

Định vị từng chỗ theo NỘI DUNG (số dòng có thể lệch); nếu một anchor không khớp, đọc lại file, dùng đoạn tương đương gần nhất và ghi rõ trong report.

(a) `description`: thay cụm `chạy thử migrate up/rollback/up trên DB test` bằng `chạy thử chu trình verify theo công cụ (migrate up/rollback/up, hoặc up/migration bù với công cụ forward-only) trên DB test`.

(b) Mục tiêu: thay cụm `đã chạy thử migrate up → rollback → migrate up thành công trên DB test` bằng `đã chạy thử chu trình verify theo công cụ (migrate up → rollback → migrate up, hoặc migrate up → migration bù với công cụ forward-only) thành công trên DB test` (giữ phần đi sau: `, có integration test …`).

(c) Bước 2, Hành động: sau cụm `thiết kế migration forward + rollback theo chiến lược expand/contract` chèn `(công cụ forward-only: "rollback" là một migration bù mới)`; các phần còn lại của câu giữ nguyên.

(d) Thay toàn bộ Bước 6 (từ dòng `### Bước 6 — Chạy thử trên DB test` đến hết dòng `- **Evidence:** …` của bước đó) bằng:

```markdown
### Bước 6 — Chạy thử trên DB test

- **Thực hiện:** session chính
- **Đầu vào:** migration đã qua review từ Bước 4 + target DB đã xác nhận ở Bước 5
- **Hành động:** chạy chu trình verify theo công cụ migration của project trên DB test. Công cụ có rollback
  (vd Liquibase, Alembic): migrate up → rollback → migrate up lại. Công cụ forward-only (vd Flyway khi dùng theo
  hướng forward-only): migrate up, rồi áp migration bù đã thiết kế ở Bước 2 (nếu có), và kiểm schema/dữ liệu sau
  từng lượt. Xác nhận mọi lượt thành công.
- **Ràng buộc:** chỉ chạy trên đúng target đã xác nhận ở Bước 5 (cấu hình kết nối đổi → quay lại Bước 5);
  cấm chạy trên DB production; cấm thay đổi phá huỷ dữ liệu khi chưa được người dùng xác nhận ở Bước 2; không
  giả lập lượt rollback bằng cách sửa tay schema.
- **Đầu ra:** kết quả chu trình verify theo công cụ trên DB test.
- **Gate:** chu trình verify theo công cụ thành công (up → rollback → up, hoặc up → migration bù → kiểm schema),
  có evidence lệnh.
- **Khi fail:** một lượt trong chu trình verify thất bại → quay lại Bước 3 sửa migration, chạy lại cả chu
  trình từ đầu.
- **Evidence:** lệnh từng lượt + exit code từng lượt, ghi rõ công cụ và chế độ (có rollback / forward-only).
```

(e) Bảng "Xử lý lỗi & rollback": thay đầu ô của hàng `| Một lượt migrate up/rollback/up thất bại (Bước 6) |` bằng `| Một lượt trong chu trình verify thất bại (Bước 6) |` (giữ nguyên ô hành động). Trong "Điều kiện dừng" thay cụm `chuỗi migrate up/rollback/up liên tục thất bại` bằng `chu trình verify migration liên tục thất bại`.

(f) Definition of Done: thay dòng `- [ ] Migrate up → rollback → migrate up thành công trên DB test — evidence: Bước 6` bằng `- [ ] Chu trình verify theo công cụ thành công trên DB test — evidence: Bước 6`.

- [ ] **Step 4: Chạy lại validate + rà**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-db-change|KẾT QUẢ" ; grep -n "up/rollback/up\|up → rollback → up" workflows/db-change/WORKFLOW.md`
Expected: không còn FAIL chứa `workflow-db-change`; `KẾT QUẢ: <n> pass, 0 fail`; các dòng `grep` còn lại chỉ nằm trong `description`, Mục tiêu và Bước 6 (ở dạng "hoặc" có nhánh forward-only), không còn dòng nào chỉ nêu rollback như bắt buộc.

- [ ] **Step 5: Chạy toàn bộ**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`; `WIZARD TEST … 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: `workflows/db-change/WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): verify migrations per tool in db-change (forward-only aware)`

---

### Task 2: A3 — gate `git diff --name-only` cho bước test-writer

**Files:**
- Modify: mọi `workflows/<slug>/WORKFLOW.md` có bước với `agent \`backend-test-writer\`` hoặc `agent \`frontend-test-writer\`` trong `Thực hiện` (dự kiến: `feature`, `bugfix`, `testing`, `refactor`, `api`, `db-change`, `security-review`)
- Test: `test/validate.mjs` (thêm vào cuối khối "17.", trước dấu `}` đóng khối)

**Interfaces:**
- Consumes: `workflows`, `parseSteps`, `flat17` (Task 1).
- Produces: mọi bước test-writer có Gate kiểm danh sách file thay đổi.

- [ ] **Step 1: Liệt kê bước cần sửa (chỉ đọc)**

Run: `node -e "import('./cli/lib/plugins.mjs').then(async (m) => { const w = m.loadWorkflows(); const { parseSteps } = await import('./cli/lib/workflows.mjs'); for (const s of w.stages) for (const st of parseSteps(s.body)) { const line = (st.body.split('\n').find((l) => l.includes('**Thực hiện:**')) || ''); if (/agent \`(backend|frontend)-test-writer\`/.test(line)) console.log(s.id, 'Bước', st.n, st.title); } })"`
Expected: danh sách các bước test-writer (ghi vào report; đây là tập phải sửa).

- [ ] **Step 2: Viết assert (failing)**

Thêm vào cuối khối "17." trong `test/validate.mjs`:

```js

  // A3: mode write không khoá được theo đường dẫn nên mỗi bước test-writer phải tự chứng minh chỉ đụng file test.
  for (const w17 of workflows.stages) {
    for (const st of parseSteps(w17.body)) {
      const doer = st.body.split('\n').find((l) => l.includes('**Thực hiện:**')) || '';
      if (!/agent `(backend|frontend)-test-writer`/.test(doer)) continue;
      const gate = flat17((st.body.split('**Gate:**')[1] ?? '').split('\n- **')[0]);
      ok(gate.includes('git diff --name-only') && /file test/.test(gate),
        `${w17.id} bước ${st.n}: Gate kiểm git diff --name-only chỉ chứa file test`);
    }
  }
```

- [ ] **Step 3: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "Gate kiểm git diff|KẾT QUẢ"`
Expected: FAIL một assert cho mỗi bước ở danh sách Step 1; mọi assert khác PASS.

- [ ] **Step 4: Sửa Gate của từng bước**

Với mỗi bước ở danh sách: thêm vào cuối dòng `- **Gate:**` (trước dấu chấm cuối, hoặc sau dấu chấm phẩy) mệnh đề `; \`git diff --name-only\` của bước chỉ chứa file test (và fixture/mock của test)`, và thêm vào `- **Evidence:**` cụm `; kết quả \`git diff --name-only\``. Giữ nguyên mọi chữ khác; viết lại xuống dòng cho khớp độ rộng ~110 cột của các dòng lân cận. Nếu Gate hiện có nhiều mệnh đề, mệnh đề mới đứng cuối.

- [ ] **Step 5: Chạy lại validate + toàn bộ**

Run: `node test/validate.mjs 2>&1 | grep -E "Gate kiểm git diff|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: không còn FAIL; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`; `WIZARD TEST … 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: các file `WORKFLOW.md` đã sửa (nêu rõ đường dẫn từng file), `test/validate.mjs`.
Header đề xuất: `fix(workflows): gate test-writer steps on git diff containing only test files`

---

### Task 3: WF12 — `workflow-incident`

**Files:**
- Modify: `workflows/incident/WORKFLOW.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "17.")

**Interfaces:**
- Consumes: `wf17`, `step17`, `flat17`, `noStep17` (Task 1).
- Produces: workflow-incident 8 bước: 1 Triage, 2 Thu evidence, 3 Giả thuyết, 4 Đề xuất mitigation ⏸, **5 Cập nhật stakeholder ⏸**, 6 Xác minh phục hồi, 7 RCA & postmortem, 8 Commit tài liệu ⏸.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "17." trong `test/validate.mjs`:

```js

  // WF12: thiếu thang severity mặc định, thiếu bước truyền thông, "đủ thời gian" theo dõi không có ngưỡng.
  const inc17 = wf17('workflow-incident');
  const incSteps = inc17 ? parseSteps(inc17.body) : [];
  ok(incSteps.length === 8 && /Cập nhật stakeholder/.test(step17(inc17, 5).title) && step17(inc17, 5).checkpoint
    && step17(inc17, 6).title.startsWith('Xác minh phục hồi') && step17(inc17, 8).title.startsWith('Commit'),
    'workflow-incident: 8 bước, Bước 5 Cập nhật stakeholder ⏸, Xác minh phục hồi ở Bước 6, Commit ở Bước 8');
  ok(['SEV1', 'SEV2', 'SEV3', 'SEV4'].every((s) => flat17(step17(inc17, 1).body).includes(s)),
    'workflow-incident Bước 1: có thang severity mặc định SEV1–SEV4 khi project chưa có thang');
  ok(/cửa sổ theo dõi/.test(flat17(step17(inc17, 4).body)) && /cửa sổ theo dõi/.test(flat17(step17(inc17, 6).body)),
    'workflow-incident: cửa sổ theo dõi phục hồi do người dùng chốt ở Bước 4 và dùng ở Bước 6');
  ok(/người dùng tự gửi|người dùng gửi/.test(flat17(step17(inc17, 5).body)) && !/agent `/.test(step17(inc17, 5).body.split('**Thực hiện:**')[1]?.split('\n')[0] ?? ''),
    'workflow-incident Bước 5: chỉ soạn nội dung, người dùng tự gửi, không agent');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-incident|KẾT QUẢ"`
Expected: FAIL 4 assert `workflow-incident …`; khung body PASS.

- [ ] **Step 3: Sửa `workflows/incident/WORKFLOW.md`**

Định vị theo NỘI DUNG (anchor lấy từ file hiện tại; nếu không khớp, dùng đoạn tương đương gần nhất và ghi trong report).

(a) Bước 1, thay đoạn
```
- **Hành động:** xác định mức độ nghiêm trọng (severity) theo thang của project; xác định phạm vi ảnh hưởng
  (service/khách hàng/khu vực) và thời điểm bắt đầu ước tính dựa trên log/metric.
```
bằng
```
- **Hành động:** xác định mức độ nghiêm trọng (severity) theo thang của project; project chưa có thang thì
  dùng thang mặc định đề xuất, người dùng có thể đổi: SEV1 (mất dịch vụ chính hoặc mất dữ liệu, ảnh hưởng đa
  số người dùng), SEV2 (suy giảm nghiêm trọng hoặc ảnh hưởng một phần người dùng), SEV3 (ảnh hưởng nhỏ hoặc
  có cách lách), SEV4 (chưa ảnh hưởng người dùng). Xác định phạm vi ảnh hưởng (service/khách hàng/khu vực) và
  thời điểm bắt đầu ước tính dựa trên log/metric.
```

(b) Bước 4, trong `Hành động` thêm vào cuối: `Đề xuất kèm cửa sổ theo dõi phục hồi (khoảng thời gian quan sát sau mitigation) và ngưỡng metric "bình thường" rút từ Bước 1–2, để người dùng chốt cùng phương án.`; trong `Đầu ra` thêm `, kèm cửa sổ theo dõi và ngưỡng metric đã chốt`.

(c) Chèn Bước 5 mới ngay sau Bước 4 (theo **Quy trình đánh số lại**, k = 5; Xác minh phục hồi → Bước 6, RCA → Bước 7, Commit → Bước 8):

```markdown
### Bước 5 — Cập nhật stakeholder ⏸

- **Thực hiện:** session chính
- **Đầu vào:** mức độ + phạm vi ảnh hưởng từ Bước 1, phương án mitigation đã chọn từ Bước 4
- **Hành động:** soạn nội dung cập nhật trạng thái cho stakeholder: mức độ nghiêm trọng, phạm vi ảnh hưởng,
  trạng thái hiện tại (đang điều tra / đã có mitigation / đang theo dõi), mitigation đang áp dụng, thời điểm
  cập nhật kế tiếp; trình cho người dùng. Người dùng tự gửi qua kênh của họ.
- **Ràng buộc:** workflow không tự gửi tin nhắn hay thông báo thay người dùng; không đưa giá trị secret,
  thông tin cá nhân của khách hàng hay suy đoán chưa có evidence vào nội dung.
- **Đầu ra:** bản nháp cập nhật stakeholder đã được người dùng duyệt (hoặc dòng "không cần cập nhật" kèm lý do).
- **Gate:** người dùng duyệt nội dung hoặc xác nhận không cần cập nhật.
- **Khi fail:** người dùng chưa duyệt → dừng, chờ xác nhận, không tự sửa mức độ hay phạm vi trong bản nháp.
- **Evidence:** bản nháp cập nhật + xác nhận của người dùng (hoặc lý do không cần cập nhật).
```

(d) Bước 6 (Xác minh phục hồi, trước đây Bước 5), `Ràng buộc`: thay cụm `theo dõi đủ thời gian để loại trừ giả phục hồi tạm thời` bằng `theo dõi trong cửa sổ theo dõi đã chốt ở Bước 4 để loại trừ giả phục hồi tạm thời; hết cửa sổ mà metric chưa ổn định thì không kết luận phục hồi`. Trong `Hành động` của bước này thêm `theo ngưỡng metric và cửa sổ theo dõi đã chốt ở Bước 4` sau `đối chiếu`.

(e) Checkpoint, Xử lý lỗi, Điều kiện dừng, Definition of Done: đánh số lại theo quy trình; thêm vào Checkpoint hàng `| 5 | Bản nháp cập nhật stakeholder | Người dùng duyệt nội dung hoặc xác nhận không cần cập nhật |`; thêm vào Definition of Done dòng `- [ ] Cập nhật stakeholder đã được người dùng duyệt (hoặc xác nhận không cần) — evidence: Bước 5`.

- [ ] **Step 4: Chạy lại validate + rà số bước**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-incident|KẾT QUẢ" ; grep -n "Bước [0-9]" workflows/incident/WORKFLOW.md`
Expected: không còn FAIL chứa `workflow-incident`; rà từng dòng `grep`: mọi tham chiếu `Bước n` trỏ đúng bước sau khi đánh số lại (⏸ ở 4, 5, 8 khớp Checkpoint).

- [ ] **Step 5: Chạy toàn bộ**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`; `WIZARD TEST … 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: `workflows/incident/WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add stakeholder update, default severity scale and watch window to incident`

---

### Task 4: Đồng bộ vùng rủi ro với `security-review-areas.md`

**Files:**
- Modify: `plugins/engineering/skills/engineering-quality-gate/references/security-review-areas.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "17.")

**Interfaces:**
- Consumes: nội dung hiện có của file (5 vùng, đã gắn mã A01…A10 ở tiêu đề mục), `workflows/security-review/WORKFLOW.md` Bước 1 (8 vùng: auth/session, authorization/access control, input validation, SSRF, crypto/secrets, dependency, security misconfiguration, logging).
- Produces: bảng ánh xạ 8 vùng của workflow ↔ 5 vùng của reference, và key check tường minh cho authorization, SSRF, misconfiguration.

- [ ] **Step 1: Đọc file và xác định phần còn thiếu (chỉ đọc)**

Đọc trọn `security-review-areas.md` và `owasp-asvs-cwe-mapping.md`. Ghi vào report, với mỗi vùng mới (authorization/access control, SSRF, security misconfiguration), key check nào ĐÃ có (mục/dòng) và key check nào CHƯA có. Chỉ được thêm phần chưa có.

- [ ] **Step 2: Viết assert (failing)**

Thêm vào cuối khối "17." trong `test/validate.mjs`:

```js

  // Workflow security-review có 8 vùng; reference của quality-gate phải có key check cho 3 vùng mới và bảng ánh xạ.
  const areas17 = fs.readFileSync(path.join(PLUGINS_DIR, 'engineering', 'skills', 'engineering-quality-gate', 'references', 'security-review-areas.md'), 'utf8');
  ok(/authorization|phân quyền|kiểm quyền/i.test(areas17) && /SSRF/.test(areas17) && /misconfiguration|cấu hình (sai|không an toàn)/i.test(areas17),
    'quality-gate security-review-areas: có key check authorization, SSRF, security misconfiguration');
  ok(areas17.includes('| authorization/access control |') && areas17.includes('| SSRF |') && areas17.includes('| security misconfiguration |'),
    'quality-gate security-review-areas: bảng ánh xạ 8 vùng của workflow-security-review sang 5 vùng');
```

- [ ] **Step 3: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/validate.mjs 2>&1 | grep -E "security-review-areas|KẾT QUẢ"`
Expected: FAIL assert thứ hai (bảng ánh xạ chưa có). Assert thứ nhất có thể đã PASS nếu file đã có đủ key check: khi đó ghi rõ trong report chỗ nào (đó là kết quả hợp lệ của Step 1).

- [ ] **Step 4: Sửa file**

(a) Ngay sau đoạn mở đầu (trước mục `## 1. Auth / Session`), chèn bảng:

```markdown
## Ánh xạ với vùng rủi ro của `workflow-security-review`

Workflow chia 8 vùng để phân công; file này gom checklist thành 5 vùng. Khi review theo vùng của workflow, nạp
mục tương ứng dưới đây:

| Vùng của workflow | Mục trong file này |
|---|---|
| auth/session | 1. Auth / Session |
| authorization/access control | 1. Auth / Session (key check kiểm quyền) |
| input validation | 2. Input validation / Injection |
| SSRF | 2. Input validation / Injection (key check SSRF) |
| crypto/secrets | 3. Crypto / Secrets |
| security misconfiguration | 3. Crypto / Secrets (key check cấu hình) |
| dependency | 4. Dependency / Supply-chain |
| logging | 5. Logging / Error handling |
```
(dùng đúng tiêu đề mục như trong file; sửa cột phải cho khớp tên mục thật nếu khác).

(b) Với mỗi key check còn thiếu ở Step 1, thêm bullet ngắn (tiếng Việt, nêu dấu hiệu quan sát được trong code, không thêm mã OWASP/CWE mới ngoài những mã đã có ở tiêu đề mục) vào đúng mục: kiểm quyền theo vai trò/chủ sở hữu tài nguyên trên mỗi endpoint (mục 1); URL do người dùng cung cấp được server gọi tới mà không có allowlist host (mục 2); cấu hình mặc định không an toàn như debug bật, CORS mở rộng, header bảo mật thiếu, credential mặc định (mục 3). Bullet đã có thì không thêm.

- [ ] **Step 5: Chạy lại validate + toàn bộ**

Run: `node test/validate.mjs 2>&1 | grep -E "security-review-areas|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: không còn FAIL; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`; `WIZARD TEST … 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: `security-review-areas.md`, `test/validate.mjs`.
Header đề xuất: `docs(engineering): map security-review workflow areas to quality-gate checklist`

---

### Task 5: WF11 (phần 1) — Baseline cho `feature`, `bugfix`, `testing`

**Files:**
- Modify: `workflows/feature/WORKFLOW.md`, `workflows/bugfix/WORKFLOW.md`, `workflows/testing/WORKFLOW.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "17.")

**Interfaces:**
- Consumes: `wf17`, `step17`, `flat17`, `noStep17` (Task 1).
- Produces: mỗi workflow có Bước 1 = "Baseline build/test" (session chính); các bước cũ +1; tiền điều kiện nêu baseline được đo ở Bước 1.

Nội dung Bước 1 mới cho từng workflow (chèn theo **Quy trình đánh số lại**, k = 1). Mẫu chung (thay chỗ `<…>`):

```markdown
### Bước 1 — Baseline build/test

- **Thực hiện:** session chính
- **Đầu vào:** <đầu vào riêng của workflow>
- **Hành động:** chạy build và test của <vùng> theo lệnh của project; ghi số mốc (lệnh, exit code, số test
  pass/fail) làm baseline cho các bước sau.
- **Ràng buộc:** chỉ chạy build/test cục bộ; không chạy lệnh tác động môi trường; không sửa code để làm xanh.
- **Đầu ra:** baseline build/test (lệnh + exit code + số liệu).
- **Gate:** <gate riêng>
- **Khi fail:** <khi fail riêng>
- **Evidence:** lệnh build/test + exit code + số liệu pass/fail.
```

| Workflow | `<đầu vào>` | `<vùng>` | `<gate>` | `<khi fail>` |
|---|---|---|---|---|
| feature | yêu cầu tính năng của người dùng | vùng sẽ đụng | build/test xanh (exit code 0) và số mốc đã ghi. | đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không implement trên baseline đỏ. |
| bugfix | mô tả lỗi + vùng nghi ngờ của người dùng | vùng nghi ngờ | build xanh; số mốc test của vùng nghi ngờ đã ghi (test có thể đỏ đúng vì bug đang xử lý). | build đỏ, hoặc test đỏ ngoài vùng bug → dừng `blocked`, báo người dùng; không sửa lẫn hai lỗi. |
| testing | vùng cần thêm test của người dùng | vùng đụng | build/test xanh (exit code 0) và số mốc đã ghi. | đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không thêm test trên baseline đỏ. |

Ngoài Bước 1: (i) sửa dòng `- Baseline:` ở "Điều kiện tiên quyết" thêm cụm `— được đo và ghi số mốc ở Bước 1`; (ii) thêm vào "Xử lý lỗi & rollback" hàng `| Baseline đỏ (Bước 1) | Dừng \`blocked\`, không tiếp tục trên baseline đỏ; đề xuất workflow-bugfix (bugfix: báo người dùng) |`; (iii) thêm vào Definition of Done dòng đầu `- [ ] Baseline build/test đã đo, số mốc đã ghi — evidence: Bước 1`.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "17." trong `test/validate.mjs`:

```js

  // WF11 (phần 1): baseline từng chỉ là tiền điều kiện không ai đo (W-a).
  for (const id of ['workflow-feature', 'workflow-bugfix', 'workflow-testing']) {
    const w = wf17(id);
    const s1 = step17(w, 1);
    ok(/^Baseline/.test(s1.title) && flat17(s1.body).includes('session chính') && flat17(w?.body ?? '').includes('Baseline đỏ'),
      `${id}: Bước 1 là Baseline build/test do session chính đo, có hàng lỗi Baseline đỏ`);
    ok(flat17((w?.body ?? '').split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('ở Bước 1'),
      `${id}: tiền điều kiện Baseline nêu được đo ở Bước 1`);
  }
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "Baseline|KẾT QUẢ"`
Expected: FAIL 6 assert (2 cho mỗi workflow); mọi assert khác PASS.

- [ ] **Step 3: Sửa từng workflow**

Với mỗi workflow: chèn Bước 1 mẫu (điền theo bảng), đánh số lại theo quy trình, sửa tiền điều kiện, bảng lỗi, Definition of Done. Ghi vào report, với mỗi workflow, số lượng tham chiếu `Bước n` trước và sau (`grep -c "Bước [0-9]"`) và danh sách tham chiếu dạng khoảng đã xử lý.

- [ ] **Step 4: Chạy lại validate + rà số bước**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-(feature|bugfix|testing)|KẾT QUẢ"`, rồi với từng workflow `grep -n "Bước [0-9]" workflows/<slug>/WORKFLOW.md` và rà từng dòng.
Expected: không còn FAIL; ⏸ khớp Checkpoint; không còn tham chiếu trỏ nhầm bước (vd `Bước 4 ⏸` cũ còn nguyên).

- [ ] **Step 5: Chạy toàn bộ**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`; `WIZARD TEST … 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: 3 file `WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add measured baseline step to feature, bugfix and testing`

---

### Task 6: WF11 (phần 2) — Baseline cho `api`, `security-review`

**Files:**
- Modify: `workflows/api/WORKFLOW.md`, `workflows/security-review/WORKFLOW.md`
- Test: `test/validate.mjs` (thêm vào cuối khối "17.")

**Interfaces:**
- Consumes: `wf17`, `step17`, `flat17`; mẫu Bước 1 và quy trình ở Task 5.
- Produces: `api` 8 bước, `security-review` 10 bước; Bước 1 = "Baseline build/test".

Điền mẫu Bước 1 của Task 5 như sau:

| Workflow | `<đầu vào>` | `<vùng>` | `<gate>` | `<khi fail>` |
|---|---|---|---|---|
| api | mô tả endpoint của người dùng | backend | build/test xanh (exit code 0) và số mốc đã ghi. | đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; không thêm endpoint trên baseline đỏ. |
| security-review | phạm vi cần review của người dùng | phạm vi review | build/test xanh (exit code 0) và số mốc đã ghi, để phân biệt lỗi bảo mật với lỗi build có sẵn. | đỏ → dừng `blocked`, đề xuất `workflow-bugfix`; lỗi build có sẵn không tính là finding bảo mật. |

Ngoài Bước 1: làm đúng (i)–(iii) của Task 5. Lưu ý `security-review` đang có 9 bước (Bước 5 = Thu hồi secret ⏸, Bước 6 = Regression test, Bước 7 = Sửa, Bước 8 = Re-scan, Bước 9 = Commit ⏸) và Checkpoint 4, 5, 9; sau đánh số lại là 5, 6, 10; `api` đang có 7 bước, ⏸ ở Bước 1 và Bước 7, sau đánh số lại là 2 và 8. Các gate `git diff --name-only` do Task 2 thêm phải đi theo bước của chúng.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "17." trong `test/validate.mjs`:

```js

  // WF11 (phần 2).
  for (const [id, total] of [['workflow-api', 8], ['workflow-security-review', 10]]) {
    const w = wf17(id);
    const s1 = step17(w, 1);
    ok(/^Baseline/.test(s1.title) && flat17(s1.body).includes('session chính') && flat17(w?.body ?? '').includes('Baseline đỏ'),
      `${id}: Bước 1 là Baseline build/test do session chính đo, có hàng lỗi Baseline đỏ`);
    ok((w ? parseSteps(w.body).length : 0) === total, `${id}: ${total} bước sau khi thêm Baseline`);
    ok(flat17((w?.body ?? '').split('## Điều kiện tiên quyết')[1]?.split('## Các bước')[0] ?? '').includes('ở Bước 1'),
      `${id}: tiền điều kiện Baseline nêu được đo ở Bước 1`);
  }
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "Baseline|bước sau khi thêm|KẾT QUẢ"`
Expected: FAIL 6 assert; mọi assert khác PASS.

- [ ] **Step 3: Sửa từng workflow**

Chèn Bước 1, đánh số lại theo quy trình, sửa tiền điều kiện, bảng lỗi, Definition of Done. Ghi vào report số tham chiếu `Bước n` trước/sau và các tham chiếu dạng khoảng.

- [ ] **Step 4: Chạy lại validate + rà số bước**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-(api|security-review)|KẾT QUẢ"`, rồi `grep -n "Bước [0-9]" workflows/api/WORKFLOW.md workflows/security-review/WORKFLOW.md` và rà từng dòng.
Expected: không còn FAIL; ⏸ khớp Checkpoint (`api`: 2, 8; `security-review`: 5, 6, 10); không tham chiếu nhầm bước.

- [ ] **Step 5: Chạy toàn bộ**

Run: `npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`; `WIZARD TEST … 0 fail`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: 2 file `WORKFLOW.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add measured baseline step to api and security-review`

---

## Ngoài plan này (cần quyết định hoặc evidence pilot)

- **Pha publish P1b/P1c:** cần pilot có evidence chạy thật (Q6, Q7 chưa chọn project): thêm `data/data-db-migration`, `frontend/frontend-data-integration`, `frontend/frontend-e2e-testing` vào `plugins/_published.json` (và `plugins/data/` vào `package.json` `files` nếu publish `data`), thêm skill vào `backend-implementer`, S7/S8, WF3 phần dùng skill, WF4 Bước 5, WF5, WF6, xoá 2 assert "chưa workflow nào dùng".
- **A4/Q2:** chuyển bước sửa code ở session chính (bugfix Bước sửa, security-review Bước Sửa, performance tối ưu) sang agent implementer: `frontend-implementer` được thiết kế cho dựng UI từ thiết kế và `backend-implementer` cho vertical slice, chưa rõ có phù hợp sửa lỗi tuỳ ý; cần quyết định thiết kế.
- **G10:** chủ sở hữu và công cụ profiling cho `workflow-performance`.
- **Pilot:** Q6 (`data-db-migration` trên project Spring nào), Q7 (`frontend-data-integration` trên project React nào).
