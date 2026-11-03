# Agents in CI

Moved verbatim from the `### Agents in CI` section of the AI Engineering baseline (`AGENTS.md`), which keeps a pointer to this file.

### Agents in CI

(Claude Code. Facts are [Unverified] secondary summaries of [headless](https://code.claude.com/docs/en/headless).)

- Run `claude -p` with `--permission-mode dontAsk`, an explicit `--allowedTools` list, `--max-turns` and `--max-budget-usd`.
- Add `--bare` when plugins and hooks are not needed; without it `-p` loads the project's hooks and `.mcp.json` with no trust prompt.
- Pin third-party actions to a full commit SHA; give the job read-only tokens.
- Any workflow that can push runs in a protected environment with required reviewers.
