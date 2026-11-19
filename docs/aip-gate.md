# Configuring `.claude/aip-gate.json`

> Tiếng Việt: xem [aip-gate_VI.md](aip-gate_VI.md).

This file tunes the `core` plugin hooks per project: permission mode, the Stop gate, MCP filtering, what gets injected at
session start, and how much `plan-execution` asks. This page lists every key in one place and gives a ready-to-copy JSON
template for each mode. The detailed hook rules (H1–H6, path resolution) live in the **Hooks** section of
[README.md](../README.md#hooks).

## Where the file lives and how it is read

- Path: `<git-root>/.claude/aip-gate.json`. There is no global copy and no inheritance from parent directories. Outside a
  git repo the hooks read no file.
- In a worktree: the hooks read the file at the worktree root first, then fall back to the main repo. A worktree file
  that exists but is broken (invalid JSON, not an object) counts as no configuration; it does not fall back.
- Each key has a trust level:
  - **untracked**: a loosening key. It only takes effect when git does **not** track the file. A committed file (which
    may come from a clone you have not reviewed) makes the key fall back to its default.
  - **any**: a tightening or neutral key; it applies even from a committed file.
- Add `.claude/aip-gate.json` to `.gitignore`. `aip mode status` and `aip autonomy status` print the file's git state and
  an ignored-keys line when some key has no effect.
- Do not let an agent edit this file with Write/Edit: the hook asks in `guarded` and denies in `confined` and `open`.
  Use `aip mode`, `aip autonomy`, or edit it yourself.

## Keys

| Key | Type | Trust | Default | Effect |
|---|---|---|---|---|
| `mode` | string | untracked | `guarded` | `"guarded"`, `"confined"` or `"open"` (sections below). Old names still work: `"ask"` is `guarded`, `"full"` is `confined`. Missing, or anything else (`"bypass"`, wrong case), is `guarded`. |
| `fullKeep` | array | untracked | `["push"]` | Gates that stay denied in `confined` mode (not asked: the hook denies them). Only `"push"` exists today. `[]` opens everything; a non-empty array with no recognised item (typo `"Push"`) keeps the default. No effect in `open`. |
| `fullRoots` | array | untracked | `[]` | In `confined` mode, absolute directories outside the project with read, write and delete. No effect in `open`. |
| `fullReadRoots` | array | untracked | `[]` | In `confined` mode, absolute directories with read only. No effect in `open`. |
| `fullPaths` | array | untracked | `[]` | In `confined` mode, per-directory permissions: `[{"path": "<absolute>", "allow": ["read","write","delete"]}]`. No effect in `open`. |
| `allowEnvFiles` | boolean | untracked | `false` | `true` stops blocking/asking on env files (`.env*`, `*.env`, `.envrc`). Key files and `credentials*` stay blocked. |
| `stopGate` | boolean | untracked | on | `false` turns off the Stop gate (blocks once when code was edited but no test/lint/build ran). |
| `testCommands` | array | untracked | no extra patterns | Extra regexes the Stop gate accepts as the project's test command, e.g. `"^make test\\b"`. Invalid regexes are skipped. |
| `exemptAgents` | array | untracked | `["data-migration-writer"]` | Agents the Stop gate never blocks on `SubagentStop`. |
| `autonomy` | object | untracked | `{mergeLocal: false, cleanup: false, partRunner: "session", planRunner: "subagent"}` | How much the `plan-execution` flow asks. Not a tool permission; no hook enforces it. |
| `mcpAllow` | array | any | no filter | Only listed MCP servers are allowed. Ignored while `confined` or `open` is in effect. |
| `mcpDeny` | array | any | no filter | Listed MCP servers are denied. Wins over `mcpAllow` and stays in `confined` and `open`. |
| `bootstrapInject` | boolean | any | on | `false` skips the skill-first rule at session start. |
| `handoffInject` | boolean | any | on | `false` skips loading `handoff.md`. |
| `ledgerInject` | boolean | any | on | `false` skips loading the tail of `.aip/runs/*/*/progress.md`. |
| `resumeWarn` | boolean | any | on | `false` drops the warning on a cold resume or fork. |
| `handoffPath` | string | any | auto-discovered | A `.md` file inside the session cwd to use as the handoff. Paths outside cwd or non-`.md` files are ignored. |
| `handoffMaxAgeHours` | number | any | `24` | Maximum age of the handoff and ledger that get loaded. |
| `statusStaleMinutes` | number | any | `30` | Minutes of silence before `aip status` marks a part as silent too long. |

MCP server names are `<server>` or `plugin:<plugin>:<server>`, matched case-sensitively.

## The three modes

Switch with `aip mode guarded|confined|open|status`. The command always writes the new name; `guarded` removes the `mode`
key and keeps the others. `aip mode ask` and `aip mode full` still run as aliases. `aip mode status` prints the
effective mode, its one-line meaning (the sentences below) and, when the file still uses an old name, a hint to rerun
`aip mode <new name>`.

`confined` and `open` take effect only when **all three** hold:

1. `aip-gate.json` has `"mode": "confined"` or `"mode": "open"` (`"full"` counts as `confined`).
2. The session runs with `permission_mode` `bypassPermissions` (start `claude --permission-mode bypassPermissions` or set
   it in your user settings; project settings cannot turn on bypass).
3. Git does not track `aip-gate.json`.

If any one is missing, the hooks behave as `guarded`. In a `confined` or `open` project with a non-bypass session,
`guard-bash` asks on `git push`, `curl`, `wget`, `kubectl apply`, `terraform apply` and `helm upgrade` itself, because the
`ask` rules in `settings.json` were removed. When a session starts in such a project the hook prints one line,
`aip: mode hiệu lực = <mode> (nguồn <file>)`, so you can see which mode the file asks for; it cannot tell whether the
session is in bypass.

## `guarded` mode (default)

Risky actions ask the user.

Every gate runs: ask on a push to a protected branch or a force push, deny `commit -m` with non-ASCII text, deny/ask on
secret files, keep the agent's `writeScope`, apply `mcpAllow`/`mcpDeny`. An agent that runs `aip mode <name>` is asking to
rewrite `aip-gate.json`, so the hook asks. `.claude/settings.json` keeps the `deny`/`ask` rules generated by
`aip init --full`. No `aip-gate.json` is needed; create one only to tune other keys.

A `guarded` template that tunes the Stop gate, MCP and session-start loading:

```json
{
  "testCommands": ["^make test\\b", "^pnpm vitest\\b"],
  "mcpDeny": ["plugin:playwright:playwright"],
  "handoffMaxAgeHours": 48
}
```

Back to `guarded` from the other modes: `aip mode guarded` (removes the `mode` key, keeps the others).

## `confined` mode

Never asks: work inside the fence passes, work outside it is denied.

For a project you trust, so an agent can run unattended without a prompt hanging the session. It needs the three
conditions above. The fence is the roots and the keys `fullKeep`, `fullRoots`, `fullReadRoots`, `fullPaths`. This is
the old `full` mode with every `ask` turned into a `deny`.

While in effect:

- Dropped: the non-ASCII `commit -m` deny, the secret-file deny/ask inside the roots, `mcpAllow`.
- Kept: the agent's `writeScope`, `mcpDeny`, the Stop gate, session-start loading.
- Root confinement (a heuristic, not a sandbox): the roots are the project root (plus the main repo root in a worktree),
  the session `scratchpad_dir`, `<tmpdir>/claude` and `fullRoots`. The `<tmpdir>/claude` directory itself is always
  blocked.
- Denied, each with a reason that ends in `Mở:` and says how to open it:
  - a push to a protected branch, a force push, or a push to an unknown branch while `fullKeep` has `"push"` (remove it
    from `fullKeep`, push yourself, or use `open`);
  - writes outside the roots; reads outside the read grants (`fullReadRoots`, `fullPaths`); paths that cannot be resolved
    (`$VAR`, `~`, odd globs); a command that mentions a secret file outside the roots; a command with more than 1000
    segments; a hook internal error;
  - writes to `.claude/aip-gate.json` or `.claude/settings*.json`, and `aip mode <name>` run by an agent (change the file
    yourself or run `aip mode` yourself).
- Not changed: an MCP call when `aip-gate.json` is broken still asks (the hook does not know the mode), and
  `start_session` without `model` is still denied.

Turn it on with `aip mode confined`. It writes `"mode": "confined"` (keeping other keys) and replaces
`.claude/settings.json` with `{"permissions":{"deny":[],"ask":[]}}` only when that file is byte-identical to the
aip-generated one; otherwise it leaves the file alone and lists the aip rules you have to remove. Check with
`aip mode status`.

### Minimal `confined` template

Pushes to protected branches and force pushes are denied; work stays inside the project:

```json
{
  "mode": "confined"
}
```

### Unattended `confined` template

Opens pushes, allows writes to one extra output directory, reads a data directory and `.env`, and raises
`plan-execution` autonomy (approving G3 means a local merge, merged branches are cleaned up):

```json
{
  "mode": "confined",
  "fullKeep": [],
  "fullRoots": ["E:/work/shared-out"],
  "fullReadRoots": ["E:/datasets"],
  "fullPaths": [
    { "path": "E:/cache", "allow": ["read", "write"] },
    { "path": "E:/scratch", "allow": ["read", "write", "delete"] }
  ],
  "allowEnvFiles": true,
  "autonomy": {
    "mergeLocal": true,
    "cleanup": true,
    "partRunner": "subagent",
    "planRunner": "subagent"
  }
}
```

Notes on `fullPaths`:

- `path` must be absolute; invalid entries (relative `path`, non-array `allow`) are silently dropped.
- The three permissions are independent: `write` does not imply `read`, `delete` does not imply `write`. Entries with the
  same `path` only add permissions.
- `Read`/`Grep` need `read` (missing: deny); `Write`/`Edit` need `write` (missing: deny); `rm` and the source of `mv`
  need `delete`.
- Secret-looking files are exempt only in a directory that has all three permissions.

You can set `autonomy` with a command instead of editing: `aip autonomy high` writes `mergeLocal`, `cleanup` and
`partRunner`; `aip autonomy safe` removes them. It is independent of `aip mode` and needs no bypass.

## `open` mode

Never asks, no fence: only writes to permission config files, `writeScope` and `mcpDeny` still block.

It needs the same three conditions as `confined`. Use it only where you accept that a bypass session can read and write
anywhere, read secret files and push protected branches without a prompt; a VM, a container or WSL2 is the sane place.

While in effect:

- Dropped: everything `confined` drops, plus the push gate, root confinement, the `<tmpdir>/claude` block, the secret-file
  deny for key files and `credentials*`, the `start_session` without `model` deny, and `mcpAllow`. `fullKeep`, `fullRoots`,
  `fullReadRoots` and `fullPaths` have no effect (`aip mode status` says so when they are present).
- Kept: `mcpDeny`; the agent's `writeScope` (it only blocks the file tools Edit/Write/MultiEdit/NotebookEdit, not Bash);
  the Stop gate; session-start loading.
- Denied (never asked): writes to `.claude/aip-gate.json`, `.claude/settings*.json` and a plugin's
  `hooks/scope-lock.json`, and `aip mode <name>` run by an agent, because `mcpDeny` and `writeScope` are read from those
  files. `aip mode status` and reading those files pass.
- Not changed: an MCP call when `aip-gate.json` is broken still asks.

Turn it on with `aip mode open`; it prints the warning, handles `settings.json` like `confined` does, and you go back with
`aip mode guarded`.

### Minimal `open` template

```json
{
  "mode": "open"
}
```

## Limits

The hooks are regex gates, not a sandbox: symlinks, `sed -i`, `find -delete` and programs that write files themselves are
not classified by permission. Native Windows has no sandbox, so "inside the project" is only hook configuration. For real
isolation use WSL2, a VM or a container. The full list is under **Limits / residual risk** in
[README.md](../README.md#hooks).

Limits specific to `confined` and `open`:

- Spotting `aip mode` and writes to the config files in `guard-bash` is heuristic. A script an agent writes
  (`node x.mjs`), or a trick with shell escapes, still gets through, so an agent in a bypass session can still change the
  mode. The hooks are not a boundary against a hijacked agent.
- `writeScope` blocks only the file tools, not Bash in a subagent. A junction or symlink to the `.claude` directory gets
  through because paths are not resolved with realpath.
- In `open`, an internal error lets the call through, `mcpDeny` of `guard-mcp` included when the error comes after the mode
  check.
- Two findings of the independent security review were left unfixed on purpose: an agent that sets
  `bypassPermissions` for itself or a child session through the app's MCP tool [Unverified: not checked whether the app
  forces approval], and an untracked `aip-gate.json` the user did not write (tarball without git, a stranger's
  `.gitignore`, an install script), which still meets the third condition.
- Claude Code may still ask for some delete commands on important paths even when a hook returns nothing [Unverified: per
  Claude Code docs, not measured]; "never asks" is true of the aip hooks only.
