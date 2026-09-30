# Workflow major fixes (WF7, WF4, WF3 phần không phụ thuộc draft) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa 4 lỗi mức **major** của workflow còn tồn tại (D7, D8, D9, D10) bằng các thay đổi chỉ dùng agent/skill đã publish: `workflow-security-review` (thêm vùng rủi ro authorization/SSRF/misconfiguration, bước thu hồi secret, regression test), `workflow-api` (auditor song song với kiểm drift), `workflow-db-change` (thêm bước Test và bước cập nhật `data-model.md`). Thêm assert hợp đồng trong `test/validate.mjs` (khối "15.") và đồng bộ bảng workflow ở `README.md`, `README_VI.md`.

**Architecture:** Docs-only, sửa 3 file `workflows/<slug>/WORKFLOW.md` theo khung của `cli/lib/workflows.mjs` (`checkWorkflowBody`: 8 trường mỗi bước, đánh số liên tục từ 1, ít nhất một bước ⏸, agent nêu trong Hành động phải có trong Thực hiện và trong frontmatter `agents`). Không đụng orchestrator vì `risk` không đổi. Phần WF3/WF4/WF5 phụ thuộc skill/agent draft (`backend-db-migration`, `frontend-data-integrator`, `frontend-e2e-test-writer`) KHÔNG thuộc plan này vì installer ẩn workflow có closure chưa được offer.

**Tech Stack:** Markdown + YAML frontmatter (parser zero-dep của repo); harness `ok(cond, msg)` của repo (Node ≥ 20, ESM, zero dependency).

**Spec:** [docs/superpowers/specs/2026-09-29-skill-plugin-workflow-upgrade-design.md](../specs/2026-09-29-skill-plugin-workflow-upgrade-design.md) §3.2 (D7–D10), §5.3 (WF3, WF4, WF7), §5.2 (W-b), §9 (pha P2).

## Quyết định của plan (spec không nêu — người duyệt có thể đổi)

| # | Quyết định | Lý do |
|---|---|---|
| D-1 | security-review: regression test viết **trước** khi sửa (Bước 6, phải đỏ đúng lý do), sau đó Bước 7 sửa cho test xanh | Agent `*-test-writer` có nguyên tắc "test tái hiện bug phải đỏ đúng lý do trước khi báo"; viết sau khi sửa thì không chứng minh được test bắt đúng lỗ hổng |
| D-2 | security-review: bước Thu hồi secret (rotate) đặt sau kế hoạch remediation, **chặn tiến trình** tới khi người dùng xác nhận đã rotate (hoặc không có secret lộ) | Spec WF7: "bắt buộc bước rotate khi phát hiện secret lộ (người dùng thực hiện)"; workflow không có quyền rotate |
| D-3 | db-change: bước Test đặt **sau** bước chạy thử trên DB test (Bước 7), không đặt ngay sau Implement | Target DB đã được người dùng xác nhận ở Bước 5 trước khi test chạm DB; giảm đánh số lại |
| D-4 | api: chỉ thêm `engineering-quality-auditor` song song với kiểm drift (authorization, input validation), không thêm review correctness | Đúng WF4 của spec; review correctness của toàn diff đã có ở `workflow-code-review`/`workflow-feature` |
| D-5 | Bước sửa code vẫn ở session chính (W-b/Q2 để pha P3) | Spec Q2: chuyển sang implementer ở P3 |
| D-6 | Không sửa `workflows/orchestrator/WORKFLOW.md`; không đổi `risk` | Registry chỉ kiểm `risk` khớp frontmatter và tập id; cả hai không đổi |
| D-7 | Cập nhật cột agent ở `README.md` và `README_VI.md` cho 3 workflow | Hai bảng liệt kê agent theo frontmatter; không cập nhật sẽ lệch |

## Global Constraints

- Docs-only: KHÔNG sửa `cli/`, `adapters/`, `core/`, `plugins/`, `workflows/orchestrator/`, workflow khác ngoài 3 workflow nêu trên, `plugins/_published.json`.
- KHÔNG dùng agent/skill draft: cấm nhắc `frontend-data-integrator`, `frontend-e2e-test-writer`, `backend-db-migration`, `frontend-data-integration`, `frontend-e2e-testing` trong 3 workflow.
- Giữ nguyên `risk`, `tier`, `order`, `name`, `kind`, `requires` của cả 3 workflow.
- Khung bước theo `checkWorkflowBody`: mọi bước đủ 8 trường `Thực hiện`/`Đầu vào`/`Hành động`/`Ràng buộc`/`Đầu ra`/`Gate`/`Khi fail`/`Evidence`; đánh số liên tục; agent nêu trong `Hành động` chỉ khi có trong `Thực hiện` của cùng bước; agent trong `Thực hiện` phải có trong frontmatter `agents`.
- Không in/không yêu cầu in giá trị secret ở bất cứ bước nào; chỉ nêu tên/vị trí đã mask.
- Không thêm khẳng định về tiêu chuẩn bên ngoài (mã OWASP, số CWE) trong nội dung workflow; chỉ gọi tên vùng rủi ro.
- File UTF-8 không BOM, LF. Nội dung viết tiếng Việt có dấu. Comment chỉ giải thích *why*, tiếng Việt, 1–2 dòng.
- Chỉ thêm assert vào `test/validate.mjs` (khối "15." mới, sau khối "14."); không thêm file test mới; không sửa assert cũ.
- Nếu `validate` báo "ship references/ (parity)" hoặc "thiếu SKILL.md" thì chạy `npm run build` rồi chạy lại. Không `rm -rf` thư mục chứa junction [[windows-junction-rm-hazard]].
- Mỗi task = 1 commit qua skill `core:git-workflow` (header EN, body VI có dấu, commit bằng `git commit -F`, KHÔNG trailer `Co-Authored-By`). Push/PR/merge: chờ người dùng.
- `<scratchpad>` trong lệnh = thư mục tạm của phiên thực thi, nằm NGOÀI repo.

