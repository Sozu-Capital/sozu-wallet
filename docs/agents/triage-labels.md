# Triage labels

Hack Meridian / Sozu Wallet track work in Exponential. Triage roles map to **ticket status**, not GitHub labels.

| Skill role | Exponential `ticket.status` | Meaning |
|---|---|---|
| `needs-triage` | `BACKLOG` | Maintainer needs to evaluate |
| `needs-info` | `NEEDS_REFINEMENT` | Waiting on reporter |
| `ready-for-agent` | `READY_TO_PLAN` | AFK-ready; an agent may `/start-ticket` |
| `ready-for-human` | `BLOCKED` | Needs a human (login, phones, explorer links) |
| `wontfix` | `ARCHIVED` | Will not be actioned |

When a skill says “apply the AFK-ready triage label”, set `--status READY_TO_PLAN`.
