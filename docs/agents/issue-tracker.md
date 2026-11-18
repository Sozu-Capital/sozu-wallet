# Issue tracker: Exponential

Issues and PRDs for this repo live in [Exponential](https://www.exponential.im). Use the `exponential` CLI for all operations. Add `--json` to any command (or pipe it) to get machine-readable output.

## This repo's coordinates

- **Workspace**: `sozu-capital` (`cmro6wg0c003die04hf611ee0`)
- **Product (Hack Meridian)**: `hack-meridian` (`cmvnw2vxh005wkw07dnbxe4qy`)
- **Default feature**: `cmvnw3wsl005ykw078w6baia9` — Sozu Offline demo
- **Wallet product**: `sozucredit` (`cmro6xhjb0005lh04duwgve3c`) — use only when the ticket is not Hack Meridian

`exponential workspaces set-default sozu-capital` is set on the local CLI, so `--workspace` can be omitted in most commands. `--product` is always required.

Hack Meridian tickets are the current board. Joaquín's lane is wallet + slides + ADR/PRD. Do not pick up Danilo (APK), Marcos (Contract / testnet vault), or Vini (ESP32) tickets unless a human reassigns them.

## Hierarchy

`workspace → product → feature → ticket`. Epics are workspace-scoped and can group tickets across products.

A **feature** is the PRD-shaped unit (an outcome with a vision). A **ticket** is a unit of work (bug, feature slice, chore, etc.).

## Conventions

- **Create a ticket**: `exponential tickets create --product <product> --type <TYPE> --status <STATUS> -t "<title>" -b "<body>" [--feature <feature-cuid>] [--epic <epic-cuid>] --json`. Use a heredoc for multi-line bodies.
- **Read a ticket**: `exponential tickets get <ticket-cuid> --json` (returns dependencies, actions, and comments).
- **List tickets**: `exponential tickets list --product <product> [--status <STATUS>] [--type <TYPE>] [--feature <cuid>] [--assignee <user-id>] --json`. Status filtering is server-side — prefer that to client-side filtering.
- **Comment on a ticket**: `exponential tickets comment add --id <ticket-cuid> -m "<body>"`.
- **Change a ticket's status**: `exponential tickets update --id <ticket-cuid> --status <STATUS>`.
- **Archive (close)**: `exponential tickets update --id <ticket-cuid> --status ARCHIVED`.
- **Create a feature (for PRDs)**: `exponential features create --product <product> -n "<name>" -d "<description>" --vision "<target outcome>" --status DEFINED --json`.

### Ticket types

`BUG`, `FEATURE`, `CHORE`, `IMPROVEMENT`, `SPIKE`, `RESEARCH`.

### Ticket statuses

`BACKLOG`, `NEEDS_REFINEMENT`, `READY_TO_PLAN`, `COMMITTED`, `IN_PROGRESS`, `BLOCKED`, `QA`, `DONE`, `DEPLOYED`, `ARCHIVED`.

### Feature statuses

`IDEA`, `DEFINED`, `IN_PROGRESS`, `SHIPPED`, `ARCHIVED`.

## People

| Lane | Name | User id |
|---|---|---|
| Wallet, slides, ADR/PRD | Joaquín Farfan | `cmgwt550p0000l50411tumku4` |
| APK / bitchat | Danilo Contreras | `cmr5td32w0000jr04h42g7u8q` |
| Testnet vault / Contract | Marcos Vinicio Reyes | `cmud7boaj005ql704b83y2odt` |

## Skill order (do not skip backwards)

1. Do **not** re-grill. ADR / Ready-to-code PRD already exist.
2. `to-prd` / `to-expo` only when a human asks for new tickets.
3. `/start-ticket` on a `READY_TO_PLAN` ticket **you own**.
4. Implement (TDD when the slice is code).
5. `/ship-ticket` — PR base is `dev` (`docs/agents/git-flow.md`).
6. One scope at a time. Screens wait for Marcos's explorer links.

## Triage role → ticket status mapping

The `/triage` skill routes by `ticket.status` alone — no body markers or sentinel comments needed.

| Triage role | `ticket.status` | Notes |
|---|---|---|
| `needs-triage` | `BACKLOG` | Default landing state for new tickets |
| `needs-info` | `NEEDS_REFINEMENT` | + a comment carrying the actual clarifying question |
| `ready-for-agent` | `READY_TO_PLAN` | Agent picks these up |
| `ready-for-human` | `BLOCKED` | Semantic: blocked on human availability or judgement |
| `wontfix` | `ARCHIVED` | Terminal |

## When a skill says "publish to the issue tracker"

- If the source is a **plan, spec, or PRD that needs to be broken into multiple tickets**: invoke `/to-expo`. It handles vertical slicing, dependency wiring, and decision comments.
- If the source is a **single ticket** (e.g. a PRD as a feature, or a one-off bug): run `exponential tickets create ...` directly, or `exponential features create ...` for PRD-shaped work.

## When a skill says "fetch the relevant ticket"

Run `exponential tickets get <ticket-cuid> --json`. The output includes the ticket body, status, dependencies, linked actions, and the full comment thread.
