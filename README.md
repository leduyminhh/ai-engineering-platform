# AI Engineering Platform

`ai-engineering-platform` (CLI: `aip`) is a plugin platform that keeps **one
canonical source** of AI-agent capability content and projects it into the native
layout of **Codex, Claude Code, Cursor, and Google Antigravity**. Author a
capability once under `plugins/` and `core/`; the CLI generates the per-provider
skills, marketplace, rules, and workflow docs into a target project, and merges an
"AI Engineering" baseline block into that project's `AGENTS.md` / `CLAUDE.md`.

Pure ESM, **zero runtime dependencies**, no build step. Node.js 20+.

> Vietnamese: see [README_VI.md](README_VI.md).

## Quickstart

```bash
git clone https://github.com/leduyminhh/ai-engineering-platform.git
cd ai-engineering-platform
npm install        # nothing to compile — installs dev tooling only
npm test           # all suites should pass
npm link           # expose `aip` on PATH
```

Install capabilities into another project:

```bash
cd /path/to/project
aip                                   # interactive wizard
# or non-interactive:
aip install --provider claude --plugin backend --yes
aip install --provider all --plugin all --yes
aip install --provider codex --plugin all -g   # global scope
# pick individual skills (plugin/skill):
aip install --provider claude --skill backend/backend-init,core/git-workflow --yes
aip uninstall --skill backend/backend-migrate-architecture --yes
```

`aip` and `ai-engineering-platform` invoke the same CLI. `aip --help` prints the guide.

## Install from npm

End users do not need to clone the repo — the `ai-engineering-platform` package is published
to the npm registry, and both `aip` and `ai-engineering-platform` bins point to the same CLI.