## File Structure

| File | Trách nhiệm | Task |
|---|---|---|
| `workflows/security-review/WORKFLOW.md` | +vùng rủi ro, +Bước 5 Thu hồi secret ⏸, +Bước 6 Regression test, đánh số lại 7–9 | 1 |
| `workflows/api/WORKFLOW.md` | Bước 4 chạy `backend-reviewer` ∥ `engineering-quality-auditor` | 2 |
| `workflows/db-change/WORKFLOW.md` | +Bước 7 Test, +Bước 8 Docs, Commit thành Bước 9 | 3 |
| `test/validate.mjs` | Khối "15.": hợp đồng 3 workflow | 1, 2, 3 |
| `README.md`, `README_VI.md` | Cột agent của WF06, WF07, WF08 | 1, 2, 3 |

---

### Task 0: Commit plan

**Files:**
- Commit: `docs/superpowers/plans/2026-09-30-workflow-major-fixes.md` (file này)

**Interfaces:**
- Consumes: branch `feature/frontend-data-integration` (nhánh đang làm).
- Produces: nhánh mà các task sau commit lên.

- [ ] **Step 1: Kiểm tra trạng thái**

Run: `git status --short && git branch --show-current`
Expected: chỉ file plan untracked; branch `feature/frontend-data-integration`.

- [ ] **Step 2: Stage và commit qua `core:git-workflow`**

Run: `git add docs/superpowers/plans/2026-09-30-workflow-major-fixes.md && git status --short`
Header đề xuất: `docs(specs): add workflow major fixes implementation plan`

---

### Task 1: `workflow-security-review` (D7, D8)

**Files:**
- Modify: `workflows/security-review/WORKFLOW.md`
- Modify: `README.md` (dòng `| WF06 | \`workflow-security-review\``), `README_VI.md` (cùng dòng)
- Test: `test/validate.mjs` (khối "15." mới, trước dòng `// ─────…` cuối file, sau khối "14.")

**Interfaces:**
- Consumes: `workflows` (module-level, `loadWorkflows()`), `parseSteps` (đã import ở `test/validate.mjs`), `ok`.
- Produces: khối "15." định nghĩa `wfBody(id)` mà Task 2, 3 dùng; workflow security-review 9 bước (Bước 5 = Thu hồi secret, Bước 6 = Regression test, Bước 7 = Sửa, Bước 8 = Re-scan, Bước 9 = Commit).

- [ ] **Step 1: Viết assert (failing)**

Chèn khối "15." vào `test/validate.mjs`, ngay sau khối "14." và trước dòng `// ─────…` cuối file:

```js
// 15. SOURCE: workflow — sửa lỗi major không phụ thuộc skill draft (spec 2026-09-29 §5.3 WF7, WF4, WF3; lỗi D7–D10)
{
  const wfBody = (id) => workflows.stages.find((s) => s.id === id);
  const noStep = { title: '', body: '', checkpoint: false };

  const sec = wfBody('workflow-security-review');
  const secSteps = sec ? parseSteps(sec.body) : [];
  const secStep = (n) => secSteps.find((s) => s.n === n) ?? noStep;
  ok(!!sec && ['engineering-quality-auditor', 'backend-test-writer', 'frontend-test-writer'].every((a) => sec.agents.includes(a)),
    'workflow-security-review: agents gồm auditor + 2 test-writer (regression test)');
  // D7: vùng rủi ro phải phủ authorization, SSRF và misconfiguration.
  ok(/authorization/.test(secStep(1).body) && secStep(1).body.includes('SSRF') && /misconfiguration/i.test(secStep(1).body),
    'workflow-security-review Bước 1: vùng rủi ro có authorization/access control, SSRF, security misconfiguration');
  // D8: secret lộ phải có bước rotate do người dùng thực hiện, đặt trước bước sửa code.
  ok(secStep(5).title.includes('Thu hồi secret') && secStep(5).checkpoint && /rotate/.test(secStep(5).body) && /người dùng/.test(secStep(5).body),
    'workflow-security-review Bước 5: bước Thu hồi secret (rotate) do người dùng thực hiện, có ⏸');
  ok(/Regression/i.test(secStep(6).title) && secStep(6).body.includes('agent `backend-test-writer`') && secStep(6).body.includes('agent `frontend-test-writer`'),
    'workflow-security-review Bước 6: regression test qua test-writer');
  ok(secSteps.length === 9 && secStep(7).title.startsWith('Sửa') && secStep(8).title.startsWith('Re-scan') && secStep(9).title.startsWith('Commit'),
    'workflow-security-review: 9 bước, Sửa ở Bước 7, Re-scan ở Bước 8, Commit ở Bước 9');
}
```

