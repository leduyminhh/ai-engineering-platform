<!-- artifact-template
type: plan
version: 1
validator: scripts/check-request.mjs
sources: skill core plan-execution (header trỏ cách thực thi plan); docs/requests/2026-10-20-superpowers-docs-standard/design.md §4.2; docs/requests/2026-10-23-workflow-self-sufficient/design.md (R7)
Bỏ khối này khi chép template ra dùng.
-->

# <Tên> Implementation Plan

> **For agentic workers:** thực thi plan này bằng skill `plan-execution` (bản cài plugin: `core:plan-execution`), từng task theo vòng task. Step dùng checkbox (`- [ ]`) để theo dõi.

**Goal:** <...>
**Architecture:** <...>
**Tech Stack:** <...>
**Spec:** design.md
**Requirement:** <requirement.md | không có>

## Bản đồ file
| File | Trách nhiệm | Task |
|---|---|---|
| `<path>` | <một trách nhiệm> | <Task 1> |

## Global Constraints
<...>
## Review Focus
<...>

### Task 1: <tên>
**Kind:** <BE|FE-UI|FE-INT|E2E|DB|CT|DOCS|TOOLING>
**Phủ AC:** <AC1.1, AC1.2>
**Files:**
- Create: `<path>`
- Modify: `<path>`
- Test: `<path>`

**Interfaces:**
- Consumes: <hàm/kiểu/endpoint task trước tạo ra, hoặc "không có">
- Produces: <hàm/kiểu/endpoint task sau sẽ dùng, hoặc "không có">

- [ ] **Step 1:** <...>
