# Kế hoạch: aip statusline
- Design: [design.md](design.md)
- Nhánh: `feature/eval-hooks-pins-skills`

**Goal:** thêm lệnh `aip statusline` in một dòng trạng thái bám ngưỡng context và cache của baseline.

**Spec:** design.md

### Task 1: Lệnh aip statusline
**Kind:** TOOLING
**Phủ AC:** AC1.1, AC1.2, AC1.3, AC1.4
**Files:**
- Create: `cli/lib/statusline.mjs`, `test/statusline.test.mjs`
- Modify: `cli/index.mjs`, `cli/lib/args.mjs`, `package.json`, `completions/aip.bash`, `completions/aip.zsh`, `README.md`, `README_VI.md`, `CLAUDE.md`, `CHANGELOG.md`, `docs/specs/cli-wizard/spec.md`
- Test: `test/statusline.test.mjs`

- [ ] **Step 1:** Viết `renderStatusline`, cờ `--soft`/`--hard`/`--no-color` trong `parse()`, nhánh `statusline` trong `cli/index.mjs`, test; thêm test vào script `npm test`.
- [ ] **Step 2:** Cập nhật help, completions, README (EN/VI), CLAUDE.md, CHANGELOG, spec `cli-wizard/R5`.
- [ ] **Step 3:** `node test/statusline.test.mjs`, `node test/args.test.mjs`, `npm test`, `check-request.mjs`. Mong đợi: 0 fail, 0 cảnh báo.
- [ ] **Step 4: Commit** `feat(cli): add aip statusline for context and cache thresholds`.
