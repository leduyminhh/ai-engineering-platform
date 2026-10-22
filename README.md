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

> **The npm package ships core only** — the baseline principles and the `git-workflow` / `git-release` / `artifact-templates` skills
> (`core:principles` + `core:git-workflow` + `core:git-release` + `core:artifact-templates`). Plugins (`backend`, `frontend`, `engineering`,
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
| `core/` | Shared baseline: `agents/AGENTS.template.md`, `principles/`, the shared `skills/git-workflow/`, `skills/git-release/` and `skills/artifact-templates/` (the 11 artifact templates, incl. `spec` for living specs in `docs/specs/`; `check-request.mjs` warns W1–W14) recipes, and the safety `hooks/` (plugin-mode only). |
| `evals/` | `claude plugin eval` cases per plugin (manual run; not shipped; `npm test` checks structure only). |
| `templates/` | `init/` project scaffold (dropped by `*-init` skills); `project-knowledge/`, `docs/requests/_TEMPLATE/` and `docs/decisions/_TEMPLATE.md` are generated from `core/skills/artifact-templates/`. |
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
| `core` | Shared baseline every plugin depends on. | `principles`, `git-workflow`, `git-release`, `artifact-templates` |
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
tree because a workflow calls across plugins.

An agent never commits, pushes, or opens a PR, and never dispatches another agent — only a
workflow (running in the main session) orchestrates and calls `core:git-workflow` after a
checkpoint. Every agent report is structured (result, `file:line`, residual risk); a claim
of "ran / passed" always carries evidence, or `not_run` + reason.

### Agents (16)

`mode` is provider-neutral: Claude maps `read-only` → `disallowedTools: Edit, Write, NotebookEdit, Agent`
and `write` → `disallowedTools: Agent`; Codex maps `read-only` → `sandbox_mode: "read-only"` and
`write` → `"workspace-write"`.

| Agent id | Plugin | Mode | Skills packaged | Used in |
| --- | --- | --- | --- | --- |
| `backend-implementer` | backend | write | backend-implement, backend-api-contract | WF01 |
| `backend-test-writer` | backend | write | backend-testing | WF01, WF02, WF06 |
| `backend-reviewer` | backend | read-only | backend-code-review, backend-api-contract (drift check) | WF01, WF02, WF09 |
| `backend-fixer` | backend | write | backend-fix | WF02, WF06, WF09 |
| `backend-performance-analyst` | backend | write | backend-performance | WF09 |
| `data-migration-writer` | data | write | data-db-migration | skill data-db-migration |
| `frontend-implementer` | frontend | write | frontend-implement | WF01 |
| `frontend-data-integrator` | frontend | write | frontend-data-integration | WF01 |
| `frontend-test-writer` | frontend | write | frontend-testing | WF01, WF02, WF06 |
| `frontend-e2e-test-writer` | frontend | write | frontend-e2e-testing | WF01 |
| `frontend-reviewer` | frontend | read-only | frontend-code-review | WF01, WF02, WF09 |
| `frontend-fixer` | frontend | write | frontend-fix | WF02, WF06, WF09 |
| `frontend-performance-analyst` | frontend | write | frontend-performance | WF09 |
| `engineering-quality-auditor` | engineering | read-only | engineering-quality-gate, engineering-convention-enforce (audit mode) | WF01, WF02, WF06 |
| `engineering-spec-analyst` | engineering | write (`docs/` only) | engineering-spec-writing, engineering-adr, engineering-diagram, engineering-task-breakdown | WF01 |
| `ops-incident-investigator` | ops | read-only | ops-incident-troubleshooting, ops-observability | skill ops-incident-troubleshooting |

There is no separate Security agent: `engineering-quality-gate` already covers source-first
quality **and** security review (OWASP/ASVS/CWE, SCA, secrets); a split would only duplicate it.

### Workflows (4) + orchestrator

Id is `workflow-<slug>`, sourced from `workflows/<slug>/WORKFLOW.md`. `tier` sets how deep the
content goes (1 = heavy gates/DoD, 2 = full template but lean, 3 = lean); `risk` drives the
orchestrator's confirmation strictness.

| Code | id | Tier | Risk | Replaces (old plan) | Agents |
| --- | --- | --- | --- | --- | --- |
| WF01 | `workflow-feature` | 1 | medium | W1+W2+W3 | spec-analyst, BE/FE implementer, FE data-integrator, BE/FE test-writer, FE e2e-test-writer, BE/FE reviewer, quality-auditor |
| WF02 | `workflow-bugfix` | 1 | medium | W11 | BE/FE test-writer, BE/FE fixer, BE/FE reviewer, quality-auditor |
| WF06 | `workflow-security-review` | 1 | high | W14 | quality-auditor, backend-test-writer, frontend-test-writer, backend-fixer, frontend-fixer |
| WF09 | `workflow-performance` | 3 | medium | W16 | backend-performance-analyst, frontend-performance-analyst, backend-fixer, frontend-fixer, backend-reviewer, frontend-reviewer |
| — | `workflow-orchestrator` | — | — | new | none (runs in the main session) |

A single-capability task calls the skill directly (the orchestrator routes there too): review →
`backend-code-review`/`frontend-code-review`; refactor → `*-refactor`/`*-migrate-architecture`; tests →
`*-testing`; schema change → `data-db-migration`; incident → `ops-incident-troubleshooting`.

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
aip install --provider codex -g --skill workflows/workflow-security-review
aip install --provider claude --as-plugin --plugin workflows
aip uninstall --skill workflows/workflow-feature
```

Installing a workflow pulls in its dependency closure (`requires` + the skills of every agent
it lists) automatically, printed as `[aip] workflow-feature pulls in: backend/backend-implement, …`;
uninstalling drops what no other remaining workflow still needs.

### Roadmap

Open gaps — not yet built.

**Skill gaps** (a step a workflow currently runs inline from the main session, not yet extracted into a reusable skill):

| # | Skill | Plugin | Benefits |
| --- | --- | --- | --- |
| G3 | `engineering-dependency-upgrade` | engineering | `workflow-dependency-upgrade` |
| G4 | `engineering-bugfix` (reproduce → evidence → failing test → root cause → minimal fix) | engineering | WF02 |
| G6 | `ops-ci-pipeline` (GitHub Actions / GitLab CI / Jenkins) | ops | — |
| G7 | `engineering-codebase-onboarding` (brownfield → `project-knowledge/`) | engineering | `workflow-onboarding` |
| G8 | `engineering-tech-debt-audit` | engineering | `workflow-tech-debt-review` |
| G11 | `engineering-docs-sync` | engineering | — |

**Future workflows:** `workflow-new-project`, `workflow-dependency-upgrade` (G3),
`workflow-onboarding` (G7), `workflow-tech-debt-review` (G8).

**Provider / platform (P1–P7):**

| # | Item | Note |
| --- | --- | --- |
| P1 | Agents/workflows for Cursor, Antigravity | Antigravity might project to native `.agent/workflows/`, Cursor to `.cursor/commands/` [Unverified] |
| P2 | Native Claude workflow `.js` | Deterministic fan-out (e.g. multi-module review); costs tokens, user opt-in |
| P3 | Hooks (e.g. pre-commit calling quality-auditor) | Hooks in a plugin subagent are ignored by Claude; must live in project `settings.json` |
| P4 | `[agents]` in `.codex/config.toml` | Persistent config, needs explicit user confirmation |
| P6 | Workflows for Cowork | Cowork has no subagents; only add if a sequential fallback exists |
| P7 | Rules layer (coding/git/security/architecture/production) | Separate spec. Rules are currently spread across `core/principles`, `shared/principles.md`, `AGENTS.md`, `git-workflow`, `code-convention.md`; a Production (deploy/incident) rule set is still missing |

## CLI

Every command runs `node cli/index.mjs`.

```bash
aip                 # menu wizard: init | install | uninstall | update | build
aip --all           # wizard listing EVERY skill incl. drafts + all workflows (source installs)
aip init      [--full]    # AGENTS.md (baseline) + CLAUDE.md importing @AGENTS.md; --full adds templates/init and .claude/settings.json (permission policy, only if missing); skips existing files
aip install   --provider all|<p>... [--plugin all|<id>...] [--skill <a,b>] [-g] [--yes] [--as-plugin]
aip uninstall [--provider ...] [--plugin ...] [--skill <a,b>] [-g] [--yes]   # alias: remove
aip build     --provider all|<p>...   # alias flag: --target
aip check     [-g]
aip update    [-g]        # git pull + rebuild + reinstall tracked installs
aip pack                  # bundle Cowork skills -> build/cowork/<skill>.zip
aip list                  # discovered adapters + plugins
aip stats     [--session <path>] [--json] [--usage [--since <days|yyyy-mm-dd>]]   # context size, or token + cost per model, from the transcript
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
- **`aip stats`** reads the Claude Code transcripts of the current project. Without flags it prints a table of the top 10 sessions sorted by peak context (turns, first, peak, last); `--session <path>` prints the full breakdown of one session; `--json` prints raw JSON. `--usage [--since <days|yyyy-mm-dd>]` (default 7 days, filtered by each line's timestamp) aggregates tokens and money per model, main session vs subagents, plus cache signals (model switches, idle gaps over 60 minutes before a large cache write, cache writes above 50% of context). Money comes from the `cost-state` records that Claude Code writes: it covers the whole session including subagents, is not split by the `--since` window, and can differ from invoices. aip has no price table (no price list of its own) and does not predict plan limits; a session without `cost-state` shows `—` for money. [Unverified] It relies on the layout `~/.claude/projects/<slug>/*.jsonl` and on the meaning of `cost-state`, both internal to Claude Code and not a public contract. The table shows only the subagent share; the per-agent breakdown is in `--json`. `--since yyyy-mm-dd` means 00:00 UTC of that day. Each `message.id` is counted once across the whole project, including fork/resume copies; a session that lost such turns is marked in the table (money from `cost-state` is not reduced). It only reads, never prints conversation content, and writes nothing.
- Providers installed by default: `claude`, `cursor`, `codex`. `antigravity` builds
  but installs only when named explicitly (`--provider antigravity`).

`aip build` keeps draft skills out of the Claude marketplace: they are written to `build/claude/drafts/<plugin>/…`, still installable with `--plugin`/`--skill` (skills mode only — `--as-plugin` installs the marketplace plugin, which has no draft skills). Pass `--include-draft` (`node cli/build.mjs --include-draft`) to build them into the plugin tree as before.

State for every install lives in `<scope-root>/.ai-engineering/manifest.json`.

## Distribution

Two ways to get the Claude content into a project:

- **Plugin-mode — the standard Claude path.** `aip install --provider claude --as-plugin` (or add the marketplace yourself) installs real plugins, namespaced `<id>:<skill>`. Only plugin-mode carries the core **hooks** (`${CLAUDE_PLUGIN_ROOT}` exists only for installed plugins).
- **Skills-mode** — flat `.claude/skills/`. Use it to pick individual skills, or to bundle skills for Cowork (`aip pack`). It installs **no hooks**.

Do not install the same plugin in both modes: every skill would appear twice. `aip install` in skills-mode now warns when `claude plugin list` shows a selected plugin already installed from this marketplace (the check is skipped when `AIE_INSTALL_ROOT` is set, and silently when `claude` is not on PATH).

Subagent model safety net: plugin agents already declare `model: sonnet`. For subagents outside the plugin, set `{"env": {"CLAUDE_CODE_SUBAGENT_MODEL": "sonnet"}}` in `~/.claude/settings.json`. Subagent model precedence ([sub-agents](https://code.claude.com/docs/en/sub-agents)): call-time parameter → frontmatter `model` → `CLAUDE_CODE_SUBAGENT_MODEL` → main-session model. `aip` never writes your user settings.

Publishing the marketplace from a git branch (maintainer; needs git >= 2.42 for `git worktree add --orphan`):

```bash
node cli/dist.mjs --dry-run   # build, then print the file list and commit message only
node cli/dist.mjs             # build, then commit build/claude (minus drafts/) to the LOCAL branch `dist`
git push origin dist          # your decision — the script never pushes
```

Users then add it with `claude plugin marketplace add <owner>/<repo>@dist`. [Unverified] Installing the marketplace from a branch ref has not been tried end to end yet; check it once after the first push.

## Hooks

The `core` plugin ships five Claude Code hooks (`core/hooks/`; zero-dependency Node): three `PreToolUse` guards (`guard-bash` and `guard-files`: H1–H5 below; `guard-mcp`, below), a `Stop`/`SubagentStop` verification gate (`gate-stop`, below) and a `SessionStart` hook (`session-start`, below). **They exist only in plugin-mode installs** — skills-mode (flat `.claude/skills/`) installs none, because `${CLAUDE_PLUGIN_ROOT}` only exists for installed plugins. A managed `allowManagedHooksOnly` setting disables plugin hooks that are not force-enabled by the administrator.

| Rule | Tool | Decision | Covers |
| --- | --- | --- | --- |
| H1 | Bash, PowerShell | ask | `git push` to `main`/`master`/`dev`/`develop`, and `--force`/`--delete`/`--mirror`/`--all`/`--prune` pushes (compound commands, `git -C`, a preceding `cd`/`chdir`/`pushd`/`Push-Location`/`Set-Location`/`sl` target (a `--` is skipped), quoted refs, flag clusters). A `cd` target containing `$`, `~`, a backtick, `-` or nothing, a `popd`/`Pop-Location`, or any command after `||` / `|` that follows a `cd` cannot be resolved: a push with no refspec / `HEAD` / `@` asks |
| H2 | Bash, PowerShell | deny | `git commit -m` with non-ASCII text — use `git commit -F <file>` (see the `git-workflow` skill) |
| H3 | Read, Edit, Write, MultiEdit, NotebookEdit, Grep | deny | secret files: `.env*`, `*.env`, `.envrc`, `*.pem`/`*.jks`/`*.keystore`/`*.p12`/`*.pfx`/`*.key`/`*.ppk`/`*.p8`, private keys `id_rsa`/`id_dsa`/`id_ecdsa`/`id_ed25519` (also `_sk` and any non-`.pub` suffix), and `credentials`/`credentials.json`/`credentials.yml`/`credentials.yaml` only (symlinks and NTFS streams are resolved; [Unverified] 8.3 short names). `.env.example`/`.env.sample`/`.env.template` and `*.pub` are allowed |
| H3 | Bash, PowerShell | ask | a command that names a secret file |
| SS | SessionStart | context | `startup`/`clear`/`compact`: injects the newest usable `handoff.md`; `resume`/`fork` of a cold session: one-line cost warning (see `session-start` below) |
| H5 | Edit, Write, MultiEdit, NotebookEdit | deny | an agent with `writeScope` writing outside its scope (anchored to the git root of the target file, not of the session cwd): `engineering-spec-analyst`, `backend-test-writer`, `frontend-test-writer`, `frontend-e2e-test-writer`. The main session and other agents are not locked |

The scripts fail open: an internal error (empty stdin, broken JSON, missing fields) exits 0 with no decision. When `guard-bash` cannot parse a command reliably it falls toward `ask` (`guard-files` does not). There is no H4: the ops agents have no Bash tool.

**Per-project switch `allowEnvFiles`.** With `{"allowEnvFiles": true}` in `<git-root>/.claude/aip-gate.json`, H3 no longer asks or denies for env files (`.env*`, `*.env`, `.envrc`) in that project; key files and `credentials*` stay blocked, also when a command names them next to an env file, and H1/H2/H5 are unchanged. The file is read from the worktree root first, then from the main repository root, so a worktree created before the file was committed follows the project. `guard-files` reads the switch from the repository that holds the target file (not the session cwd); `guard-bash` reads it from the session cwd. Missing file, invalid JSON or any value other than `true` keeps the default. The baseline rule about secret files still applies to the agent; the switch only removes the hook prompt.

**MCP gate (`guard-mcp`).** A `PreToolUse` hook with matcher `mcp__.*`; it reads two arrays of strings from `<git-root>/.claude/aip-gate.json`: `mcpAllow` and `mcpDeny`. A server is named `<server>` or `plugin:<plugin>:<server>`; the tool `mcp__<server>__<tool>` maps to the first form and `mcp__plugin_<plugin>_<server>__<tool>` to the second. A server listed in `mcpDeny` is denied; when `mcpAllow` is non-empty, a server outside it is denied; `mcpDeny` wins over `mcpAllow`. Entries are trimmed and compared case-sensitively; a list that is not an array of strings is ignored (treated as absent), and an array whose entries are all invalid or empty counts as absent. Without the keys, with a wrong type, or on any internal error nothing changes (fail-open, exit 0, no output). The list is read from the repository of the session cwd. Example: `{"mcpAllow": ["github", "plugin:acme:docs"], "mcpDeny": ["shell"]}`. [Unverified] A hook `deny` holds in every permission mode and the plugin MCP tool name form comes from a secondary summary of the Claude Code docs; check [hooks](https://code.claude.com/docs/en/hooks) before relying on it. This is a name-based gate with residual risk: a project `.mcp.json` server can reuse an allowed name, and `aip-gate.json` is repository content that a pull request can edit; for CI prefer `--bare` or `--strict-mcp-config`. A plugin name must not contain `_` (the parser splits at the first `_` after `plugin_`; such a server fails closed under `mcpAllow`), and a plain server literally named `plugin_acme_docs` is classified as `plugin:acme:docs`. [Unverified] Connector tools appear as `mcp__claude_ai_<server>__<tool>`, so the gate name would be `claude_ai_<server>`; confirm in the [hooks](https://code.claude.com/docs/en/hooks) docs.

**Permission policy.** `core/permissions/policy.json` holds the standard rule groups: `secrets` (`deny`) and `git_push`, `network`, `production_deploy` (`ask`). `aip init --full` writes `.claude/settings.json` with `permissions.deny` and `permissions.ask` built from it **only when the file does not exist**; it never edits an existing one (the existing file is left untouched and `aip init` prints a warning that names `core/permissions/policy.json` so you can compare and add rules yourself), and nothing is written at global scope. It is Claude-only: Cursor, Codex and Antigravity get no permission file yet because their permission and MCP formats are unverified or reported unreliable (for example Cursor `Mcp(...)` rules reported as not matching, an Antigravity allow list reported as ignored). Codex keeps getting `sandbox_mode` from the agent `mode`. The `secrets` rules are `Read(.env)`, `Read(.env.local)`, `Read(.env.production)` and `Read(.env.development)`; per the [permissions docs](https://code.claude.com/docs/en/permissions) a bare filename follows gitignore semantics and matches at any depth, so nested files such as `apps/api/.env` are covered. Other variants (for example `.env.staging`, `.envrc`) are not covered, and `.env.example`, `.env.sample` and `.env.template` stay readable, as in hook H3. Read rules are best-effort for built-in file tools, not for `cat` in Bash. When `.claude/aip-gate.json` has `allowEnvFiles: true` at init time (strictly `true`; a string, `false`, a missing file or broken JSON do not count), `aip init --full` leaves the `secrets` (`.env`) rules out of the generated file. The flag is checked only once, at generation time; if you flip it later, edit `.claude/settings.json` by hand, because the `secrets` rules deny reading `.env` independently of the hook. The `ask` rules are a second layer behind `guard-bash`: [Inference] `Bash(git push *)` does not match `git -C . push …`, which H1 still catches.

**Stop gate (`gate-stop`).** Registered for `Stop` and `SubagentStop`. It blocks **once** when the current turn edited code files (Edit/Write/MultiEdit/NotebookEdit; docs-only edits such as `.md`/`.mdx`/`.txt`/`.rst`/`.adoc` do not count) but ran no test/lint/typecheck/build command after the last edit. It does not judge whether the result is green or red, only whether a check ran; when `stop_hook_active` is set it lets the agent stop, so the agent can stop after explaining why it skipped the check. Disable it with `AIP_STOP_GATE=off` or `<git-root>/.claude/aip-gate.json` `{"stopGate": false}`. Only Bash/PowerShell commands count as a check. Extra command patterns go in `testCommands` (regexes); each is matched per command segment (split on `&&`, `||`, `;`, `|` and newlines) after leading `VAR=x`, `time`, `env` and `timeout <n>` are stripped; for `SubagentStop` the whole subagent transcript is checked, not just the last turn; `exemptAgents` replaces the default `["data-migration-writer"]` and is matched against the `SubagentStop` `agent_type` with any `<plugin>:` prefix stripped. It fails open like the other scripts. [Unverified] It reads Claude Code's internal transcript JSONL, which is not a documented contract and may change.

```json
{
  "stopGate": true,
  "testCommands": ["^make test\\b"],
  "exemptAgents": ["data-migration-writer"]
}
```

**Session start (`session-start`).** Registered for `SessionStart`; on by default. It has two modes. (1) `source` = `startup`, `clear` or `compact`: it injects the content of a handoff file as additional context, prefixed with its relative path and capped at 9,000 characters (Claude Code limits hook context to 10,000). The file is looked up in this order: `handoffPath` from the config (resolved against the session cwd), the most recently modified `docs/requests/*/handoff.md`, then `.claude/handoff.md`. A file older than `handoffMaxAgeHours` (default 24), or one that is empty or still the unfilled template, is ignored. (2) `source` = `resume` or `fork` when the prompt cache is likely expired: it adds one line with the uncached token count and estimated cost when Claude Code supplies them, and points at the handoff file if a usable one exists. Turn it off with `{"handoffInject": false}` (mode 1) and/or `{"resumeWarn": false}` (mode 2) in `<git-root>/.claude/aip-gate.json`. It fails open like the other scripts.

```json
{
  "handoffInject": true,
  "resumeWarn": true,
  "handoffPath": "docs/requests/my-feature/handoff.md",
  "handoffMaxAgeHours": 24
}
```

**Compaction window (`autoCompactWindow`).** Auto-compaction triggers at a token threshold. For a model with a 1M-token window the default is about 967K. Lowering it caps the size of every request, but compaction then runs more often and each compaction loses detail from the earlier conversation. That trade-off is yours to make. There are four ways to set it:

- `/autocompact <100k–1M>` in a session;
- `autoCompactWindow` in your Claude Code settings;
- the `--autocompact` flag;
- the `CLAUDE_CODE_AUTO_COMPACT_WINDOW` environment variable, which has the highest priority (`k`/`M` suffixes are accepted from Claude Code v2.1.304 [Unverified]).

**aip does not write your settings.** This is your configuration (the compaction setting values, not the `.claude/settings.json` permissions file that `aip init --full` creates when missing); `aip` neither sets nor changes it. [Unverified] Caveat: when `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is set, the statusline `used_percentage` is still measured against the full window, so it no longer shows when compaction is about to run.

**Agents in CI.** A minimal recipe for `claude -p` (see the baseline section `Agents in CI`); facts about Claude Code below are [Unverified] summaries of [headless](https://code.claude.com/docs/en/headless) and [permissions](https://code.claude.com/docs/en/permissions):

```bash
claude -p "Review the diff and report findings" \
  --permission-mode dontAsk \
  --allowedTools "Read" "Grep" "Bash(git diff *)" \
  --max-turns 20 --max-budget-usd 2 \
  --bare
```

- `--permission-mode dontAsk` turns every non-allowed action into a denial instead of a prompt nobody can answer; list what is allowed explicitly with `--allowedTools`; cap the run with `--max-turns` and `--max-budget-usd`.
- Use `--bare` when plugins and hooks are not needed. Without it, `-p` loads the project's hooks and `.mcp.json` without a trust prompt, so an untrusted pull request can bring its own hooks and MCP servers.
- Pin third-party actions to a full commit SHA, give the job read-only tokens, and run any workflow that can push in a protected environment with required reviewers.
- aip adds no workflow file to `templates/init`. A read-only pull request review example is described in [Run reviews in CI](#run-reviews-in-ci).

**Parallel agents.** A convention for running several agents at once, one worktree each (see the baseline section `Parallel agents`). aip does not run agents: it ships the convention and one check script; Claude Code creates the worktrees. Only an agent's `writeScope` plus the `guard-files` hook enforce write scope; the rest is soft guidance, and Bash can still write elsewhere.

1. Split the plan into independent tasks. In `plan.md` give each task a `**Files:**` list and a `**Song song:** <group>` line; tasks of one group run together. Check the split with `node core/skills/artifact-templates/scripts/check-partition.mjs <request-dir>` (warnings P1 overlapping files, P2 forbidden shared files; `--strict` exits 1).
2. From the integration branch `feature/<slug>`, create one worktree per task, at most 3 at once: `claude --worktree <slug>-t<n>` gives branch `worktree-<slug>-t<n>` in `.claude/worktrees/<slug>-t<n>/`. By default Claude Code cuts it from the default branch; set `worktree.baseRef` to `"head"` in the Claude Code settings (`{"worktree": {"baseRef": "head"}}`; which settings file is [Unverified], the docs only say "settings") (or create it with `git worktree add`) so it starts at the integration branch tip. Add `.claude/worktrees/` to `.gitignore`.
3. Hand each agent its task and file set. Shared files (version bump, `versions.mjs --lock`, living spec, README) are touched once, by the main session, after merging.
4. In the integration branch merge each task branch with `git merge --no-ff worktree-<slug>-t<n>`, in task order, and run the touched components' tests after each merge. A conflict outside the declared file sets is a split error: stop and report. A human reviews the whole integration branch; there are no per-agent PRs.
5. Clean up with `git worktree remove <path>` only for merged, clean worktrees. Never `rm -rf` a worktree holding a junction from Git Bash on Windows; use Node `fs.rmSync` if you must delete by hand. A `claude -p` session does not clean up its worktree.

| Status | Claim (source) |
| --- | --- |
| [Verified] | `claude --worktree <name>` creates `.claude/worktrees/<name>/` on branch `worktree-<name>`; the base is the default branch unless `worktree.baseRef` is `"head"`; a clean unnamed session removes its worktree on exit, a named one prompts first; `claude -p` never cleans up ([worktrees](https://code.claude.com/docs/en/worktrees)). |
| [Verified] | Subagents with `isolation: worktree` use `.claude/worktrees/` and are removed when they make no changes; commands aimed at the main checkout are blocked; `${CLAUDE_PROJECT_DIR}` stays at the main checkout while hook input `cwd` is the worktree; gitignored files such as `.env` are absent unless listed in `.worktreeinclude` ([worktrees](https://code.claude.com/docs/en/worktrees)). |
| [Unverified: secondary summary of the official page, not re-read] | `WorktreeCreate`/`WorktreeRemove` hooks exist; PreToolUse hooks run inside subagents ([hooks](https://code.claude.com/docs/en/hooks)). |
| [Unverified: secondary summary of the official page, not re-read] | At most 20 concurrent subagents by default ([sub-agents](https://code.claude.com/docs/en/sub-agents)); agent teams are experimental, off by default, recommended at 3-5 teammates and cost noticeably more ([agent-teams](https://code.claude.com/docs/en/agent-teams), [costs](https://code.claude.com/docs/en/costs)). |
| [Unverified] | `isolation: worktree` on a plugin-provided agent (the sub-agents page does not list `isolation` among ignored plugin fields, but does not say it works), and in headless/SDK runs. |
| [Unverified] | The branch name and path of a subagent worktree; the "one branch, one worktree" rule in Claude Code docs (it is git behavior, [Inference]); an official one-PR-per-agent recommendation. |
| [Inference] | The cap of 3 agents is a conservative heuristic, not an official limit. |

`.claude/aip-gate.json` is usually gitignored, so a worktree does not have it: the hooks read the worktree root first, then the main repository root, and `guard-files` anchors `writeScope` at the worktree root. Do not copy it with `.worktreeinclude`.

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

## Run reviews in CI

[`templates/ci/claude-review.example.yml`](templates/ci/claude-review.example.yml) is a read-only pull request review for GitHub Actions: it runs an aip review skill through `anthropics/claude-code-action` and writes the result to the job summary. It is an example to copy: `aip init` does not copy it, so copy it yourself into `.github/workflows/`. Claude Code facts below are [Unverified] summaries of [github-actions](https://code.claude.com/docs/en/github-actions) and [headless](https://code.claude.com/docs/en/headless).

Before use: replace each `<full-40-char-commit-sha>` with the SHA of a release you reviewed, add the repository secret `ANTHROPIC_API_KEY`, and set `plugin_marketplaces` to the Git URL of a repository that holds the marketplace: push the `dist` branch output (`node cli/dist.mjs`) as the default branch of a repository of your own (or use a repository whose root holds `.claude-plugin/marketplace.json`). [Unverified] whether the Action accepts a `#branch` or `--branch` form.

What the example sets (a reduction of risk, not a guarantee):

- Trigger `pull_request`, never `pull_request_target`; permissions `contents: read` and `pull-requests: read` only; every action pinned to a full commit SHA.
- `--permission-mode dontAsk`, an explicit `--allowedTools` list (read tools plus `git diff`/`git log`), and `--max-turns` / `--max-budget-usd` caps.
- A fixed prompt that interpolates nothing from the pull request; output goes to the job summary and the job posts no comments.

Limits:

- Same-repository branches only: the `if` skips fork pull requests, and [Unverified] GitHub usually withholds secrets from fork runs ([github-actions](https://code.claude.com/docs/en/github-actions)).
- [Unverified] `claude -p` without `--bare` loads the project's hooks and `.mcp.json` with no trust prompt (headless doc), while the Action doc says that for pull request runs it restores `.claude/`, `.mcp.json` and similar files from the base branch. Run only on trusted branches.
- [Inference] `pull_request` runs the workflow as it exists on the merge ref, so a same-repository pull request author can edit the workflow file and the root `CLAUDE.md`/`AGENTS.md`; the fixed prompt only protects against content interpolation, not against an author who already has write access.
- Pull request content (diff, comments) is untrusted input. A read-only reviewer can still be prompt-injected, so do not add tools to it.
- [Speculation] A prompt-injected reviewer with `Read` might echo environment secrets into the job summary; whether GitHub masks them there is unchecked. Use a dedicated API key with a low spending limit.
- [Unverified] The Action's default GitHub App authentication may need `id-token: write`; the example deliberately does not grant it, so check before raising permissions.
- [Unverified] `Bash(git diff *)` could in principle write a file through `git diff --output=<file>`; not tested.
- P6b (`aip-runner`, LangGraph, separate repository) is a preliminary design and is not implemented.

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
| Claude | `.claude-plugin/marketplace.json` + `plugins/<id>/` (core as a dependency plugin) | `.claude/skills/<skill>`; baseline block → `CLAUDE.md` (project: → `AGENTS.md` when `CLAUDE.md` imports `@AGENTS.md`) |
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
- [docs/requests/](docs/requests/) — design and plan per request.
- [docs/decisions/](docs/decisions/) — ADRs.

## Change checklist

- Update `README.md` first, then synchronize [README_VI.md](README_VI.md).
- Keep the plugin catalog and provider tables aligned with `plugins/` and `adapters/`.
- Run `npm test` after any structure, content, or projection change.
