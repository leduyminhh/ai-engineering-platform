# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Frontmatter parser reads inline lists `[a, b]`, block lists (indented or at column 0), one-level maps and
  `true`/`false`/`null`; a stray top-level line is an error. The loader fails loud on a frontmatter key outside
  `SOURCE_KEYS` (message names file and key) and the emitter writes lists/maps and quotes strings that look like
  booleans, numbers or `null`.
- Skill frontmatter keys are projected per provider (`SKILL_PASSTHROUGH` with type checks, `PROVIDER_SKILL_KEYS`:
  Claude all, Cursor `paths`/`disable-model-invocation`/`metadata`, Codex none); the Cowork pack keeps only
  `name` + `description`. A value starting with `[` that is not a list (e.g. an unquoted `argument-hint: [PR]`)
  is rejected by the loader.
- The 4 `*-init` skills carry `disable-model-invocation: true`; the generated principles skills carry
  `user-invocable: false` (Claude only); `argument-hint` on 9 skills and 12 workflows.
- Agent keys `tools`, `maxTurns`, `isolation` (validated by `checkAgentTools`). The 5 read-only agents have a
  `tools` allowlist (reviewers/auditor: `Read, Grep, Glob, Bash, Skill`; the 2 ops agents without `Bash`:
  `Read, Grep, Glob, Skill`) and every Claude agent preloads its primary (first) skill through `skills:`.
  `permissionMode` is deliberately not supported (Claude ignores it for plugin agents).
- Workflows with risk `high`/`critical` (db-change, incident, release, security-review) open with a
  start-confirmation gate (`⏸`) in the Claude and Codex preambles; 9 workflow descriptions were rewritten to the
  description template (`test/fixtures/workflow-not-for-ids.json`).
- Rare workflow branches moved to `workflows/<slug>/references/*.md` (12 files across 9 workflows) and 9
  Evidence lines trimmed; the contract checks both directions (pointer → file, file → pointer). The 13
  `WORKFLOW.md` files shrank from 201,722 to 194,572 bytes (-3.54 %; the 10 % target of the plan was not reached).
- Draft skills (and the agents that use them) build to `build/claude/drafts/<plugin>/…` and the marketplace
  only sees published ones; `node cli/build.mjs --include-draft` keeps the previous single layout, and skills-mode
  install reads both locations. Upgrade note: an existing skills-mode install of a draft skill points into
  `build/claude/plugins/data/skills/…`, which a rebuild removes — run `aip update` (or reinstall) to re-link.
  Plugin mode drops draft skills: `--as-plugin` and `aip update` on a plugin-mode `data` install no longer contain
  the 4 `data-oltp-*`/`data-olap-*` skills (aip warns); use skills mode to keep them.
- Claude `plugin.json` gains `homepage`/`repository`/`license` (from `plugins/_marketplace.json`) and a
  per-plugin `keywords` list (from the manifest); manifest descriptions are at most 500 characters and name every
  published skill.
- `npm run overlap` (`test/overlap.mjs`) prints skill/skill and workflow/workflow content-overlap
  ratios used to decide merges.

- Core hooks (`core/hooks/hooks.json` + `scripts/guard-bash.mjs`, `scripts/guard-files.mjs`, zero-dep Node): the
  Claude adapter projects `hooks/` into `build/claude/plugins/core/hooks/`. Plugin mode only: skills-mode installs no
  hooks (`${CLAUDE_PLUGIN_ROOT}` exists only for installed plugins), and the managed setting `allowManagedHooksOnly`
  disables plugin hooks that are not force-enabled. Rules (PreToolUse):
  H1 `ask` on `git push` to `main`/`master`/`dev`/`develop` and on force/delete/mirror/all/prune pushes
  (compound commands, `-C`, quoted refs and flag clusters are handled); H2 `deny` `git commit -m` with non-ASCII text
  (use `-F`, see `git-workflow`); H3 `deny` Read/Edit/Write/MultiEdit/NotebookEdit/Grep on secret files
  (`.env*`, `*.env`, `.envrc`, `*.pem`/`*.jks`/`*.keystore`/`*.p12`/`*.pfx`/`*.key`/`*.ppk`/`*.p8`, private keys `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519`
  (also `_sk` and any non-`.pub` suffix), `credentials`, `credentials.json`/`.yml`/`.yaml` only; `.env.example`/`.sample`/`.template`
  and `*.pub` stay allowed) and `ask` when a Bash command names
  one; H5 write-scope lock (below). Scripts fail open on internal errors (exit 0, no decision); when Bash parsing is
  unreliable `guard-bash` falls toward `ask` (not `guard-files`). H4 (block Bash for ops agents) was dropped: the ops agents have no Bash.
  This is a regex gate, not a sandbox (see the README "Hooks" section for residual risk).
