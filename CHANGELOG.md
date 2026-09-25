# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- **Publish set** — `plugins/_published.json` now includes `engineering` and `ops` (previously
  draft-only); `data` stays draft. `package.json` `files`, `pack.config.json` `allowTop`, and
  the npm-publish tarball now include `workflows/`, `plugins/engineering/`, `plugins/ops/`.

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
