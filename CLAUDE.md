# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`ai-engineering-platform` (CLI: `aip`) projects **canonical AI-agent capability content** into **provider-native files** for Codex, Claude Code, Cursor, and Google Antigravity. You author capabilities once under `plugins/` and `core/`; the CLI generates the per-provider skills, marketplace, rules, and workflow docs into a target project, and can merge an "AI Engineering" baseline block into that project's `AGENTS.md` / `CLAUDE.md`.

There is no application runtime to start — the deliverable is the CLI and the content it projects. Pure ESM, **zero runtime dependencies**, no build step.

## Commands

Node.js 20+ required.

```bash
npm test            # validate --build + install + wizard + managed-block + pack-guard tests
npm run build       # node cli/build.mjs --target all   -> build/<provider>/
npm run list        # list discovered adapters + plugins
npm run validate    # node test/validate.mjs (source + build-output contract)
npm run pack:verify # pack-guard: assert the npm-publish file set stays within policy
```

Run a **single test file** directly (no build step):

```bash
node test/validate.mjs --build
node test/install.test.mjs
```

End-user lifecycle (run from inside a *target* project, after `npm link`):

```bash
aip                 # interactive menu wizard (install | uninstall | build | check)
aip install   --provider all --plugin all [-g] [--yes]
aip uninstall [--provider ...] [--plugin ...] [-g] [--yes]
aip build     --provider all
aip check     [-g]
aip update    [-g]          # git pull + rebuild + reinstall tracked installs
aip list
```

Every command runs `node cli/index.mjs` — no tsc/dist.

## Architecture

### Build/runtime mix
Pure ESM, zero runtime dependencies (Node built-ins only, incl. a hand-rolled YAML-frontmatter parser and ZIP writer). `cli/index.mjs` is the entry point (arg parse + routing + wizard gate). Logic lives in `cli/lib/*.mjs` and `cli/build.mjs`. The `bin` entries (`aip`, `ai-engineering-platform`) and all tests run directly from source.

### The projection pipeline (the core idea)
Content flows one direction: **canonical source → in-memory model → adapter → files on disk.**

1. **Canonical source** — `plugins/<id>/` (`.manifest.json` = `{id,name,description,version}` + `shared/principles.md` + `skills/<skill-id>/SKILL.md` + `agents/<agent-id>.md`), plus `plugins/_marketplace.json` (marketplace identity) and `plugins/_cowork.json` (the skill set zipped for Anthropic Cowork upload). Shared content lives in `core/` (`agents/AGENTS.template.md`, `principles/`, `skills/git-workflow/`). Cross-plugin workflows live in the repo-level `workflows/` (`<slug>/WORKFLOW.md`, `orchestrator/WORKFLOW.md`, registry table in the orchestrator body) plus `templates/workflows/workflow.template.md`. Project scaffolding lives in `templates/init/` + `templates/skills/`.
2. **`cli/lib/plugins.mjs`** — `loadPlugins()` scans `plugins/*/.manifest.json` (dirs starting `_` are config, not plugins); `loadSkills()` discovers `skills/*/SKILL.md`, parses frontmatter with a zero-dep parser, and orders by `order`. `loadAgents()` discovers `agents/*.md` per plugin (frontmatter `name`, `description`, `mode`, `skills`). `loadCore()` returns core as a plugin-shaped object. `loadWorkflows()` returns `workflows/` as a plugin-shaped object (`{ id: 'workflows', name, version, description, stages: [...], agents: [] }`), one stage per `WORKFLOW.md` parsed with the same frontmatter parser plus `kind`, `tier`, `risk`, `agents[]`, `requires[]`. The skill is the unit; frontmatter (`order`, `pipeline`, `next`, `runsIn`, `invoke`, `sharedAssets`) describes each one — **this repo runs skills as standalone recipes** (`pipeline: false`, no mandatory chain).
3. **`cli/build.mjs`** — `discoverAdapters()` scans `adapters/*/adapter.mjs` (auto-discovered by convention; `_`-prefixed dirs skipped). Each adapter is a pure function `build(plugins, { outDir, marketplace, core }) -> fileEntry[]`, where an entry is `{path, content}` | `{path, copyFrom}` | `{path, copyDir}`. `cli/lib/write.mjs` `writeFiles()` is the sole materializer.
4. **`cli/lib/install.mjs`** — `install()` / `uninstall()` / `check()` / `update()` apply the built output to the target project: symlink-first with copy fallback (junctions on Windows; copy when run from `node_modules`), child-by-child directory merge that never clobbers user files, and additive installs. Everything is recorded in `<scope-root>/.ai-engineering/manifest.json`.

