# Parallel agents

Moved verbatim from the `### Parallel agents` section of the AI Engineering baseline (`AGENTS.md`), which keeps a pointer to this file.

### Parallel agents

(Claude Code worktrees. Soft guidance; only an agent's `writeScope` plus the `guard-files` hook enforce write scope.)

- Parallelize only between parts, never inside a part (tasks of one part run sequentially). Parts of one group (column `Song song` of `## Bảng part`) must have disjoint write sets, taken from their tasks' `**Files:**`; check them with `check-partition.mjs` (P1, P2, P4; P3 only flags a leftover task-level `Song song` line).
- Branch `worktree-<slug>-p<nn>` in `.claude/worktrees/<slug>-p<nn>/`, cut from the current tip of the integration branch `feature/<slug>`; after every merge, cut the next part branch from the new tip.
- Parts never write shared files (version bump, lock, living spec, README); only the main session does.
- The main session merges each part with `merge --no-ff` into the integration branch. After each part merge it first does the project's shared-file step (e.g. version bump and lock), then runs the full suites of the touched components and their dependents; on red it stops the group and fixes on `feature/<slug>` through the plan-execution fix loop.
- Merging a part branch into `feature/<slug>` is a local merge, approved by the user's answer before each group (not asked when `autonomy.partRunner` is `subagent`); push, or merge into the base branch, happens only when the branch is finished.
- A conflict outside the declared write sets: stop and report. The human gate is the final review of the whole integration branch before any push or PR; merge commits in the main session do not replace it. No per-part PRs.
- [Inference] Keep to at most 3 agents at once (heuristic, not an official limit).
- Clean up with `git worktree remove`, only for worktrees that are merged and clean; never `rm -rf` a worktree holding a junction on Windows.
