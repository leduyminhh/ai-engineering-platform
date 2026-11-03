# Sửa 11 lỗi Must-fix của audit Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** mỗi lỗi Must-fix có test đỏ rồi xanh, một commit mỗi mục, `npm test` xanh một lần ở cuối.
**Architecture:** sửa nhỏ tại shared code của từng lỗi; không thêm abstraction mới ngoài các seam test (`npmPackInvocation`, `isMainModule`, `planManagedBlock`, `tracked`).
**Tech Stack:** Node 20 ESM zero dependency; test harness `ok()` của `test/validate.mjs` và `node:test` cho pack-guard.
**Spec:** design.md
**Requirement:** không có

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `core/hooks/scripts/guard-bash.mjs` | mở rộng shell bọc, nối dòng, refspec biến, ghi file cấu hình | Task 1, Task 2, Task 10 |
| `core/hooks/scripts/guard-files.mjs` | hỏi khi ghi cấu hình của guard | Task 2 |
| `cli/lib/pack-guard.mjs` | spawn đúng nền, so entry point | Task 3 |
| `cli/lib/args.mjs` | cờ thiếu giá trị | Task 4 |
| `cli/lib/install.mjs` | manifest, thứ tự cài, managed block | Task 5, Task 6, Task 7 |
| `core/skills/plan-execution/scripts/workspace.mjs`, `autonomy.mjs`, `cli/lib/status.mjs`, `core/hooks/scripts/gate-config.mjs` | gốc repo chính trong submodule | Task 8 |
| `core/skills/plan-execution/scripts/ledger.mjs` | định dạng dòng ledger | Task 9 |
| `core/hooks/scripts/session-start.mjs` | handoff đã commit, nhãn dữ liệu | Task 11 |
| `test/contract/97-audit-mustfix.contract.mjs`, `test/args.test.mjs`, `test/install.test.mjs`, `test/pack-guard.test.mjs` | test đỏ → xanh | mọi task |
| `docs/specs/hooks-gates/spec.md`, `docs/specs/install-lifecycle/spec.md`, `core/.manifest.json`, `plugins/_versions.lock.json` | spec sống, version | Task 12 |

## Global Constraints
Một commit mỗi task qua `core:git-workflow` (header EN, body VI có dấu, `-F`, không `Co-Authored-By` theo AGENTS.md); không push, không merge. Không sửa `core/skills/plan-execution/references/ask-user.md`. Comment mới viết tiếng Việt, chỉ nêu lý do.
## Review Focus
Hook fail-open giữ nguyên (lỗi nội bộ không chặn phiên); không hỏi nhầm lệnh git vô hại (test 90/94 hiện có); Windows và POSIX.

### Task 1: Push bọc trong shell/eval (#1)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC1.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: danh sách đoạn lệnh đã mở rộng dùng cho mọi kiểm tra trong `decide`

- [x] **Step 1:** chạy test #1 đỏ, thêm `expandShells`, chạy xanh, commit.

### Task 2: Ghi cấu hình của guard (#2)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC2.1, AC2.2
**Files:**
- Modify: `core/hooks/scripts/guard-files.mjs`
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, sửa hai hook, xanh, commit.

### Task 3: pack-guard (#3)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC3.1, AC3.2
**Files:**
- Modify: `cli/lib/pack-guard.mjs`
- Test: `test/pack-guard.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `npmPackInvocation(platform)`, `isMainModule(metaUrl, argv1)`

- [x] **Step 1:** test đỏ, sửa, xanh, commit.

### Task 4: Cờ CLI thiếu giá trị (#4)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC4.1
**Files:**
- Modify: `cli/lib/args.mjs`
- Test: `test/args.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, sửa, xanh, commit.

### Task 5: Manifest hỏng và ghi nguyên tử (#5)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC5.1
**Files:**
- Modify: `cli/lib/install.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, sửa `readManifest`/`writeManifest`, xanh, commit.

### Task 6: Cài dở khi managed block hỏng (#6)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC6.1
**Files:**
- Modify: `cli/lib/install.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: không có
- Produces: `planManagedBlock(root, rels)`

- [x] **Step 1:** test đỏ, sửa, xanh, commit.

### Task 7: Managed block xuyên symlink (#7)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC7.1
**Files:**
- Modify: `cli/lib/install.mjs`
- Test: `test/install.test.mjs`

**Interfaces:**
- Consumes: `planManagedBlock` của Task 6
- Produces: không có

- [x] **Step 1:** test đỏ, sửa, xanh, commit.

### Task 8: Gốc repo chính trong submodule (#8)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC8.1
**Files:**
- Modify: `core/skills/plan-execution/scripts/workspace.mjs`
- Modify: `core/skills/plan-execution/scripts/autonomy.mjs`
- Modify: `cli/lib/status.mjs`
- Modify: `core/hooks/scripts/gate-config.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, sửa bốn bản, xanh, commit.

### Task 9: Định dạng dòng ledger (#9)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC9.1
**Files:**
- Modify: `core/skills/plan-execution/scripts/ledger.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, thêm `EVENT_FORMATS` và kiểm dòng trống, xanh, commit.

### Task 10: Nối dòng và refspec biến (#10)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC10.1
**Files:**
- Modify: `core/hooks/scripts/guard-bash.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, sửa, xanh, commit.

### Task 11: Handoff đã commit (#11)
**Kind:** TOOLING
**TDD:** có
**Phủ AC:** AC11.1
**Files:**
- Modify: `core/hooks/scripts/session-start.mjs`
- Test: `test/contract/97-audit-mustfix.contract.mjs`

**Interfaces:**
- Consumes: không có
- Produces: không có

- [x] **Step 1:** test đỏ, sửa, xanh, commit.

### Task 12: Spec sống, version, full suite
**Kind:** DOCS
**Phủ AC:** AC1.1, AC2.1, AC2.2, AC3.1, AC3.2, AC4.1, AC5.1, AC6.1, AC7.1, AC8.1, AC9.1, AC10.1, AC11.1
**Files:**
- Modify: `docs/specs/hooks-gates/spec.md`
- Modify: `docs/specs/install-lifecycle/spec.md`
- Modify: `core/.manifest.json`
- Modify: `plugins/_versions.lock.json`

**Interfaces:**
- Consumes: mọi task trước
- Produces: không có

- [x] **Step 1:** cập nhật spec theo `## Ảnh hưởng spec`, `npm run build`, bump `core`, `node cli/lib/versions.mjs --lock`, `check-request.mjs`, `npm test` một lần.
