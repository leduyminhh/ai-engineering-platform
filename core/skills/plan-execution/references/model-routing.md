# Model and session routing

Moved verbatim from the `### Model and session routing` section of the AI Engineering baseline (`AGENTS.md`), which keeps a pointer to this file.

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