- [ ] **Step 2: Chạy, xác nhận đỏ đúng lý do**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-security-review|KẾT QUẢ"`
Expected: FAIL 5 assert của khối "15." (`agents gồm auditor + 2 test-writer`, `Bước 1: vùng rủi ro…`, `Bước 5: bước Thu hồi secret…`, `Bước 6: regression test…`, `9 bước…`); các assert khác (kể cả khung body của workflow) PASS.

- [ ] **Step 3: Sửa frontmatter, điều kiện tiên quyết, Bước 1, Bước 2**

Trong `workflows/security-review/WORKFLOW.md`:

(a) Thay dòng `agents: "engineering-quality-auditor"` bằng `agents: "engineering-quality-auditor,backend-test-writer,frontend-test-writer"`.

(b) Trong `description`, thay đúng cụm
`review/scan theo OWASP và các vùng rủi ro (auth/session, input, crypto/secrets, dependency, logging), validate finding bằng đọc lại file:line, lập kế hoạch remediation cùng người dùng, sửa, re-scan xác nhận hết blocker, rồi commit qua git-workflow.`
bằng
`review/scan theo OWASP và các vùng rủi ro (auth/session, authorization/access control, input, SSRF, crypto/secrets, dependency, misconfiguration, logging), validate finding bằng đọc lại file:line, lập kế hoạch remediation cùng người dùng, thu hồi (rotate) secret bị lộ do người dùng thực hiện, viết regression test tái hiện lỗ hổng, sửa, re-scan xác nhận hết blocker, rồi commit qua git-workflow.`

(c) Trong "Điều kiện tiên quyết", thay dòng
`- Skill/agent đã cài: \`engineering-quality-auditor\`, skill \`core/git-workflow\`.`
bằng
`- Skill/agent đã cài: \`engineering-quality-auditor\`, \`backend-test-writer\`, \`frontend-test-writer\` (chỉ phía có finding cần sửa), skill \`core/git-workflow\`.`

(d) Bước 1, thay đúng đoạn
```
- **Hành động:** xác định vùng rủi ro áp dụng cho phạm vi này trong tập {auth/session, input validation,
  crypto/secrets, dependency, logging}; loại vùng rõ ràng không áp dụng (vd không có input validation nếu
  không nhận input người dùng) và ghi lý do.
```
bằng
```
- **Hành động:** xác định vùng rủi ro áp dụng cho phạm vi này trong tập {auth/session, authorization/access
  control, input validation, SSRF, crypto/secrets, dependency, security misconfiguration, logging}; loại vùng
  rõ ràng không áp dụng (vd không có input validation nếu không nhận input người dùng; không có SSRF nếu
  không gọi URL do người dùng cung cấp) và ghi lý do.
```
và thay đúng dòng
`- **Gate:** danh sách vùng rủi ro áp dụng (auth/session, input, crypto/secrets, dependency, logging).`
bằng
`- **Gate:** danh sách vùng rủi ro áp dụng (auth/session, authorization/access control, input, SSRF, crypto/secrets, dependency, misconfiguration, logging).`

(e) Bước 2, thay đúng đoạn
```
- **Hành động:** review code theo từng vùng rủi ro áp dụng (STRIDE/OWASP); quét secret hardcode và dependency
  có CVE đã biết; mask giá trị secret thật trong mọi finding trước khi báo.
```
bằng
```
- **Hành động:** review code theo từng vùng rủi ro áp dụng (STRIDE/OWASP), gồm kiểm quyền theo vai trò/chủ sở
  hữu tài nguyên (authorization) và cấu hình mặc định không an toàn; quét secret hardcode và dependency có
  CVE đã biết; mask giá trị secret thật trong mọi finding trước khi báo; đánh dấu finding secret bị lộ để
  Bước 5 xử lý.
```

- [ ] **Step 4: Thay khối từ Bước 5 đến hết Definition of Done**

Trong `workflows/security-review/WORKFLOW.md`, thay toàn bộ đoạn từ dòng `### Bước 5 — Sửa` đến hết mục `## Definition of Done` (dòng cuối của mục là `- [ ] 0 finding \`blocker\` (hoặc blocker được người dùng chấp nhận rõ ràng, ghi trong \`remaining_risks\`)`) bằng nội dung sau. Giữ nguyên mục `## Report cuối` trở đi.

````markdown
### Bước 5 — Thu hồi secret ⏸

- **Thực hiện:** session chính
- **Đầu vào:** finding đã validate từ Bước 3 + danh sách finding người dùng chọn ở Bước 4
- **Hành động:** nếu có finding là secret bị lộ (đã nằm trong code, lịch sử git, log hoặc artifact), yêu cầu
  người dùng tự rotate/thu hồi secret đó tại hệ thống phát hành (cloud, IdP, database, dịch vụ ngoài) rồi xác
  nhận đã làm; coi secret là đã lộ kể cả khi sau này xoá khỏi code. Nếu không có finding secret bị lộ, ghi
  "không áp dụng".