- Agent key `writeScope` (list of globs, `mode: write` only; matched against the path relative to the git root, `/`
  separators, `*` and `**` supported, not starting with `./` `/` `..`, no `\`, `{`, `?`). The Claude adapter collects it
  into the generated `hooks/scope-lock.json` of `core`; `guard-files` denies Edit/Write/MultiEdit/NotebookEdit outside the
  scope for that agent (including `../x`). Set on 5 agents: `engineering-release-scribe`, `engineering-spec-analyst`,
  `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer`. The main session and agents without
  `writeScope` are not locked, and an agent that has Bash can still write elsewhere.
- `evals/<plugin>/` (repo level, not shipped in plugins or npm): 3 `claude plugin eval` cases —
  `engineering/spec-writing-routes`, `backend/code-review-readonly`, `workflows/bugfix-routes` — checked
  structurally by `test/contract/95-evals.contract.mjs` in `npm test`. Running them is manual
  (`aip install --provider claude --as-plugin --plugin <id> -g`, then
  `claude plugin eval <id>@ai-engineering-platform --eval-dir evals/<id> --ablation none …`), costs model usage
  on your account and is not part of `npm test` or CI. [Unverified] never run end to end; the first-run checklist
  is in `evals/README.md`.
- `node cli/dist.mjs [--dry-run]` builds a local `dist` branch holding `build/claude` (without `drafts/`) so the
  marketplace can be added with `claude plugin marketplace add <owner>/<repo>@dist`. It never pushes. Requires git >= 2.42
  (`git worktree add --orphan`).
- Hook fixes from the final review: the `guard-bash` matcher is now `Bash|PowerShell` (PowerShell 5.1 was bypassing H1/H2/H3);
  H1 tracks `cd`/`chdir`/`pushd`/`Set-Location`/`sl` between segments and resolves the branch of the target
  directory (unresolvable targets ask for a push with no refspec/`HEAD`/`@`); H5 anchors the write scope to the git root
  of the target file instead of the session cwd. README "Hooks" lists the extra false positives and residual risks
  (PowerShell parsing, Grep on a directory, H5 outside a git repo, `bypassPermissions` [Unverified], about 0.2 s per call on Windows).
- Hook residual fixes (core 1.4.2): for the PowerShell tool `guard-bash` joins backtick line continuations and strips backtick
  escapes before parsing, so a push split by a backtick-newline or written as ``ma`in`` is asked like `git push origin main` (the
  README no longer claims a backtick "fails toward ask"); the `cd` tracker also knows `Push-Location` and skips a `--`
  argument (`cd -- repo && git push`); `popd`/`Pop-Location` count as an unresolvable target, and after `||` or `|` a previous
  `cd` is no longer trusted (`cd repo || git push` asks when it pushes with no refspec/`HEAD`/`@`). Covered in `test/contract/90-hooks.contract.mjs`.
- Skills-mode Claude install warns when the same plugin is already installed in plugin mode (every skill would
  appear twice).

### Changed

- Codex skills now install to `<root>/.agents/skills/` (global: `~/.agents/skills/`), the path the current Codex docs
  list; Codex agents stay in `.codex/agents/`. Upgrade note: run `aip update` (add `-g` for a global install) or reinstall — the install
  manifest removes the legacy `.codex/skills` copy; a copy that the manifest does not track must be removed by hand.
  [Inference] `.codex/skills` still loaded on Codex 0.147.0 in a local test, but it is no longer documented.
- The installer never overwrites or deletes a foreign regular file when placing skills; a foreign real directory is
  merged and its existing files are kept (skipped with a warning); a symlink/junction at the destination that the manifest
  does not track and that does not already point at the source is treated as foreign and skipped with a warning.
- Removed the dead `.mcp.json` branch from the Claude install layout; `hooks` are plugin-mode only.
- `backend-migrate-vault-consul` no longer reads secret values: the agent works from variable names (the user runs a
  names-only command), and backup/trim of `.env`, generation of `configs/` from `.env.bak` and seeding are commands the
  user runs (or the agent runs after explicit confirmation), never Read/Edit on `.env*`. Keeps the core H3 deny coherent with the skill.
- `backend-migrate-vault-consul` residual fixes (backend 1.7.2): the names-only inventory command now also prints a `CRED`/`-` flag
  per variable (embedded `://user:pw@` or `?password=`-style parameters; values are never printed and multi-line PEM continuation lines
  are skipped; bash `awk` and PowerShell variants) and `CRED` variables are classified SECRET; variables named like a URL/URI/DSN/connection
  string (`*_URL`, `*_URI`, `*_DSN`, `*CONNECTION*`, `*_CONN*`, `DATABASE_*`) with flag `-` go to "CẦN XÁC NHẬN" instead of Consul, so a
  credential embedded in e.g. `REDIS_URL` cannot land in Consul. Confirmation to run a command is an explicit "yes" in chat (user-run
  scripts and skills-mode bypass the hook); multi-profile differences come from the user or a user-run script; the `.env.example`
  template derives from the agreed bootstrap variable names, never from reading the new `.env`; the skill folder `README.md` says
  which commands the user runs.
- `test/contract/96-dist.contract.mjs` isolates the temporary repo from the developer's global git config
  (`GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`); `cli/dist.mjs` is unchanged.
- Version bumps for Phase 3: core 1.4.2 (MINOR 1.4.0 for hooks, PATCH for the final-review and residual fixes), backend 1.7.2 (vault-consul skill), frontend 1.9.1 (e2e agent body now states that
  `.gitignore` is out of scope), workflows 1.3.2 (orchestrator names `.agents/skills/workflow-<slug>/` for Codex);
  `plugins/_versions.lock.json` refreshed.
- `aip check` reads `claude plugin list --json` and falls back to the text output on older Claude Code CLIs;
  `test/install.test.mjs` removes its temp directories on exit.
- All plugins bumped MINOR for Phase 2 (routing behaviour changes: `disable-model-invocation`, agent `tools`):
  core 1.3.0, backend 1.7.0, frontend 1.9.0, engineering 1.6.0, ops 1.4.1, data 1.5.1, workflows 1.3.1
  (ops/data/workflows took a PATCH after the final review: ops agent wording, `*-init` routing in the orchestrator,
  data manifest description); `plugins/_versions.lock.json` refreshed.
- Removed the dead `pipeline`, `next` and `stageNumber` frontmatter keys from every skill, workflow
  and the workflow template; the loader no longer exposes them, and the Antigravity `AGENTS.md`
  lists skills in a single group (the empty "Pipeline" section is gone).
- `SKILL.md` must have `## Quy trình…` and `## Ranh giới an toàn…` headings (`cli/lib/conventions.mjs`);
  headings normalised in 15 skills and the 4 `*-init` skills gained a safety section built from rules
  they already stated.
- Skill and workflow `description`s are at most 500 characters, end with
  `Không dùng khi … → <id>`, and no quoted trigger is shared verbatim between two skills; 22
  descriptions were rewritten to fit with their trigger lists kept (12 of them were already over the 1024-character limit of the earlier standardization).
- Skill descriptions rewritten to a fixed template (action → "Dùng khi" triggers → "Không dùng khi → id"),
  ≤ 450 chars; agent descriptions ≤ 260 — skill descriptions 31,511 → 15,120 chars, agent descriptions
  7,506 → 4,232 chars; `claude plugin details` always-on estimate for `engineering` ~1,968 → ~1,001 tokens
  (after install: core ~177, backend ~1,537, frontend ~1,680, ops ~538, workflows ~1,471).
- 7 workflow descriptions shortened to ≤ 500 chars (triggers and → ids kept).
- Skills no longer force-load the principles skills on every call; a 3-line principles digest is
  embedded instead (full text on demand).
- `workflows` preamble explains `∥`; the orchestrator prints the install command per install mode;
  db-change/incident/release list extra plugins.
- git-workflow ships `scripts/check-commit-message.mjs` (Node) beside the PowerShell check, and it also
  rejects a `Co-Authored-By:` trailer; `.sh` helpers moved under each skill's `scripts/`.
- Validator split into `test/contract/` and `test/content/`; `node test/validate.mjs --only <name>` runs one
  group (a missing value is a usage error, checked before any build).
- All plugins bumped (MINOR for the Phase 1 rewrite, then PATCH for the review fixes below): core 1.2.1,
  backend 1.6.1, frontend 1.8.1, engineering 1.5.1, ops 1.3.1, data 1.4.1, workflows 1.2.2;
  `plugins/_versions.lock.json` refreshed.
- Phase 1 review fixes: `data-db-migration` states again that it never runs migrations on production and verifies on a
  test DB; `frontend-data-integration` / `frontend-refactor` regain "no hardcoded API key/base URL" and "no global
  token/theme change" safety lines; `engineering-quality-gate` regains its dependency-vulnerability trigger; the
  principles digest says "không sửa file bí mật". Added a source frontmatter-key allowlist
  (`SOURCE_KEYS`/`checkSourceKeys`) and a byte contract (`test/contract/70-bytes.contract.mjs`: no BOM, LF in the
  index, valid UTF-8); `--only=<name>` is accepted.
- Workflow drift guards: the five fixed template lines (`WF_ANCHORS`) must appear in every
  `WORKFLOW.md`, and every quoted Registry signal must appear in that workflow's `description`.
- Forks with their own skills: `npm run validate` now fails a `SKILL.md` without `## Quy trình…` /
  `## Ranh giới an toàn…` headings or a description without a trailing `Không dùng khi … → <id>`; the failure
  message names each offending skill.
- The Antigravity `AGENTS.md` index cuts each "Khi nào dùng" line to 200 characters at a word boundary
  (`…`) instead of the validator warning about long first sentences; `checkSkillBody` ignores headings
  inside fenced code blocks; `test/overlap.mjs` no longer throws when imported without `argv[1]`.
- The Antigravity "Khi nào dùng" index line no longer ends inside an unclosed parenthesis: a cut that would leave
  "(" open backs up to before it.
- The Antigravity "Khi nào dùng" index line now stops after a whole clause (`, ` `; ` ` — ` `: ` outside parentheses,
  from character 100 on) instead of mid-clause, falling back to a word boundary.
- Plugin content changes must bump the owning `.manifest.json` version (core: `core/.manifest.json`) and
  refresh `plugins/_versions.lock.json` with `node cli/lib/versions.mjs --lock`; `npm test` fails when the
  lock does not match the build.
- The `workflows` plugin now depends only on `core`, `backend`, `frontend`, `engineering`; `db-change` needs
  `data`, `incident`/`release` need `ops` (stated in each workflow's preamble as "Plugin cần có").
- Built frontmatter values are double-quoted when unsafe as YAML plain scalars (Claude, Codex, Cursor `.mdc`).
- `aip check` also lists installed Claude Code plugins whose version differs from source.
- CI runs on ubuntu/windows × Node 20/24 and validates the built marketplace with
  `claude plugin validate --strict`.

## [1.2.1] - 2026-10-01

### Added

- **11 agents** — subagents packaging existing skills, projected per provider
  (`plugins/<id>/agents/<agent-id>.md` → `build/claude/plugins/<id>/agents/<agent>.md` +
  `build/codex/<id>/agents/<agent>.toml`): `backend-implementer`, `backend-test-writer`,
  `backend-reviewer`, `frontend-implementer`, `frontend-test-writer`, `frontend-reviewer`,
  `engineering-quality-auditor`, `engineering-spec-analyst`, `engineering-release-scribe`,
  `ops-incident-investigator`, `ops-release-engineer`.
- **12 workflows + `workflow-orchestrator`** — multi-step recipes at the repo-level
  `workflows/<slug>/WORKFLOW.md` that dispatch agents in sequence with human checkpoints
  (`workflow-feature`, `workflow-bugfix`, `workflow-refactor`, `workflow-code-review`,
  `workflow-testing`, `workflow-security-review`, `workflow-db-change`, `workflow-api`,
  `workflow-performance`, `workflow-incident`, `workflow-release`, `workflow-docs`), plus
  `workflow-orchestrator` to classify a free-form request into one of the above.
- **`templates/workflows/workflow.template.md`** — the 7-heading + step-contract template
  every workflow and the orchestrator are authored from.
- **`cli/lib/plugins.mjs`** — `loadAgents()` and `loadWorkflows()` loaders; `loadPlugins()`
  now attaches `agents[]`.
- **Installer dependency closure** — installing a workflow (`--plugin workflows` /
  `--skill workflows/<id>`) pulls in its `requires` plus the skills of every agent it lists,
  recursively, deduped; uninstalling drops what no other remaining workflow still needs.
- **`--all` flag** — `aip --all` / `aip install --all` opens the wizard with the full skill tree
  (drafts such as plugin `data` marked `(draft)`, plus every workflow) instead of only what
  `plugins/_published.json` offers. Non-interactive installs already default to `--plugin all`.
- **Fixer agents + `*-fix` skills** (`backend-fix`, `frontend-fix`), wired into the bugfix,
  security-review and performance workflows behind a diff gate.
- **`backend-performance`** measure/profile skill and `backend-performance-analyst` agent.
- **`frontend-data-integration` and `frontend-e2e-testing`** skills published, wired into the
  feature, api and testing workflows.
- **Pre-deploy e2e smoke** step in `workflow-release`.

### Changed

- **The npm package ships core only** (`core:principles` + `core:git-workflow`). `package.json`
  `files` drops `workflows/` and `plugins/{backend,frontend,engineering,ops}/`; plugins and workflows
  are installed from source (`git clone` + `npm link`, then `aip install --plugin all` or
  `aip --all`). `plugins/_published.json` is unchanged and still gates what the wizard offers.
- **pack-guard** — new `shipPlugins` key in `pack.config.json` (empty = core only): rejects any
  `plugins/<id>/` not listed and all of `workflows/`, and fails if a listed plugin is missing. It no
  longer requires every published plugin to be in the tarball.

## [1.1.1] - 2026-09-03

Re-platform to the zero-dependency `aip` engine. **Breaking change** — there is no
in-place upgrade from the legacy `ai-engineering` / `aie` platform; see
[MIGRATION.md](MIGRATION.md). Legacy history is preserved under
[Legacy (aie platform)](#legacy-aie-platform) below.

### Changed

- **Engine** — rebuilt on pure ESM with **zero runtime dependencies** and **no build
  step** (previously TypeScript compiled to `cli/dist/`). Includes a hand-rolled
  YAML-frontmatter parser and ZIP writer using Node built-ins only.
- **CLI** — renamed `ai-engineering` / `aie` → `ai-engineering-platform` / `aip`.
- **Commands** — `install`, `uninstall` (alias `remove`), `build`, `check`, `list`,
  `update`, `pack`, plus an interactive menu wizard.
- **Plugin manifest** — `plugins/<id>/plugin.yaml` (assets/skills lists) →
  `plugins/<id>/.manifest.json` (`id`/`name`/`description`/`version`) with
  auto-discovered `skills/<skill>/SKILL.md`.
- **Plugin catalog** — 7 abstract plugins (`application`, `architecture`, `data`,
  `knowledge`, `platform`, `quality`, `security`) → 4 domain plugins (`backend`,
  `frontend`, `oltp-database`, `olap-warehouse`) plus `core`.
- **Workflow model** — the 5-stage per-plugin pipeline is gone; skills are now
  **standalone, on-demand recipes** (`pipeline: false`, no mandatory chain).
- **State** — a multi-file `.ai-engineering/` layout (`platform.lock`,
  `ownership.json`, backups) collapsed to a single flat
  `<scope-root>/.ai-engineering/manifest.json`.
- **Install** — symlink-first (junctions on Windows) with a copy fallback, additive
  (unions with what is already installed), and reference-counts the shared managed
  block in `AGENTS.md` / `CLAUDE.md`.

### Added

- **`$AIE_INSTALL_ROOT`** — env override for the scope root (used by tests to isolate
  installs).
- **Cowork packaging** — `aip pack` bundles the `plugins/_cowork.json` skill set into
  deterministic `build/cowork/<skill>.zip` files for Customize → Skills → Upload.
- **npm pack guard** — `cli/lib/pack-guard.mjs` + `pack.config.json` verify on
  `prepack` that the publish file set stays within an allowlist.
- **`--as-plugin`** — install Claude content as a real plugin via the `claude`
  CLI (marketplace + namespaced `<id>:<skill>`) instead of flat `.claude/skills/`.

### Removed

- **MCP registration** — projected `.mcp.json` / registry and the `providers/`
  policy tree are removed.
- **`ai-engineering.config.yaml`** — no longer used.
- **Pipeline skills** — the `*-analysis`, `*-api-contract`, `*-ui-contract`,
  `*-state-model`, `*-erd`, `*-implement`, `*-example`, `*-share-contract`,
  `*-schema-contract`, `*-model-lineage`, `*-migration` skills are gone. Kept: four
  `*-init` scaffolders and two backend recipes (`backend-migrate-architecture`,
  `backend-migrate-vault-consul`).
- **Runnable code skeletons** — `*-init` skills now scaffold **documentation only**
  (no FastAPI / React / Postgres overlays).
- **PowerShell hook subsystem** (`cli/scripts/`) — not part of this engine.

---

## Legacy (aie platform)

The entries below describe the previous `ai-engineering` / `aie` platform, replaced
by the re-platform above. They are retained for history only and do not describe the
current `aip` engine.

### aie 1.1.1 - 2026-06-24

- **Fixed** — runtime crash in `aie remove` / `aie upgrade` (`findOutdated` and the
  uninstall wizard read `plugin.metadata.id` on flat lock entries); broken test suite
  from the v1.1.0 standardization series merged without running `npm test`.
- **Added** — core/plugin workflow sync validator (`aie validate` fails loud when a
  `core/workflows/*.yaml` fallback drifts from its plugin-owned source).
- **Removed** — the empty `youtube-transcript` (`knowledge`) skill and all references.

### aie 1.1.0 - 2026-06-23

- **Changed** — plugin standardization: unified skill/command/workflow naming across
  7 plugins (`fullstack-feature` → `feature-delivery-pipeline`; `migration-plan` →
  `plan-migration`; `java-analyze` → `java-implement`; etc.); removed phantom skill
  references and duplicate identity fields from `plugin.yaml`.
- **Fixed** — stale workflow/skill references after renames.
- **Improved** — CLI reads authoritative `metadata` block; stricter validation.

### aie 1.0.0 - 2026-06

- Initial release — `aie` CLI with a 7-plugin system (`application`, `architecture`,
  `data`, `knowledge`, `platform`, `quality`, `security`), adapter generation for
  Codex, Claude Code, Cursor, and Antigravity, install/uninstall/upgrade wizards, and
  plugin validation / doctor commands.
