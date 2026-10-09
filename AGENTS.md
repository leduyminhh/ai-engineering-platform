# AGENTS.md

Common, provider-agnostic execution baseline for AI coding agents (Claude Code, Cursor, Codex,
Antigravity). This file holds **only the shared baseline** — project-specific rules live in each
tool's project file (e.g. `CLAUDE.md`), which references this baseline.

<!-- AI-ENGINEERING:BEGIN AGENTS_BASELINE -->
## AI Engineering Baseline

Read this file before any task.

### Priority (resolve all conflicts in this order)

1. User request → 2. Project-specific rules (e.g. `CLAUDE.md`) → 3. This baseline (`AGENTS.md`)
   → 4. Tool/skill instructions → 5. General AI knowledge

If rules conflict with each other, choose the **safest change that still satisfies the user
request**, and state the assumption.

### Rules

1. **Read before writing.** Inspect the relevant code/config/tests (and this file) before editing.
   Don't bulk-scan protected paths or external references.
2. **Surgical changes.** Smallest clear change that satisfies the request; touch only files for the
   current goal; preserve unrelated user work. No new abstraction unless it removes real complexity
   or matches an existing pattern.
3. **Match conventions.** Follow local naming/layout/validation/commit/protected-path rules before
   introducing a new one.
4. **Surface conflicts.** When instructions/configs/tests disagree, name the conflict and resolve by
   Priority; ask only when the decision is **risky** (irreversible, outward-facing, destructive) and
   cannot be inferred.
5. **Verify intent.** Run deterministic validation (validators, selected tests) proving the requested
   *behavior/invariant*, not just that code runs.
6. **Fail loud.** No completion claim without evidence. Report blockers, skipped checks, uncertainty,
   and residual risk. Never present unverified output as fact.
7. **Comments are documentation, not narration.** Follow **Comments** below. Never narrate what the
   code already expresses; explain *why* only when the gate passes.

> **Long / ambiguous tasks:** define the success condition up front; checkpoint after
> plan/edit/verify/publish; prefer targeted reads over broad scans.

### Comments

Assume the reader is an experienced engineer. Do not teach the language, framework, or API. Only
document domain knowledge, design decisions, assumptions, invariants, or non-obvious behavior that
cannot be inferred from the code itself.

**Add a comment only when at least one is true:**

- The business rule cannot be inferred from the code.
- The implementation is intentionally non-obvious.
- A workaround exists because of an external limitation or bug.
- A specific assumption or invariant must always hold.
- The code prevents a subtle bug that is easy to reintroduce.
- A complex algorithm or optimization would take significantly longer to understand than reading a
  short explanation.

**Do not comment:**

- What the code already expresses (assignments, loops, ifs, method calls, obvious details).
- Framework or language features.
- TODOs unless the user explicitly requested them.

**Quality gate — before adding a comment, all three must pass:**

1. Can a senior engineer understand this code without the comment? → Yes → do not comment.
2. Does the comment explain *why* instead of *what*? → No → do not comment.
3. If the comment is removed, will maintainability decrease? → No → do not comment.

Every comment explains **why**, never **what**. Write in Vietnamese with correct diacritics; keep
1–2 lines, technical, and neutral. Delete redundant or outdated comments instead of adding new ones.

### Testing

Every test must catch a real defect that no other test catches; the suite must not grow with the
number of review rounds.

**Write:**

- **One behavior — one test, at the lowest layer that can catch the defect.** Unit for pure logic;
  integration only when the behavior needs a real DB, broker, HTTP, or framework wiring. Never assert
  the same thing at two layers.
- **Many inputs of one behavior → one parameterized test.**
- **Every fixed bug → one regression test** reproducing it, at the lowest layer that can.
- **Cross-component contracts** (schemas, HTTP JSON, shared vectors) are tested on both sides from one
  shared source, not hand-copied.

**Do not write:**

- Tests that only re-assert a mock they just configured.
- Tests pinned to implementation details: internal call order, log wording, private names.
- Tests for cases the type system or a boundary invariant already makes impossible.
- Tests pinning documentation prose — except operational contracts (commands, env var names,
  thresholds an operator must use).
- Duplicates of a behavior already caught at the same or a lower layer.

**Protected — never delete when pruning** without naming the test that still covers the behavior:
security checks (auth/permission matrices, input/URL validation, no secrets in logs), money/data
invariants (idempotency, outbox, retention), schema/contract tests, and regression tests for named bugs.

**Process:**

- A review finding like "coverage could be broader" is **Minor** and does not become work by itself;
  add a test only when the finding names a concrete defect no test catches. Fix rounds add regression
  tests only for Critical/Important fixes.
- While working, run targeted tests. At the end of a feature, run the **full suites of every touched
  component plus its dependents** — select by component, never by individual test class (shared
  fixtures, wiring and config break tests far from the edited file). If the project ships an
  affected-tests script or mapping, use it.
- Run the full suite **once** after the last fix round, not after every round.
- No fixed `sleep` in tests; wait on a condition with the shortest stable timeout. Avoid test
  configuration that forces a new framework context/container per class.

### Safety — never act without explicit confirmation

- **Don't push to protected branches** (`main`/`master`/`dev`/`develop`). Work on a feature branch;
  leave the diff/PR for human review.
- **Don't run destructive or schema-changing operations** (migration/DDL, data deletion, `reset --hard`,
  force-push, history rewrite) without explicit confirmation.
- **Don't read, print, or modify secret files** (`.env`, `*.env`, credentials, `*.jks`/`*.keystore`,
  key material).
- **Stop for human diff review before committing** (1 task = 1 commit).
- **Don't add `Co-authored-by` / `Co-Authored-By` lines** (or assistant attribution) to commit
  messages, PR bodies, or tag/release notes.

> The project file may add more specific boundaries (e.g. generated dirs, source-of-truth paths).

### Command routing (if the tool supports commands/workflows)

Prefer an installed command/workflow entry point over ad-hoc skill choice. Treat a command file as
an *orchestration contract* (intent → required skills → steps → output). If none matches, fall back
to the most specific skill and **say so**.

> The catalog path is **tool-specific**, defined by the provider (e.g. Codex:
> `.codex/workflows/commands.md`). Other tools ignore this line.

### Language

- User-facing output in **Vietnamese** with correct UTF-8 diacritics: PR/MR descriptions, release
  notes, user docs, and the Vietnamese body of commit messages.
- Commit header stays `type(scope): summary`; follow the repo's existing header language.
- Code identifiers, this baseline file, and config keys stay in **English**.

### Definition of Done (affirm before claiming complete)

- Relevant files were read before editing.
- Edits are limited to the requested scope; unrelated work preserved.
- Validators/tests ran after any code/config/structure/doc change (state results); skipped checks
  and residual risk reported.
- Conflicts, assumptions, and uncertainty surfaced.
<!-- AI-ENGINEERING:END AGENTS_BASELINE -->
