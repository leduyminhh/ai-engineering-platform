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
- **`full` permission mode is an owner opt-in.** When `.claude/aip-gate.json` has `mode: "full"` and the
  session runs in `bypassPermissions`, the project owner allowed unattended access inside that project:
  the `settings.json` `ask` rules (push, network, deploy), its `deny` rules for secrets (such as `.env`
  reads) and the hook confirmations for secret files inside the project are dropped, writes stay confined to the project roots (heuristic, not a
  sandbox), and a push to a protected branch still needs confirmation unless `fullKeep` is changed.
- **Stop for human diff review before integrating.** On a feature branch, commit each task without
  pausing (each task ends with at least one commit; fix rounds may add more); the human reviews the whole branch diff before merge or push. On a
  protected branch, stop before every commit.
- **Don't add `Co-authored-by` / `Co-Authored-By` lines** (or assistant attribution) to commit
  messages, PR bodies, or tag/release notes.

> The project file may add more specific boundaries (e.g. generated dirs, source-of-truth paths).

### Command routing (if the tool supports commands/workflows)

Prefer an installed command/workflow entry point over ad-hoc skill choice. Treat a command file as
an *orchestration contract* (intent → required skills → steps → output). If none matches, fall back
to the most specific skill and **say so**.

> The catalog path is **tool-specific**, defined by the provider (e.g. Codex:
> `.codex/workflows/commands.md`). Other tools ignore this line.

### Workflow defaults

Spec/design approval and plan approval stay human gates; these defaults remove only the prompts after
them. They apply when the aip workflows and skills are installed.

- Route by request: a feature → `workflow-feature`; a bugfix → `workflow-bugfix`. Clarification and
  `design.md` come from `workflow-feature` steps 2–3 (skill `engineering-spec-writing`); the plan comes
  from skill `engineering-plan-writing`.
- Execution: skill `plan-execution` (a task loop with a review per task); do not ask again how to
  execute once the plan is approved.
- Commit each task on a feature branch without pausing (see **Safety**); the human reviews the whole
  branch diff before merge or push.
- Before finishing, run the full suites of every touched component (see **Testing**).
- Finishing the branch: default to "Keep the branch as-is"; merge or push only after the human
  confirms.

#### Docs location and format

- Write the spec to `docs/requests/<yyyy-mm-dd>-<slug>/design.md` (skill `engineering-spec-writing`)
  and the plan to `plan.md` in the same folder (skill `engineering-plan-writing`).
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
  section by hand, since the validator warns (W10) when it is missing.
