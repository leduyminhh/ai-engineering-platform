# Docs

`docs/` contains stable repository documentation that should outlive a single task
or PR. Do not use it as a dumping ground for generated reports.

> Vietnamese: see [README_VI.md](README_VI.md).

## Structure

| Folder | What it owns | Lifetime |
| --- | --- | --- |
| `specs/<capability>/spec.md` | Living spec: current behavior of one capability, with `R<n>` IDs. | Long-term |
| `decisions/` | ADRs: why a design was chosen. | Long-term |
| `requests/<yyyy-mm-dd>-<slug>/` | `design.md` (+ `plan.md` while the work is in progress) of one change. The `Trạng thái` line in `design.md` records its state. | Short-term |

## Request lifecycle

- `plan.md` is an execution checklist: delete it once the change is merged.
- `design.md` stays while a spec or ADR still links to it as a source; move durable content into `specs/` or `decisions/`.

## What belongs here

- Architecture / design records that explain why the repository is shaped the way it is.
- Durable handoff notes for future maintainers.

## What does not belong here

- Temporary command output, scan reports, or local debugging notes.
- Plugin-owned usage docs — keep those in the owning plugin directory.

## Change checklist

- Keep claims traceable to code, configs, tests, or explicit decisions.
- Update English `README.md` first, then synchronize `README_VI.md`.