- **Ràng buộc:** workflow không tự rotate, không gọi hệ thống bên ngoài, không đọc hay in giá trị secret (chỉ
  nêu tên/vị trí đã mask); không viết lại lịch sử git.
- **Đầu ra:** xác nhận của người dùng rằng secret đã được rotate, hoặc dòng "không áp dụng".
- **Gate:** người dùng xác nhận đã rotate mọi secret bị lộ, hoặc không có finding secret bị lộ.
- **Khi fail:** người dùng chưa rotate → dừng; secret vẫn coi là lộ, finding không được đóng, ghi vào
  `remaining_risks`.
- **Evidence:** trích dẫn xác nhận của người dùng (không kèm giá trị secret), hoặc dòng "không áp dụng".

### Bước 6 — Regression test (đỏ)

- **Thực hiện:** agent `backend-test-writer` ∥ agent `frontend-test-writer` (chỉ phía có finding cần sửa)
- **Đầu vào:** danh sách finding cần sửa từ Bước 4
- **Hành động:** với mỗi finding kiểm được bằng test (authorization, input validation, SSRF, logic), viết test
  tái hiện lỗ hổng và chạy trên code chưa sửa: test phải đỏ đúng lý do lỗ hổng. Finding không kiểm được bằng
  test (secret, dependency, cấu hình) ghi "không áp dụng" kèm lý do.
- **Ràng buộc:** chỉ viết test, không sửa code production; test không chứa giá trị secret thật và không gọi
  dịch vụ bên ngoài thật (SSRF dùng server giả cục bộ hoặc mock).
- **Đầu ra:** danh sách test regression đỏ đúng lý do + danh sách finding "không áp dụng" kèm lý do.
- **Gate:** mỗi test regression đỏ đúng lý do lỗ hổng, không đỏ vì lỗi của chính test.
- **Khi fail:** test xanh trên code chưa sửa (không bắt được lỗ hổng) hoặc đỏ vì lỗi test → sửa test, chạy lại;
  không nới assertion.
- **Evidence:** lệnh chạy test + exit code khác 0 + đoạn lỗi giải thích lý do đỏ.

### Bước 7 — Sửa

- **Thực hiện:** session chính
- **Đầu vào:** danh sách finding cần sửa từ Bước 4 + test regression từ Bước 6
- **Hành động:** sửa đúng finding đã chọn, phạm vi tối thiểu cần thiết; chạy lại build/test của phạm vi đã
  sửa, gồm test regression ở Bước 6 (phải chuyển từ đỏ sang xanh).
- **Ràng buộc:** không sửa ngoài phạm vi finding đã chọn; không chỉ che triệu chứng (vd log giảm chi tiết
  thay vì sửa lỗ hổng thật); không xoá hay nới test regression để qua.
- **Đầu ra:** code đã sửa, build/test xanh, test regression xanh.
- **Gate:** build/test xanh, gồm test regression.
- **Khi fail:** sửa xong vẫn đỏ → chẩn đoán lại, sửa tiếp, không bỏ qua.
- **Evidence:** lệnh build/test + exit code 0 (test regression đã từ đỏ sang xanh).

### Bước 8 — Re-scan

- **Thực hiện:** agent `engineering-quality-auditor`
- **Đầu vào:** code đã sửa từ Bước 7 + danh sách finding đã chọn sửa từ Bước 4
- **Hành động:** scan lại đúng vùng đã sửa để xác nhận finding đã chọn không còn; kiểm tra không phát sinh
  finding mới trong vùng vừa sửa.
- **Ràng buộc:** không tự đóng finding khi chưa scan lại xác nhận; finding chấp nhận rủi ro ở Bước 4 giữ
  nguyên trạng thái, không tính là blocker còn lại.
- **Đầu ra:** báo cáo finding đã sửa không còn xuất hiện; danh sách finding còn lại (nếu có) + trạng thái.
- **Gate:** finding đã sửa không còn; 0 finding `blocker` hoặc blocker được chấp nhận rõ ràng.
- **Khi fail:** finding đã sửa vẫn còn xuất hiện → quay lại Bước 7 sửa lại cho đúng.
- **Evidence:** danh sách finding sau re-scan + đối chiếu với danh sách đã sửa ở Bước 4.

### Bước 9 — Commit ⏸

- **Thực hiện:** skill `git-workflow`
- **Đầu vào:** diff sửa hoàn chỉnh đã qua Bước 1–8
- **Hành động:** tóm tắt finding đã sửa + finding được chấp nhận rủi ro (nếu có); đề xuất commit message
  Conventional Commits (header EN, body VI); trình diff cho người dùng duyệt.
- **Ràng buộc:** không tự commit khi người dùng chưa duyệt diff; không push trừ khi được yêu cầu; không commit
  kèm giá trị secret thật.
- **Đầu ra:** commit đã tạo (sau khi người dùng duyệt).
- **Gate:** người dùng duyệt diff.
- **Khi fail:** người dùng yêu cầu sửa thêm → quay lại bước tương ứng, không commit tạm.
- **Evidence:** hash commit + message.