- Merge step: update `docs/specs/<capability>/spec.md` as the design's `## Ảnh hưởng spec` section says
  (add, edit or strike through requirements `<capability>/R<n>`, add a row to the spec's history table; if you
  created a new capability, also add it to `docs/specs/README.md`), then run `check-request.mjs` (with
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

### Agents in CI

(Claude Code. Facts are [Unverified] secondary summaries of [headless](https://code.claude.com/docs/en/headless).)

- Run `claude -p` with `--permission-mode dontAsk`, an explicit `--allowedTools` list, `--max-turns` and `--max-budget-usd`.
- Add `--bare` when plugins and hooks are not needed; without it `-p` loads the project's hooks and `.mcp.json` with no trust prompt.
- Pin third-party actions to a full commit SHA; give the job read-only tokens.
- Any workflow that can push runs in a protected environment with required reviewers.

### Parallel agents

(Claude Code worktrees. Soft guidance; only an agent's `writeScope` plus the `guard-files` hook enforce write scope.)

- Parallelize only independent tasks whose write sets are disjoint; declare each set in `plan.md` (`**Files:**`, `**Song song:**`).
- Branch `worktree-<slug>-t<n>` in `.claude/worktrees/<slug>-t<n>/`, cut from the current tip of the integration branch `feature/<slug>`; after every merge, cut the next task branch from the new tip.
- Touch shared files (version bump, lock, living spec, README) once, in the main session, after merging.
- The main session merges with `merge --no-ff` into the integration branch and runs the touched components' tests after each merge.
- A conflict outside the declared write sets: stop and report. The human gate is the final review of the whole integration branch before any push or PR; merge commits in the main session do not replace it. No per-agent PRs.
- [Inference] Keep to at most 3 agents at once (heuristic, not an official limit).
- Clean up with `git worktree remove`, only for worktrees that are merged and clean; never `rm -rf` a worktree holding a junction on Windows.

### Model and session routing

(Claude Code. Other tools: apply the session and messaging rules; ignore model names.)

Soft guidance (no hook). Facts are from the official docs: [prompt-caching](https://code.claude.com/docs/en/prompt-caching),
[sub-agents](https://code.claude.com/docs/en/sub-agents), [costs](https://code.claude.com/docs/en/costs),
[multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system).

| Tier | Work | Default model | Step up when |
|---|---|---|---|
| Mechanical subagent | docs, run-log/ledger updates, lint/format fixes, renames, mock data, running check scripts, summarizing test logs, conflict-free merges, broad repo search | `haiku` (call-time parameter) | `haiku` got it wrong once → `sonnet` |
| Logic subagent | implement, write tests, fix, regular review, spec/plan, semantic conflicts | `sonnet` (frontmatter) | `sonnet` failed twice on the same task → `opus` |
| Deep subagent | whole-phase review, pre-release security review, hard root-cause debugging, design | `sonnet`; `opus` via call-time parameter (effort `high`) for whole-phase review, pre-release security review, hard root-cause debugging | as above, or the user allows it |
| Execution session (one phase/branch) | orchestrates the subagents of one work package | `sonnet`, chosen at session creation | design-heavy or hard-debug package → `opus` at creation |
| Root orchestration session | hands work between sessions, batches questions for the user | `opus` | — |

**Choosing a model**

1. Choose model and effort when creating a session or calling a subagent. Never switch model on a session that
   already has context; to change it, hand off to a new session. Each model has its own cache, so a switch
   recomputes the whole request ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
2. Set `effort` together with the model. Our defaults: `opus` → `medium` (same as the 5.5 product default),
   `high` only for the heavy work named in the deep-subagent row; `sonnet` → `high` (the product default is
   `medium`); `haiku` → product default. Unlike a model switch, changing `effort` keeps the prompt cache on 5.5
   models (Claude Code with an API key or subscription; see prompt-caching for exceptions), so raise or lower it
   mid-session when the kind of work changes ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).
3. Subagents report the model they used. Every step up to `opus` gets a one-line reason.

Subagent model order: call-time parameter → frontmatter `model` → `CLAUDE_CODE_SUBAGENT_MODEL` → main session
model ([sub-agents](https://code.claude.com/docs/en/sub-agents)).

**Rotating sessions**

4. One session handles one work package (a phase, a branch). When the package is done, or context passes ~40%
   of the window (soft) or ~60% (hard), write the handoff to `handoff.md` (template in `core:artifact-templates`:
   branch, hash, unfinished work, pending questions) and open a new session. [Inference] The 40% and 60%
   thresholds are team heuristics, not official figures.
   Only a human or the statusline can read the percentage (`context_window.used_percentage`); a hook cannot.
   The common hook input fields carry no context size ([hooks](https://code.claude.com/docs/en/hooks#common-input-fields),
   [statusline](https://code.claude.com/docs/en/statusline)). Only SessionStart on resume/fork gets `context_tokens`;
   [Inference] that is a token count, not the percentage.
5. Keep the orchestrating session's context small: read summaries, give long log/diff reading to `haiku` subagents.
6. Use `/clear` between unrelated tasks; run `/compact <focus>` only at a natural pause. Compaction drops the
   cache; the main session's TTL is 1 hour on a subscription (within plan usage), subagents' default is 5 minutes
   ([prompt-caching](https://code.claude.com/docs/en/prompt-caching)).

**Messages between sessions**

7. Do not send a message only to announce a rule or check in; fold it into the brief of the next task.
8. A child session reports only when: a queued task is done, it is blocked, or the user must decide. Never send an
   acknowledgement ("received", "rule noted").
9. One message batches several small results. Long output goes in a file (run-log); the message points to it.
10. Brief a child session with a queue of 2–3 chained tasks so it never idles between them.

**Monitoring**

11. Do not poll child sessions with dense cron; rely on the event that a child finished its turn. For a safety
    net, use an interval of at least 15 minutes (each check re-reads the whole context).
12. Check quota (`/usage`) at each phase gate, not every turn.

**Parallelism**

13. Run sessions or subagents in parallel only when the tasks are independent in files and each is large enough.
    Tightly coupled coding runs sequentially in one session. An agent uses ~4× the tokens of chat and a
    multi-agent system ~15× ([multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system));
    agent teams ~7× ([costs](https://code.claude.com/docs/en/costs)).

**Long sessions**

14. A child session writes its long report to a file and sends the parent one line with the path and the
    conclusion. The orchestrating session never reads long diffs or logs itself; a `haiku` subagent reads and
    returns the summary.
15. Every command in the orchestrating session bounds its output (`--stat`, `head`, column filters); list
    sessions by name or id rather than a full listing; never repeat `get_usage`/`list_events` within one gate.
16. When the next step depends on a subagent's result, run it in the foreground instead of ending the turn to
    wait for a background notification.
17. A session idle longer than the prompt-cache TTL (1 hour for the main session on a subscription,
    [prompt-caching](https://code.claude.com/docs/en/prompt-caching#cache-lifetime)) is cheaper to replace than
    to wake: open a new session from `handoff.md`. Never switch model mid-session (rule 1).
18. Record each session's context usage (`/usage` or the statusline's `used_percentage`) in the run-log at every
    phase gate.

[Unverified] How much a cache read weighs against a subscription's usage limit is not documented; the rules above
still hold because they cut the number of turns on large contexts.

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
