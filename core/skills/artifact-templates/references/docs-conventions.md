# Docs conventions

Moved verbatim from the `### Workflow defaults` section of the AI Engineering baseline (`AGENTS.md`), which keeps a pointer to this file.

#### Docs location and format

- Write the spec to `docs/requests/<yyyy-mm-dd>-<slug>/design.md` (skill `engineering-spec-writing`)
  and the plan to `plan.md` in the same folder (skill `engineering-plan-writing`).
- A large request may be split into parts: `design.md` has a `## Bảng part`, and each part has its own plan in
  `parts/<nn>-<part-slug>/plan.md`; the root `plan.md` is optional and holds the base work that runs before any part.
- Use `docs/requests/_TEMPLATE/` only when it contains `design.md`; otherwise use the templates of
  the `artifact-templates` skill (a legacy `_TEMPLATE` may still serve `requirement.md`). `aip init` never
  overwrites it; to get the new templates, delete the old `_TEMPLATE` and re-run `aip init --full`.
- Acceptance criteria: `AC<n>.<m>` IDs (`<n>` = requirement number), written as Given/When/Then.
  They live under a heading containing `Tiêu chí chấp nhận`, in `requirement.md` if it exists, otherwise in
  `design.md`, as bullets `- [ ] **AC<n>.<m>** — Given … When … Then …`. Each plan task lists the ones it
  covers in a `**Phủ AC:**` line (no leading bullet). A bugfix spec has a `Không đổi` section (behavior that
  must stay as is).
- A test that covers an AC names its ID in the test name or a comment (`AC1.2`; Python function names use
  `ac1_2`). Each plan task lists its test files in `**Files:**` as `- Test:` bullets, the path in backticks.
- After writing `design.md` and again after `plan.md`, run
  `node <artifact-templates skill dir>/scripts/check-request.mjs docs/requests/<yyyy-mm-dd>-<slug>/`.
  It also warns about an AC that none of the plan's test files mention. It only warns (exit 0) unless run
  with `--strict` (exit 1 on any warning, for CI). Right after the plan, W9 (listed test file does not exist
  yet) is expected and W7 is skipped: never delete `**Files:**` or test entries to silence them. Re-run once
  the tests are written, and use `--strict` in CI only from then on.
- `design.md` has a `## Ảnh hưởng spec` section: one line `- <capability>: thêm|đổi|bỏ R<n>` per affected
  capability, or `Không ảnh hưởng: <reason>`. An older `docs/requests/_TEMPLATE/design.md` may lack it; add the
  section by hand, since the validator warns (W10) when it is missing. W23 warns when the design says
  `Không ảnh hưởng` but the repo has no `docs/specs/README.md`: declare the capability or run `engineering-spec-backfill`.
- Merge step: update `docs/specs/<capability>/spec.md` as the design's `## Ảnh hưởng spec` section says
  (add, edit or strike through requirements `<capability>/R<n>`, add a row to the spec's history table; if you
  created a new capability, also add it to `docs/specs/README.md`, the entry point: a capability table, a docs map
  and the `aip status --requests` command, never a table of open requests; template `specs-readme.template.md`), then run `check-request.mjs` (with
  `--base <ref>` in CI). Do this before finishing the branch (`plan-execution`).

#### Memory and resume

| Type | Scope | Stored in | Updated by |
|---|---|---|---|
| Short-term | One change, spec to merge | `docs/requests/<yyyy-mm-dd>-<slug>/`, ledger `.aip/runs/<request>/<part>/progress.md` (git-ignored, at the main repo root) | Agent, while working |
| Long-term | Whole project | `project-knowledge/`, `docs/decisions/`, `docs/contracts/`, `docs/specs/`, `AGENTS.md`/`CLAUDE.md` | Human reviewer; agent only proposes |

- Resume a change that already has a folder: read `design.md`, `plan.md` and the ledger; continue from
  the first task with no `complete` line (the `session-start` hook injects the ledger tail);
  never create a second folder, design or plan for the same change.
- Knowledge that outlives the change (architecture decision, convention) → propose it to long-term
  memory instead of leaving it only in `design.md`.