## Checkpoint

| Sau bước | Người duyệt xem gì | Chỉ đi tiếp khi |
|---|---|---|
| 4 | Toàn bộ finding theo severity | Người dùng chọn finding cần sửa/chấp nhận rủi ro |
| 5 | Danh sách secret bị lộ (đã mask) và trạng thái rotate | Người dùng xác nhận đã rotate, hoặc không có secret bị lộ |
| 9 | Diff sửa hoàn chỉnh + test regression | Người dùng duyệt diff |

Commit/push/tag luôn qua `core:git-workflow` sau checkpoint cuối; agent không tự commit.

## Xử lý lỗi & rollback

| Tình huống | Hành động |
|---|---|
| Build fail | Chẩn đoán → sửa → build lại |
| Test fail | Phân tích failure → sửa code (không xoá/nới test) → chạy lại |
| Yêu cầu mơ hồ | Dừng, hỏi lại người dùng |
| Finding `blocker` | Chặn hoàn thành cho tới khi sửa hoặc người dùng chấp nhận rủi ro rõ ràng |
| Phát hiện secret chưa mask an toàn (Bước 2) | Dừng, báo người dùng xử lý thủ công secret trước khi tiếp tục |
| Người dùng chưa quyết định remediation (sau Bước 4 ⏸) | Dừng, chờ xác nhận, không tự sửa |
| Người dùng chưa rotate secret bị lộ (sau Bước 5 ⏸) | Dừng, coi secret là đã lộ, không đóng finding, ghi vào `remaining_risks` |
| Test regression không đỏ đúng lý do (Bước 6) | Sửa test, chạy lại; không nới assertion |
| Finding đã sửa vẫn còn sau re-scan (Bước 8) | Quay lại Bước 7 sửa lại cho đúng |
| Người dùng không duyệt diff (sau Bước 9 ⏸) | Không commit, quay lại bước người dùng yêu cầu sửa |

- **Điều kiện dừng:** phát hiện secret không xử lý được an toàn; người dùng không rotate secret bị lộ; người
  dùng không quyết định được remediation sau nhiều vòng; finding `blocker` không sửa được và người dùng không
  chấp nhận rủi ro; người dùng không duyệt diff.
- **Rollback:** trước checkpoint commit, chưa có gì để rollback (chưa commit); nếu người dùng huỷ giữa chừng,
  xoá thay đổi chưa commit bằng thao tác git thủ công của người dùng (workflow không tự `reset --hard`). Secret
  đã rotate không hoàn tác được và không cần hoàn tác.

## Definition of Done

- [ ] Danh sách vùng rủi ro áp dụng đã xác định — evidence: Bước 1
- [ ] Finding đã scan theo schema, secret đã mask — evidence: Bước 2
- [ ] Finding đã validate bằng đọc lại `file:line` — evidence: Bước 3
- [ ] Người dùng đã chọn finding cần sửa/chấp nhận rủi ro — evidence: Bước 4
- [ ] Secret bị lộ đã được người dùng rotate, hoặc không áp dụng — evidence: Bước 5
- [ ] Test regression đỏ đúng lý do trước khi sửa (hoặc "không áp dụng" kèm lý do) — evidence: Bước 6
- [ ] Build/test xanh sau khi sửa, gồm test regression — evidence: Bước 7
- [ ] Re-scan xác nhận finding đã sửa không còn — evidence: Bước 8
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 9
- [ ] Mọi gate có evidence `passed`
- [ ] 0 finding `blocker` (hoặc blocker được người dùng chấp nhận rõ ràng, ghi trong `remaining_risks`)
````

- [ ] **Step 5: Đồng bộ README**

Trong `README.md` và `README_VI.md`, thay đúng dòng
`| WF06 | \`workflow-security-review\` | 1 | high | W14 | quality-auditor |`
bằng
`| WF06 | \`workflow-security-review\` | 1 | high | W14 | quality-auditor, backend-test-writer, frontend-test-writer |`

- [ ] **Step 6: Chạy lại validate + build + toàn bộ**

Run: `npm run build 2>&1 | tail -3 && node test/validate.mjs 2>&1 | grep -E "workflow-security-review|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: build không lỗi; không còn FAIL chứa `workflow-security-review`; `KẾT QUẢ: <n> pass, 0 fail` (gồm `khung body hợp lệ`, `agent … có trong frontmatter agents`, `agent … nêu trong Hành động phải có trong Thực hiện` của workflow này); `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`; không có dòng `fail [1-9]`. Nếu một assert cũ đỏ → đọc assert, nêu nguyên nhân và BÁO trước khi sửa assert cũ.

- [ ] **Step 7: Rà bí mật và tên draft**

Run: `grep -nE "frontend-data-integrat|frontend-e2e|backend-db-migration" workflows/security-review/WORKFLOW.md`
Expected: không có kết quả.

- [ ] **Step 8: Commit qua `core:git-workflow`**

Stage: `workflows/security-review/WORKFLOW.md`, `README.md`, `README_VI.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add authz/SSRF areas, secret rotation and regression test to security-review`

---

### Task 2: `workflow-api` (D10)

**Files:**
- Modify: `workflows/api/WORKFLOW.md`
- Modify: `README.md` (dòng `| WF08 | \`workflow-api\``), `README_VI.md` (cùng dòng)
- Test: `test/validate.mjs` (thêm vào cuối khối "15.", trước dấu `}` đóng khối)

