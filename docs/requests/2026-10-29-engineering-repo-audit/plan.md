# Kế hoạch: engineering-repo-audit
- Design: [design.md](design.md)
- Nhánh: `feature/eval-hooks-pins-skills`

**Goal:** thêm skill `engineering-repo-audit` chỉ đọc và bước đọc caller/callee trong hai skill review, kèm một case eval.

**Spec:** design.md

### Task 1: Skill engineering-repo-audit
**Kind:** DOCS
**Phủ AC:** AC1.1
**Files:**
- Create: `plugins/engineering/skills/engineering-repo-audit/SKILL.md`, `plugins/engineering/skills/engineering-repo-audit/references/hotspot-ranking.md`, `plugins/engineering/skills/engineering-repo-audit/references/audit-axes.md`, `plugins/engineering/skills/engineering-repo-audit/references/audit-report-template.md`
- Modify: `plugins/_cowork.json`, `plugins/engineering/.manifest.json`, `CLAUDE.md`, `test/content/13-task-breakdown.pin.mjs`
- Test: `test/contract/10-source.contract.mjs`

- [ ] **Step 1:** Viết SKILL.md và ba file references theo design; cập nhật manifest (9 skill, bump), `_cowork.json`, CLAUDE.md; bỏ pin cứng "8 skill" vì contract `10-source` đã kiểm mô tả liệt kê đủ skill.
- [ ] **Step 2:** `npm run build`, `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`. Mong đợi: 0 fail.
- [ ] **Step 3: Commit** `feat(engineering): add engineering-repo-audit skill`.

### Task 2: Đọc caller/callee trong hai skill review
**Kind:** DOCS
**Phủ AC:** AC2.1
**Files:**
- Modify: `plugins/backend/skills/backend-code-review/references/review-dimensions.md`, `plugins/frontend/skills/frontend-code-review/references/review-dimensions.md`, `plugins/backend/.manifest.json`, `plugins/frontend/.manifest.json`
- Test: `test/contract/10-source.contract.mjs`

- [ ] **Step 1:** Thêm mục "Đọc phần liên quan" vào hai file; thêm một assert trong contract kiểm cả hai file có mục này; bump version hai plugin.
- [ ] **Step 2:** build + lock + validate. Mong đợi: 0 fail.
- [ ] **Step 3: Commit** `feat(review): read callers and callees of changed public symbols`.

### Task 3: Case eval repo-audit-readonly
**Kind:** TOOLING
**Phủ AC:** AC1.2, AC1.3
**Files:**
- Create: `evals/engineering/repo-audit-readonly/prompt.md`, `evals/engineering/repo-audit-readonly/case.yaml`, `evals/engineering/repo-audit-readonly/scaffold.sh`, `evals/engineering/repo-audit-readonly/graders/*.md`
- Modify: `evals/README.md`, `evals/README_VI.md`
- Test: `evals/engineering/repo-audit-readonly/graders/seeded-found.md`, `evals/engineering/repo-audit-readonly/graders/coverage-disclosed.md`, `test/contract/95-evals.contract.mjs`

- [ ] **Step 1:** Viết scaffold gài 3 vấn đề (nối chuỗi SQL, module thanh toán không test, vòng lặp N+1) và graders: skill-used, no-edit, no-write, finding-has-file-line, seeded-found, not-absolute-claim.
- [ ] **Step 2:** `node test/validate.mjs --build --only evals`, rồi `node scripts/eval-run.mjs --plugin engineering --max-cost-usd 2.5 --runs 3 --scaffold --case repo-audit-readonly`. Ghi n, chi phí, Δ và nhãn loại Δ vào README.
- [ ] **Step 3: Commit** `test(evals): add repo-audit-readonly case`.
