# Kế hoạch: chế độ nhúng
- Design: [design.md](design.md)
- Nhánh: `feature/eval-hooks-pins-skills`

**Goal:** thêm mục "Chế độ nhúng" vào contract đầu ra, con trỏ ở mọi agent và contract kiểm chúng.

**Spec:** design.md

### Task 1: Mục "Chế độ nhúng", con trỏ ở agent và contract
**Kind:** DOCS
**Phủ AC:** AC1.1, AC1.2
**Files:**
- Modify: `core/principles/workflow-output-contract.md`, `plugins/*/agents/*.md`, `docs/specs/workflows/spec.md`, `core/.manifest.json`, `plugins/backend/.manifest.json`, `plugins/data/.manifest.json`, `plugins/engineering/.manifest.json`, `plugins/frontend/.manifest.json`, `plugins/ops/.manifest.json`
- Test: `test/contract/10-source.contract.mjs`

- [ ] **Step 1:** Viết mục, thêm con trỏ vào 16 agent, thêm assert AC1.1 và AC1.2 vào contract, thêm `workflows/R11` và dòng lịch sử vào spec, bump version.
- [ ] **Step 2:** `npm run build`, `node cli/lib/versions.mjs --lock`, `node test/validate.mjs --build`, rồi `node core/skills/artifact-templates/scripts/check-request.mjs docs/requests/2026-10-29-embedded-mode/`. Mong đợi: 0 fail, 0 cảnh báo.
- [ ] **Step 3: Commit** `feat(core): add embedded mode rule for agents running skills`.