**Interfaces:**
- Consumes: `wfBody`, `parseSteps` trong khối "15." (Task 1).
- Produces: workflow-api Bước 4 do `backend-reviewer` ∥ `engineering-quality-auditor` thực hiện.

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "15." trong `test/validate.mjs`:

```js

  const api = wfBody('workflow-api');
  const apiStep4 = api ? parseSteps(api.body).find((s) => s.n === 4) ?? noStep : noStep;
  ok(!!api && api.agents.includes('engineering-quality-auditor'), 'workflow-api: agents có engineering-quality-auditor');
  // D10: DoD đòi 0 blocker nên phải có bước review bảo mật, không chỉ kiểm drift.
  ok(apiStep4.body.includes('agent `backend-reviewer`') && apiStep4.body.includes('agent `engineering-quality-auditor`')
    && /authorization/.test(apiStep4.body) && /input validation/.test(apiStep4.body),
    'workflow-api Bước 4: kiểm drift song song với auditor kiểm authorization + input validation');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-api|KẾT QUẢ"`
Expected: FAIL 2 assert `workflow-api: agents có engineering-quality-auditor` và `workflow-api Bước 4: …`; assert của Task 1 PASS.

- [ ] **Step 3: Sửa `workflows/api/WORKFLOW.md`**

(a) Thay dòng `agents: "backend-implementer,backend-test-writer,backend-reviewer"` bằng `agents: "backend-implementer,backend-test-writer,backend-reviewer,engineering-quality-auditor"`.

(b) Trong `description`, thay đúng cụm `kiểm drift contract↔code, tuỳ chọn sinh FE client` bằng `kiểm drift contract↔code song song với review authorization/input validation, tuỳ chọn sinh FE client`.

(c) Trong "Điều kiện tiên quyết", thay đúng đoạn
```
- Skill/agent đã cài: `backend-implementer`, `backend-test-writer`, `backend-reviewer`,
  skill `backend/backend-api-contract`, `core/git-workflow`.
```
bằng
```
- Skill/agent đã cài: `backend-implementer`, `backend-test-writer`, `backend-reviewer`,
  `engineering-quality-auditor`, skill `backend/backend-api-contract`, `core/git-workflow`.
```

(d) Thay toàn bộ Bước 4 (từ dòng `### Bước 4 — Kiểm drift` đến hết dòng `- **Evidence:** danh sách đối chiếu contract↔code trong report bước.`) bằng:

```markdown
### Bước 4 — Kiểm drift & bảo mật

- **Thực hiện:** agent `backend-reviewer` ∥ agent `engineering-quality-auditor`
- **Đầu vào:** contract + code + test đã qua Bước 1–3
- **Hành động:** `backend-reviewer` đối chiếu endpoint/DTO thực tế với contract (thiếu/thừa field, kiểu sai,
  endpoint lệch). `engineering-quality-auditor` review endpoint mới/đổi về authorization (mỗi endpoint có kiểm
  quyền theo vai trò/chủ sở hữu tài nguyên, không lộ dữ liệu của người khác) và input validation (ràng buộc
  trong schema contract được thực thi ở server); mask mọi secret nếu gặp.
- **Ràng buộc:** chỉ đọc, không tự sửa code; không in giá trị secret.
- **Đầu ra:** danh sách drift (nếu có) hoặc xác nhận 0 drift; danh sách finding bảo mật theo severity (contract
  đầu ra, `core:principles`).
- **Gate:** 0 drift contract↔code; 0 finding `blocker` về authorization/input validation.
- **Khi fail:** phát hiện drift → quay lại Bước 2 sửa code hoặc Bước 1 sửa contract; còn finding `blocker` bảo
  mật → quay lại Bước 2 sửa code; review lại phần đã sửa.
- **Evidence:** danh sách đối chiếu contract↔code + danh sách finding bảo mật (severity/category/location/evidence/confidence) trong report bước.
```

(e) Trong bảng "Xử lý lỗi & rollback", ngay sau dòng `| Phát hiện drift contract↔code (Bước 4) | Quay lại Bước 2 sửa code hoặc Bước 1 sửa contract |`, chèn dòng:
`| Finding \`blocker\` về authorization/input validation (Bước 4) | Quay lại Bước 2 sửa code, review lại phần đã sửa |`

(f) Trong "Definition of Done", thay dòng `- [ ] 0 drift contract↔code — evidence: Bước 4` bằng `- [ ] 0 drift contract↔code và 0 finding \`blocker\` về authorization/input validation — evidence: Bước 4`.

- [ ] **Step 4: Đồng bộ README**

Trong `README.md` và `README_VI.md`, thay đúng dòng có `| WF08 | \`workflow-api\``: đổi cột agent `backend-implementer, backend-test-writer, backend-reviewer |` thành `backend-implementer, backend-test-writer, backend-reviewer, quality-auditor |`; giữ nguyên các cột còn lại.