### State and ownership
All managed state lives in a single flat file: `<scope-root>/.ai-engineering/manifest.json` (per-install `files[]`, `links[]`, `managed[]`). `install.mjs` uses it to remove only tracked paths on uninstall (never link targets), prune emptied directories, and **reference-count** the shared managed block. Managed instruction files (`AGENTS.md`, `CLAUDE.md`) are updated *in place*: `cli/lib/managed-block.mjs` rewrites only the baseline block between its markers (source region = `core/agents/AGENTS.template.md`), leaving everything outside the markers untouched.

### Scope
Every lifecycle command takes a scope: **project** (default, cwd) or **global** (`-g` / `--scope global`, home dir). `$AIE_INSTALL_ROOT` overrides the scope root (used by tests to isolate installs). `install` supports `claude`, `cursor`, `codex`; `antigravity` **builds** but is not installed by default (installable via explicit `--provider antigravity`).

### Interactive wizard
`cli/lib/wizard.mjs` is a step-machine with back-navigation and injectable deps; zero-dep TUI primitives (`selectOne`, `selectMany`, `confirmStep`) live in `cli/lib/prompt.mjs`. Step logic is separated from terminal I/O so it is unit-testable without a TTY. `cli/index.mjs` routes to the wizard when stdin is a TTY and no explicit flags are given, else to non-interactive execution.

### npm packaging guard
`cli/lib/pack-guard.mjs` + `pack.config.json` verify (on `prepack`) that the npm-publish file set stays within an allowlist (fail-loud). This is separate from `cli/lib/pack.mjs`, a zero-dep deterministic ZIP packer that bundles the `_cowork.json` skill set for Anthropic Cowork upload.

### Adding capability content
- New skill → add `plugins/<id>/skills/<skill-id>/SKILL.md` (frontmatter: `name`, `description`, `order`, `title`, `runsIn`, `invoke`, `pipeline: false`, `next: null`). It is auto-discovered; run `npm run build` to verify output.
- New agent → `plugins/<id>/agents/<id>-<slug>.md` (frontmatter `name`, `description`, `mode`, `skills`; body 4 heading).
- New workflow → copy `templates/workflows/workflow.template.md` thành `workflows/<slug>/WORKFLOW.md`, thêm dòng vào registry của `workflows/orchestrator/WORKFLOW.md`.
- New provider behavior → edit `adapters/<provider>/adapter.mjs`; keep it a pure `build(plugins, ctx) -> fileEntry[]`.
- Changes affecting projection should be covered by `test/*.test.mjs` and the `test/validate.mjs` contract.

## Conventions

- The repository-wide agent execution baseline (read-before-write, surgical changes, fail-loud, verification contract) is defined in [AGENTS.md](AGENTS.md) — kept byte-identical to `core/agents/AGENTS.template.md` — and applies here.
- **Language:** user-facing repository work is written in Vietnamese (proper UTF-8 with diacritics). Docs ship as paired `README.md` / `README_VI.md`; skill content is Vietnamese.
- Source files are UTF-8 **without BOM**, LF line endings.
- Content spans `core` (principles + `git-workflow`) and 5 plugins under `plugins/`: `backend`, `frontend`, `engineering`, `ops` are **published** (offered by the wizard, shipped in the npm package); `data` stays **draft** (builds/validates and installs via explicit `--plugin`/`--skill`, not offered by default nor shipped — see `plugins/_published.json`). Cross-plugin **workflows + the orchestrator** live in the repo-level `workflows/`; domain **agents** live in `plugins/<id>/agents/`. There is no mandatory pipeline; every skill and workflow is invoked on demand.