> **The npm package ships core only** — the baseline principles and the `git-workflow` skill
> (`core:principles` + `core:git-workflow`). Plugins (`backend`, `frontend`, `engineering`,
> `ops`, `data`) and workflows are **not** in the package; install them from source:
> `git clone` + `npm link` (see [Quickstart](#quickstart)), then `aip install --plugin all`, or
> `aip --all` to open the wizard with every skill including drafts.

**1. Check Node.js** — **v20 or newer** is required:

```bash
node --version
```

**2. Install globally** (once per machine; npm puts the bin on PATH):

```bash
npm install -g ai-engineering-platform
```

**3. Verify the install**:

```bash
aip --help        # prints the CLI guide
aip check         # lists installed capabilities (empty initially)
```

**4. Install capabilities into a project** — from inside the target project, run the
wizard or a direct command:

```bash
cd /path/to/project
aip                                   # interactive wizard (install/uninstall/build/check menu)
# or non-interactive (the npm package only has core, so this installs git-workflow + principles):
aip install --provider all --yes
```

**5. Review the result** in the project with `aip check` — it lists each skill and written
file (e.g. `.claude/skills/…`, `.cursor/rules/…`, baseline block in `CLAUDE.md` / `AGENTS.md`).

To update the package later:

```bash
npm update -g ai-engineering-platform
```

> `aip update` is for installations from a cloned repo (git pull → rebuild → reinstall); for
> the npm install use `npm update -g` above. To remove the tool:
> `npm uninstall -g ai-engineering-platform`; to remove capabilities from a project, run
> `aip uninstall --yes` inside it.

Run once without a global install — `npx` pulls the package into the npm cache and does not
add a bin to PATH:

```bash
npx ai-engineering-platform install --provider all --yes
```

## Structure

| Path | Owns |
| --- | --- |
| `plugins/` | Canonical capability source: `<id>/.manifest.json` + `shared/principles.md` + `skills/<skill>/SKILL.md`, plus `_marketplace.json` and `_cowork.json`. |
| `core/` | Shared baseline: `agents/AGENTS.template.md`, `principles/`, the shared `skills/git-workflow/` recipe, and the safety `hooks/` (plugin-mode only). |
| `evals/` | `claude plugin eval` cases per plugin (manual run; not shipped; `npm test` checks structure only). |
| `templates/` | `init/` project scaffold (dropped by `*-init` skills) and `skills/` authoring scaffold. |
| `adapters/` | Per-provider projection (`<provider>/adapter.mjs`), auto-discovered. `_shared/lib.mjs` holds the cross-tool logic. |
| `cli/` | The `aip` CLI (`index.mjs` + `lib/*.mjs` + `build.mjs`). Pure ESM, zero-dep. |
| `test/` | Contract validator + install/wizard/managed-block/pack-guard tests. |
| `docs/` | Design records and specs. |
| `completions/` | Shell completions for `aip` (see [SHELL_SETUP.md](SHELL_SETUP.md)). |

## Plugin Catalog

Content is intentionally lean: `core`, domain plugins (`backend`, `frontend`, `data`)
and cross-cutting capability plugins (`engineering`, `ops`); skills are
**standalone, on-demand recipes** (there is no mandatory pipeline). The published set
lives in `plugins/_published.json` — each entry is either a whole plugin (`backend`) or
a single skill (`frontend/frontend-init`); the wizard offers only what is listed (from source;
the npm package ships core only), and
`npm run build` writes `build/wizard-install-report.md`. Skills of a plugin that are not
published (e.g. the `data-oltp-*` / `data-olap-*` skills) stay drafts, installable via `--plugin`/`--skill`, or `aip --all` in the wizard (skills mode only).

| Plugin | Capability | Skills |
| --- | --- | --- |
| `core` | Shared baseline every plugin depends on. | `principles`, `git-workflow` |
| `backend` | Backend (REST API / service) project. | `backend-init`, `backend-migrate-architecture`, `backend-migrate-vault-consul` |
| `frontend` | Frontend (web app / SPA) project. | `frontend-init`, `frontend-migrate-architecture` |
| `data` | Data project — OLTP DB (`data-oltp-*`) + OLAP warehouse/pipeline (`data-olap-*`). *(partly published: `data-db-migration`; OLTP/OLAP skills still draft)* | `data-db-migration`, `data-oltp-init`, `data-olap-init` |
| `engineering` | Cross-cutting engineering capabilities (quality gate, spec, task breakdown, diagram, ADR, release notes, convention). | `engineering-quality-gate`, `engineering-spec-writing`, `engineering-task-breakdown`, `engineering-adr` |
| `ops` | Server maintenance — deploy/release, incident triage, observability. | `ops-deploy-release`, `ops-incident-troubleshooting`, `ops-observability` |

Each `*-init` skill is a **docs-only scaffolder**: it drops the `templates/init`
tree + `AGENTS.template.md`, asks the domain basics (stack / framework / engine /
sources), and fills `project-knowledge/`. The two backend `migrate-*` recipes
restructure an existing codebase (architecture; or config → Vault/Consul).

Invoke a skill in Claude Code as `/<plugin>:<skill>` (e.g. `/backend:backend-init`).

## Agents & Workflows

On top of skills, the platform projects **agents** (subagents that carry one role and
package one or more skills) and **workflows** (multi-step recipes that dispatch agents
in sequence, with human checkpoints), plus a **`workflow-orchestrator`** that classifies
a free-form request into the right workflow. Agents live at `plugins/<id>/agents/<agent-id>.md`;
workflows live at the repo-level `workflows/<slug>/WORKFLOW.md`, separate from the plugin
tree because a workflow calls across plugins. Full design: `docs/superpowers/specs/2026-09-25-agents-workflows-design.md`.

An agent never commits, pushes, or opens a PR, and never dispatches another agent — only a
workflow (running in the main session) orchestrates and calls `core:git-workflow` after a
checkpoint. Every agent report is structured (result, `file:line`, residual risk); a claim
of "ran / passed" always carries evidence, or `not_run` + reason.

### Agents (18)

`mode` is provider-neutral: Claude maps `read-only` → `disallowedTools: Edit, Write, NotebookEdit, Agent`
and `write` → `disallowedTools: Agent`; Codex maps `read-only` → `sandbox_mode: "read-only"` and
`write` → `"workspace-write"`.

| Agent id | Plugin | Mode | Skills packaged | Used in |
| --- | --- | --- | --- | --- |
| `backend-implementer` | backend | write | backend-implement, backend-api-contract | WF01, WF07, WF08 |
| `backend-test-writer` | backend | write | backend-testing | WF01, WF02, WF03, WF05, WF06, WF07, WF08 |
| `backend-reviewer` | backend | read-only | backend-code-review, backend-api-contract (drift check) | WF01–WF04, WF07–WF09 |
| `backend-fixer` | backend | write | backend-fix | WF02, WF06, WF09 |
| `backend-performance-analyst` | backend | write | backend-performance | WF09 |
| `data-migration-writer` | data | write | data-db-migration | WF07 |
| `frontend-implementer` | frontend | write | frontend-implement | WF01 |
| `frontend-data-integrator` | frontend | write | frontend-data-integration | WF01, WF08 |
| `frontend-test-writer` | frontend | write | frontend-testing | WF01, WF02, WF03, WF05, WF06 |
| `frontend-e2e-test-writer` | frontend | write | frontend-e2e-testing | WF01, WF05, WF11 |
| `frontend-reviewer` | frontend | read-only | frontend-code-review | WF01–WF04, WF09 |
| `frontend-fixer` | frontend | write | frontend-fix | WF02, WF06, WF09 |
| `frontend-performance-analyst` | frontend | write | frontend-performance | WF09 |
| `engineering-quality-auditor` | engineering | read-only | engineering-quality-gate, engineering-convention-enforce (audit mode) | WF01–WF04, WF06, WF08, WF11 |
| `engineering-spec-analyst` | engineering | write (`docs/` only) | engineering-spec-writing, engineering-adr, engineering-diagram, engineering-task-breakdown | WF01, WF03, WF10, WF12 |
| `engineering-release-scribe` | engineering | write (`docs/`, `CHANGELOG.md` only) | engineering-release-notes | WF11 |
| `ops-incident-investigator` | ops | read-only | ops-incident-troubleshooting, ops-observability | WF10 |
| `ops-release-engineer` | ops | read-only | ops-deploy-release, ops-observability | WF11 |

There is no separate Security agent: `engineering-quality-gate` already covers source-first
quality **and** security review (OWASP/ASVS/CWE, SCA, secrets); a split would only duplicate it.

### Workflows (12) + orchestrator

Id is `workflow-<slug>`, sourced from `workflows/<slug>/WORKFLOW.md`. `tier` sets how deep the
content goes (1 = heavy gates/DoD, 2 = full template but lean, 3 = lean); `risk` drives the
orchestrator's confirmation strictness.

| Code | id | Tier | Risk | Replaces (old plan) | Agents |
| --- | --- | --- | --- | --- | --- |
| WF01 | `workflow-feature` | 1 | medium | W1+W2+W3 | spec-analyst, BE/FE implementer, FE data-integrator, BE/FE test-writer, FE e2e-test-writer, BE/FE reviewer, quality-auditor |
| WF02 | `workflow-bugfix` | 1 | medium | W11 | BE/FE test-writer, BE/FE fixer, BE/FE reviewer, quality-auditor |
| WF03 | `workflow-refactor` | 1 | medium | W4a+W4b+W6 | BE/FE test-writer, BE/FE reviewer, spec-analyst, quality-auditor |
| WF04 | `workflow-code-review` | 1 | low | W5 | BE/FE reviewer, quality-auditor |
| WF05 | `workflow-testing` | 2 | low | new | BE/FE test-writer, FE e2e-test-writer |
| WF06 | `workflow-security-review` | 1 | high | W14 | quality-auditor, backend-test-writer, frontend-test-writer, backend-fixer, frontend-fixer |
| WF07 | `workflow-db-change` | 2 | high | W15 | data-migration-writer, backend-implementer, backend-test-writer, backend-reviewer |
| WF08 | `workflow-api` | 2 | medium | new (split from the W1 contract step) | backend-implementer, backend-test-writer, backend-reviewer, quality-auditor, frontend-data-integrator |
| WF09 | `workflow-performance` | 3 | medium | W16 | backend-performance-analyst, frontend-performance-analyst, backend-fixer, frontend-fixer, backend-reviewer, frontend-reviewer |
| WF10 | `workflow-incident` | 1 | critical | W9 | ops-incident-investigator, spec-analyst |
| WF11 | `workflow-release` | 2 | high | W8 | quality-auditor, release-scribe, release-engineer, frontend-e2e-test-writer |
| WF12 | `workflow-docs` | 3 | low | W17 | spec-analyst |
| — | `workflow-orchestrator` | — | — | new | none (runs in the main session) |

**Invoking:**

- Claude Code: `/workflow-orchestrator <your request>` to auto-classify against the registry, or
  call a workflow directly with `/workflow-<slug>` (e.g. `/workflow-bugfix`); list/inspect
  subagents with `/agents`.
- Codex: invoke the skill `workflow-<slug>` — workflows project as native Codex skills, same
  mechanism as any other skill.

**Installing** (workflows go through the existing selection mechanism, no new CLI flag):

```bash
aip install --provider claude --plugin workflows
aip install --provider claude --skill workflows/workflow-feature,workflows/workflow-bugfix
aip install --provider codex -g --skill workflows/workflow-code-review
aip install --provider claude --as-plugin --plugin workflows
aip uninstall --skill workflows/workflow-feature
```

Installing a workflow pulls in its dependency closure (`requires` + the skills of every agent
it lists) automatically, printed as `[aip] workflow-feature pulls in: backend/backend-implement, …`;
uninstalling drops what no other remaining workflow still needs.

### Roadmap

Tracked as open gaps in the design spec (`docs/superpowers/specs/2026-09-25-agents-workflows-design.md` §9) — not yet built.

**Skill gaps** (a step a workflow currently runs inline from the main session, not yet extracted into a reusable skill):

| # | Skill | Plugin | Benefits |
| --- | --- | --- | --- |
| G3 | `engineering-dependency-upgrade` | engineering | `workflow-dependency-upgrade` |
| G4 | `engineering-bugfix` (reproduce → evidence → failing test → root cause → minimal fix) | engineering | WF02 |
| G6 | `ops-ci-pipeline` (GitHub Actions / GitLab CI / Jenkins) | ops | WF11 |
| G7 | `engineering-codebase-onboarding` (brownfield → `project-knowledge/`) | engineering | `workflow-onboarding` |
| G8 | `engineering-tech-debt-audit` | engineering | `workflow-tech-debt-review` |
| G11 | `engineering-docs-sync` | engineering | WF12 |

**Future workflows:** `workflow-new-project`, `workflow-dependency-upgrade` (G3),
`workflow-onboarding` (G7), `workflow-tech-debt-review` (G8).

**Provider / platform (P1–P7):**

| # | Item | Note |
| --- | --- | --- |
| P1 | Agents/workflows for Cursor, Antigravity | Antigravity might project to native `.agent/workflows/`, Cursor to `.cursor/commands/` [Unverified] |
| P2 | Native Claude workflow `.js` | Deterministic fan-out (e.g. multi-module WF04); costs tokens, user opt-in |
| P3 | Hooks (e.g. pre-commit calling quality-auditor) | Hooks in a plugin subagent are ignored by Claude; must live in project `settings.json` |
| P4 | `[agents]` in `.codex/config.toml` | Persistent config, needs explicit user confirmation |
| P6 | Workflows for Cowork | Cowork has no subagents; only add if a sequential fallback exists |
| P7 | Rules layer (coding/git/security/architecture/production) | Separate spec. Rules are currently spread across `core/principles`, `shared/principles.md`, `AGENTS.md`, `git-workflow`, `code-convention.md`; a Production (deploy/incident) rule set is still missing |

## CLI

Every command runs `node cli/index.mjs`.

```bash
aip                 # menu wizard: install | uninstall | build | check
aip --all           # wizard listing EVERY skill incl. drafts + all workflows (source installs)
aip install   --provider all|<p>... [--plugin all|<id>...] [--skill <a,b>] [-g] [--yes] [--as-plugin]
aip uninstall [--provider ...] [--plugin ...] [--skill <a,b>] [-g] [--yes]   # alias: remove
aip build     --provider all|<p>...   # alias flag: --target
aip check     [-g]
aip update    [-g]        # git pull + rebuild + reinstall tracked installs
aip pack                  # bundle Cowork skills -> build/cowork/<skill>.zip
aip list                  # discovered adapters + plugins
```

- **Scope**: `project` (default, cwd) or `global` (`-g` / `--scope global`, home dir).
- **`--plugin <id>...`** selects whole plugins (all of their skills); **`--skill <a,b>`**
  selects individual skills as `plugin/skill` (e.g. `backend/backend-init`) — a bare
  skill name resolves when it is unambiguous. `--plugin` and `--skill` union together.
  `core/principles` is always installed (forced); `core/git-workflow` is selectable
  (default-on with a whole plugin, narrow it out with an explicit `--skill core/...`).
- **Install** is symlink-first (junctions on Windows) with a copy fallback, and is
  additive — installing another plugin or skill unions with what is already there. It
  also merges the baseline managed block into the project's instruction file.
- **`--as-plugin`** (Claude only) installs via the `claude` CLI as a real plugin
  (marketplace + namespaced `<id>:<skill>`) instead of flat `.claude/skills/`;
  requires `claude` on PATH. It installs the whole plugin of each selected skill
  (skills cannot be split in plugin-mode) and warns when a `--skill` narrows this.
- **Wizard** selection is skill-granular: skills are grouped by plugin (toggling the
  plugin header cascades to all of its children), so you can pick whole plugins or
  individual skills in one list; `core/principles` stays locked-on.
- **`--all`** makes the wizard list every skill in the source tree — drafts (e.g. the `data-oltp-*` / `data-olap-*` skills, marked
  `(draft)`) and all workflows — instead of only what `plugins/_published.json` offers. It does not
  switch off the wizard; non-interactive `aip install --plugin all` already installs everything.
- **Uninstall** (alias `remove`) removes only tracked paths (never link targets),
  prunes emptied directories, and reference-counts the shared managed block.
- Providers installed by default: `claude`, `cursor`, `codex`. `antigravity` builds
  but installs only when named explicitly (`--provider antigravity`).

`aip build` keeps draft skills out of the Claude marketplace: they are written to `build/claude/drafts/<plugin>/…`, still installable with `--plugin`/`--skill` (skills mode only — `--as-plugin` installs the marketplace plugin, which has no draft skills). Pass `--include-draft` (`node cli/build.mjs --include-draft`) to build them into the plugin tree as before.

State for every install lives in `<scope-root>/.ai-engineering/manifest.json`.

## Distribution

Two ways to get the Claude content into a project:

- **Plugin-mode — the standard Claude path.** `aip install --provider claude --as-plugin` (or add the marketplace yourself) installs real plugins, namespaced `<id>:<skill>`. Only plugin-mode carries the core **hooks** (`${CLAUDE_PLUGIN_ROOT}` exists only for installed plugins).
- **Skills-mode** — flat `.claude/skills/`. Use it to pick individual skills, or to bundle skills for Cowork (`aip pack`). It installs **no hooks**.

Do not install the same plugin in both modes: every skill would appear twice. `aip install` in skills-mode now warns when `claude plugin list` shows a selected plugin already installed from this marketplace (the check is skipped when `AIE_INSTALL_ROOT` is set, and silently when `claude` is not on PATH).

Publishing the marketplace from a git branch (maintainer; needs git >= 2.42 for `git worktree add --orphan`):

```bash
node cli/dist.mjs --dry-run   # build, then print the file list and commit message only
node cli/dist.mjs             # build, then commit build/claude (minus drafts/) to the LOCAL branch `dist`
git push origin dist          # your decision — the script never pushes
```

Users then add it with `claude plugin marketplace add <owner>/<repo>@dist`. [Unverified] Installing the marketplace from a branch ref has not been tried end to end yet; check it once after the first push.

## Hooks

The `core` plugin ships two Claude Code `PreToolUse` hooks (`core/hooks/`; zero-dependency Node). **They exist only in plugin-mode installs** — skills-mode (flat `.claude/skills/`) installs none, because `${CLAUDE_PLUGIN_ROOT}` only exists for installed plugins. A managed `allowManagedHooksOnly` setting disables plugin hooks that are not force-enabled by the administrator.

| Rule | Tool | Decision | Covers |
| --- | --- | --- | --- |
| H1 | Bash, PowerShell | ask | `git push` to `main`/`master`/`dev`/`develop`, and `--force`/`--delete`/`--mirror`/`--all`/`--prune` pushes (compound commands, `git -C`, a preceding `cd`/`chdir`/`pushd`/`Push-Location`/`Set-Location`/`sl` target (a `--` is skipped), quoted refs, flag clusters). A `cd` target containing `$`, `~`, a backtick, `-` or nothing, a `popd`/`Pop-Location`, or any command after `||` / `|` that follows a `cd` cannot be resolved: a push with no refspec / `HEAD` / `@` asks |
| H2 | Bash, PowerShell | deny | `git commit -m` with non-ASCII text — use `git commit -F <file>` (see the `git-workflow` skill) |
| H3 | Read, Edit, Write, MultiEdit, NotebookEdit, Grep | deny | secret files: `.env*`, `*.env`, `.envrc`, `*.pem`/`*.jks`/`*.keystore`/`*.p12`/`*.pfx`/`*.key`/`*.ppk`/`*.p8`, private keys `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519` (also `_sk` and any non-`.pub` suffix), and `credentials`/`credentials.json`/`credentials.yml`/`credentials.yaml` only (symlinks and NTFS streams are resolved; [Unverified] 8.3 short names). `.env.example`/`.env.sample`/`.env.template` and `*.pub` are allowed |
| H3 | Bash, PowerShell | ask | a command that names a secret file |
| H5 | Edit, Write, MultiEdit, NotebookEdit | deny | an agent with `writeScope` writing outside its scope (anchored to the git root of the target file, not of the session cwd): `engineering-release-scribe`, `engineering-spec-analyst`, `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer`. The main session and other agents are not locked |

The scripts fail open: an internal error (empty stdin, broken JSON, missing fields) exits 0 with no decision. When `guard-bash` cannot parse a command reliably it falls toward `ask` (`guard-files` does not). There is no H4: the ops agents have no Bash tool.

**Limits / residual risk.** The hooks are a regex gate, not a sandbox.

- Not caught: `bash -c "…"` / `eval`, escaped refs such as `ma\in`, `$'…'` literals, and secret files outside the list above (for example `credentials.csv`, `credentials.xml`, `credentials.toml`).
- H5 guards write tools only — an agent that has Bash can still write elsewhere. Outside any git repository H5 falls back to the session cwd as the anchor.
- Command parsing is POSIX-shaped. For the PowerShell tool a backtick line continuation and backtick escapes (``git push origin ` `` + newline + `main`, ``ma`in``) are normalized before parsing, so they do not hide a push; other PowerShell-only syntax (here-strings `@'…'@`, `Invoke-Expression`, `-EncodedCommand`) is not parsed and is not caught.
- [Unverified: depends on ripgrep defaults] Grep on a directory path may read a non-hidden `prod.env` inside it; H3 checks the Grep `path`/`glob`, not the files the directory walk reaches.
- [Unverified] whether a hook `ask` still prompts when the session runs in `bypassPermissions` mode. Run one manual smoke test (`git push origin main` in a scratch repo) before relying on H1 in that mode.
- Cost: measured at about 0.2 s per guarded tool call on Windows (a Node process is spawned per call).
- The Grep `glob` check is a best-effort heuristic (for example `*.k*` is not recognized as a key glob).
- Known false positives, all on the safe side: `.env.local.example`, public `*.pem` certificates, files such as `src/id_rsa.go`, Bash commands that merely mention `import.meta.env` or `config.env`, `grep -rn credentials src` (ask), `node -e "console.log(o.key)"` (ask), and `git commit -F -` heredoc bodies that mention `.env` (ask). The Read deny also hits committed `.env.development`/`.env.production`/`.env.test` (Vite/Next).

**Turning hooks off temporarily.** Disable or uninstall the `core` plugin: `claude plugin disable core@ai-engineering-platform` (`--scope user|project|local`; the command exists in `claude plugin --help`), and `claude plugin enable core@ai-engineering-platform` to restore it. [Inference] Disabling `core` also disables its skills. [Unverified] whether `/hooks` inside a session can switch a single plugin hook off. [Unverified] Every domain plugin declares `dependencies: ["core"]`; how Claude Code treats those dependents when `core` is disabled or uninstalled (refuse, cascade, or leave them running without core) was not checked — run `claude plugin disable` and read its output before relying on it.

## Eval

`evals/<plugin>/<case>/` holds 3 `claude plugin eval` cases (`engineering/spec-writing-routes`, `backend/code-review-readonly`, `workflows/bugfix-routes`). They live at repo level and are not shipped in plugins or the npm package. `npm test` only checks their structure; **running them is manual, calls a model on your account and costs money**, so they are not part of `npm test` or CI.

Run from the repo root:

```bash
aip install --provider claude --as-plugin --plugin engineering -g --yes
claude plugin eval engineering@ai-engineering-platform --eval-dir evals/engineering --ablation none --runs 3 --threshold 0.8 --max-cost-usd 5 --no-publish --allow-tools Write Edit
```

[Unverified] No case has been run end to end yet; follow the first-run checklist and per-plugin flags in [evals/README.md](evals/README.md) (start with `--case <name> --runs 1 --max-cost-usd 0.5`).

## Provider Outputs

`aip build` writes one tree per provider under `build/<provider>/`:

| Provider | Build output | Installed into (project scope) |
| --- | --- | --- |
| Claude | `.claude-plugin/marketplace.json` + `plugins/<id>/` (core as a dependency plugin) | `.claude/skills/<skill>`; baseline block → `CLAUDE.md` |
| Cursor | `<id>/.cursor/rules/<id>-00-principles.mdc` + `.cursor/skills/<skill>/` | `.cursor/rules` + `.cursor/skills` |
| Codex | `<id>/skills/<skill>/SKILL.md` (native skills) | `.agents/skills/<skill>` (global: `~/.agents/skills`; agents stay in `.codex/agents/`); baseline block → `AGENTS.md` |
| Antigravity | `<id>/AGENTS.md` + `docs/workflow/<skill>/` | on explicit install; baseline block → `AGENTS.md` |

Any skill that ships a `references/` folder ships it to **every** provider (parity,
enforced by `test/validate.mjs`).

**Codex upgrade note.** Skills moved from `.codex/skills` to `.agents/skills`. Run `aip update` (add `-g` for a global install) or reinstall: the install manifest removes the legacy `.codex/skills` copy. A legacy copy that the manifest does not track must be removed by hand. The installer never overwrites or deletes a foreign regular file; a foreign real directory is merged and its existing files are kept (skipped with a warning); an existing symlink/junction at the destination is replaced.

## Authoring content

- **New skill** → add `plugins/<id>/skills/<skill-id>/SKILL.md` with frontmatter
  (`name`, `description`, `order`, `title`, `runsIn`, `invoke`). It is auto-discovered —
  no manifest list to update. Put shipped reference files under `skills/<skill>/references/`.
  The body must have `## Quy trình…` and `## Ranh giới an toàn…` H2 headings (a suffix after a
  space is allowed), enforced by `test/validate.mjs`.
  The `description` follows a fixed template: one action sentence (≤ 200 chars), then
  `Dùng khi người dùng muốn "…", "…", "…"` (3–5 quoted triggers), then
  `Không dùng khi <case> → <id>.` (real skill/workflow/agent ids) — at most 500 characters
  (target 450; workflow descriptions are capped at 500 too), no boilerplate, and no quoted trigger repeated from another skill. Agent
  descriptions are ≤ 260 characters and end with `Dùng khi …`.
- **New provider behavior** → edit `adapters/<provider>/adapter.mjs`; keep it a pure
  `build(plugins, { outDir, marketplace, core }) -> fileEntry[]` where an entry is
  `{path, content}` | `{path, copyFrom}` | `{path, copyDir}`.
- Run `npm run build` and `npm test` (which runs `test/validate.mjs --build`).
- Any content change → bump the owning plugin's version and run `node cli/lib/versions.mjs --lock` (Claude Code caches plugins by version).

## Maintainer

```bash
npm test            # validate --build + install + wizard + managed-block + pack-guard
npm run build       # build all providers into build/
npm run validate    # source + build-output contract
npm run overlap     # skill/workflow overlap report (advisory)
npm run pack:verify # assert the npm-publish file set stays within pack.config.json
```

Cowork upload: `cli/lib/pack.mjs` bundles the `_cowork.json` skill set into
deterministic `build/cowork/<skill>.zip` files for Customize → Skills → Upload.

## Publish to npm (maintainer)

The package uses the `files[]` allowlist in `package.json`; the `prepack` hook runs
pack-guard automatically (fail-loud if the file set drifts from `pack.config.json`).
The npm package ships **core only**: pack-guard rejects any `plugins/<id>/` whose id is not
listed in `shipPlugins` (empty by default), rejects `workflows/`, and fails if a plugin listed in
`shipPlugins` is missing. `plugins/_published.json` only controls what the wizard offers from
source — it no longer decides what the tarball contains.
The package is unscoped, so it publishes public by default. In order:

```bash
# 1. Log in to npm (once per machine); npm whoami to check
npm login

# 2. Validate before publishing
npm test
npm run build

# 3. Inspect the publish file set (writes nothing)
npm run pack:verify        # or npm run pack:show to list it
npm pack --dry-run         # see exactly what the tarball contains

# 4. Bump version — creates a commit + vX.Y.Z tag, requires a clean git tree
npm version patch          # or minor | major

# 5. Publish (prepack runs pack-guard before packing)
npm publish

# 6. Push the commit + tag to the remote
git push --follow-tags
```

Note: a published version **cannot** be overwritten; to fix, bump a new version.
Do not publish from a protected branch — bump/tag on a working branch for review.

## Docs

- [CHANGELOG.md](CHANGELOG.md) — version history.
- [MIGRATION.md](MIGRATION.md) — upgrade guide.
- [docs/superpowers/specs/](docs/superpowers/specs/) — design records.

## Change checklist

- Update `README.md` first, then synchronize [README_VI.md](README_VI.md).
- Keep the plugin catalog and provider tables aligned with `plugins/` and `adapters/`.
- Run `npm test` after any structure, content, or projection change.