- [ ] **Step 5: Chạy lại validate + toàn bộ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-api|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]"`
Expected: không còn FAIL chứa `workflow-api`; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`; không có dòng `fail [1-9]`.

- [ ] **Step 6: Commit qua `core:git-workflow`**

Stage: `workflows/api/WORKFLOW.md`, `README.md`, `README_VI.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add security audit alongside drift check in workflow-api`

---

### Task 3: `workflow-db-change` (D9)

**Files:**
- Modify: `workflows/db-change/WORKFLOW.md`
- Modify: `README.md` (dòng `| WF07 | \`workflow-db-change\``), `README_VI.md` (cùng dòng)
- Test: `test/validate.mjs` (thêm vào cuối khối "15.", trước dấu `}` đóng khối)

**Interfaces:**
- Consumes: `wfBody`, `parseSteps`, `noStep` trong khối "15." (Task 1).
- Produces: workflow-db-change 9 bước (Bước 7 = Test, Bước 8 = Cập nhật data-model, Bước 9 = Commit).

- [ ] **Step 1: Viết assert (failing)**

Thêm vào cuối khối "15." trong `test/validate.mjs`:

```js

  const dbc = wfBody('workflow-db-change');
  const dbcSteps = dbc ? parseSteps(dbc.body) : [];
  const dbcStep = (n) => dbcSteps.find((s) => s.n === n) ?? noStep;
  // D9: đổi query/ORM/DTO mà không có bước test thì thay đổi schema không có lưới an toàn.
  ok(!!dbc && dbc.agents.includes('backend-test-writer'), 'workflow-db-change: agents có backend-test-writer');
  ok(/^Test/.test(dbcStep(7).title) && dbcStep(7).body.includes('agent `backend-test-writer`') && /Testcontainers/.test(dbcStep(7).body),
    'workflow-db-change Bước 7: bước Test qua backend-test-writer (integration, Testcontainers)');
  ok(/data-model\.md/.test(dbcStep(8).body) && /next_actions/.test(dbcStep(8).body),
    'workflow-db-change Bước 8: cập nhật data-model.md và ghi nợ contract vào next_actions');
  ok(dbcSteps.length === 9 && dbcStep(9).title.startsWith('Commit'), 'workflow-db-change: 9 bước, Commit ở Bước 9');
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node test/validate.mjs 2>&1 | grep -E "workflow-db-change|KẾT QUẢ"`
Expected: FAIL 4 assert của workflow-db-change; assert của Task 1, 2 PASS.

- [ ] **Step 3: Sửa frontmatter, điều kiện tiên quyết**

Trong `workflows/db-change/WORKFLOW.md`:

(a) Thay dòng `agents: "backend-implementer,backend-reviewer"` bằng `agents: "backend-implementer,backend-test-writer,backend-reviewer"`.

(b) Trong `description`, thay đúng cụm `review query/index, chạy thử migrate up/rollback/up trên DB test, rồi commit.` bằng `review query/index, chạy thử migrate up/rollback/up trên DB test, viết integration test cho query/repository bị ảnh hưởng, cập nhật data-model.md, rồi commit.`

(c) Trong "Điều kiện tiên quyết", thay dòng `- Skill/agent đã cài: \`backend-implementer\`, \`backend-reviewer\`, skill \`core/git-workflow\`.` bằng `- Skill/agent đã cài: \`backend-implementer\`, \`backend-test-writer\`, \`backend-reviewer\`, skill \`core/git-workflow\`.`

- [ ] **Step 4: Thêm Bước 7 (Test) và Bước 8 (Docs), đổi Commit thành Bước 9**

Trong `workflows/db-change/WORKFLOW.md`, ngay trước dòng `### Bước 7 — Commit ⏸`, chèn:

````markdown
### Bước 7 — Test

- **Thực hiện:** agent `backend-test-writer`
- **Đầu vào:** migration + code đã qua Bước 4–6 + nơi dùng đã xác định ở Bước 1
- **Hành động:** viết integration test cho repository/query bị ảnh hưởng: đọc/ghi qua schema mới; khi đang ở
  giai đoạn expand, kiểm code cũ vẫn đọc được dữ liệu. Dùng DB tạm (Testcontainers hoặc tương đương của
  project) hoặc đúng target đã xác nhận ở Bước 5; chạy test và ghi kết quả.
- **Ràng buộc:** không chạy trên DB production hay target chưa xác nhận; không sửa code production — bug thật
  thì giữ test đỏ và báo; không xoá/nới test để qua.
- **Đầu ra:** integration test cho query/repository bị ảnh hưởng, chạy được.
- **Gate:** integration test pass.
- **Khi fail:** lỗi do test → sửa test; lỗi do code hoặc migration → quay lại Bước 3 sửa, chạy lại từ Bước 4.
- **Evidence:** lệnh chạy test + exit code + số liệu pass/fail.

### Bước 8 — Cập nhật data-model & nợ contract

- **Thực hiện:** session chính
- **Đầu vào:** migration + code + test đã qua Bước 1–7
- **Hành động:** cập nhật `project-knowledge/data-model.md` (ERD) theo schema mới; nếu thay đổi theo
  expand/contract và còn pha contract chưa làm (xoá cột/ràng buộc cũ ở migration sau), ghi việc đó vào
  `next_actions` của report cuối kèm điều kiện thực hiện.
- **Ràng buộc:** chỉ sửa phần ERD/tài liệu liên quan tới thay đổi; không sửa vùng managed block của
  `AGENTS.md`/`CLAUDE.md`; không thực hiện pha contract trong workflow này.
- **Đầu ra:** `data-model.md` đã cập nhật (hoặc "không ảnh hưởng" kèm lý do) + nợ contract đã ghi vào
  `next_actions` (hoặc "không có").
- **Gate:** data-model cập nhật hoặc ghi "không ảnh hưởng"; nợ contract được ghi nếu có.
- **Khi fail:** không tìm thấy `data-model.md` → hỏi người dùng nơi lưu ERD, không tự tạo file mới.
- **Evidence:** đường dẫn file đã cập nhật + danh sách nợ contract (hoặc "không có").

````

Sau đó đổi tiêu đề `### Bước 7 — Commit ⏸` thành `### Bước 9 — Commit ⏸`, và trong phần Bước 9 thay dòng `- **Đầu vào:** migration + code đã qua Bước 1–6` bằng `- **Đầu vào:** migration + code + test + docs đã qua Bước 1–8`.

- [ ] **Step 5: Sửa Checkpoint, Xử lý lỗi, Definition of Done, Report**

(a) Checkpoint: thay dòng `| 7 | Diff migration + code | Người dùng duyệt diff |` bằng `| 9 | Diff migration + code + test + docs | Người dùng duyệt diff |`.

(b) Xử lý lỗi: thay `| Người dùng không duyệt diff (sau Bước 7 ⏸) |` bằng `| Người dùng không duyệt diff (sau Bước 9 ⏸) |`; và ngay sau dòng `| Một lượt migrate up/rollback/up thất bại (Bước 6) | … |` chèn dòng:
`| Integration test đỏ (Bước 7) | Lỗi test → sửa test; lỗi code/migration → quay lại Bước 3 (không nới test) |`

(c) Definition of Done: thay dòng `- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 7` bằng 3 dòng:
```
- [ ] Integration test cho query/repository bị ảnh hưởng pass — evidence: Bước 7
- [ ] `data-model.md` cập nhật (hoặc "không ảnh hưởng"); nợ contract ghi vào `next_actions` — evidence: Bước 8
- [ ] Người dùng đã duyệt diff và commit đã tạo — evidence: Bước 9
```

(d) Report cuối: thay dòng `  next_actions: []` bằng `  next_actions: []         # gồm migration pha contract còn nợ (xoá cột/ràng buộc cũ ở đợt sau)`.

- [ ] **Step 6: Đồng bộ README**

Trong `README.md` và `README_VI.md`, thay đúng dòng
`| WF07 | \`workflow-db-change\` | 2 | high | W15 | backend-implementer, backend-reviewer |`
bằng
`| WF07 | \`workflow-db-change\` | 2 | high | W15 | backend-implementer, backend-test-writer, backend-reviewer |`

- [ ] **Step 7: Chạy lại validate + build + toàn bộ + rà tên draft**

Run: `npm run build 2>&1 | tail -3 && node test/validate.mjs 2>&1 | grep -E "workflow-db-change|KẾT QUẢ" ; npm test 2>&1 | grep -E "KẾT QUẢ|TEST:|fail [1-9]" ; grep -nE "frontend-data-integrat|frontend-e2e|backend-db-migration" workflows/db-change/WORKFLOW.md workflows/api/WORKFLOW.md workflows/security-review/WORKFLOW.md`
Expected: build không lỗi; không còn FAIL chứa `workflow-db-change`; `KẾT QUẢ: <n> pass, 0 fail`; `INSTALL TEST … 0 fail`, `WIZARD TEST … 0 fail`; không có dòng `fail [1-9]`; `grep` cuối không in gì.

- [ ] **Step 8: Commit qua `core:git-workflow`**

Stage: `workflows/db-change/WORKFLOW.md`, `README.md`, `README_VI.md`, `test/validate.mjs`.
Header đề xuất: `fix(workflows): add integration test and data-model steps to db-change`

---

## Ngoài plan này

- WF3 phần dùng `backend-db-migration` (Bước 2/3/6, verify-cycle theo công cụ), WF4 Bước 5 → `frontend-data-integrator`, WF5 (Bước 3b, e2e), WF6 (`frontend-e2e-test-writer`): chờ pha publish (spec §9 P1b/P1c) vì installer ẩn workflow có closure chưa được offer.
- WF8 (release Bước 0 baseline), WF9 (code-review nhóm "khác"), WF10 (orchestrator registry), WF11 (Bước 0 baseline chung), WF12: P2/P3 còn lại, làm ở plan sau.
- Chuyển bước sửa code ở session chính sang agent implementer (W-b, spec Q2): P3.
- Cập nhật `CHANGELOG.md`: thuộc lần phát hành.
