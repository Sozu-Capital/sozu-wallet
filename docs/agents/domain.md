# Domain docs

Single-context. Spoken line and protocol sizes are locked.

## Before exploring, read these

- Exponential Ready-to-code PRD: page `cmvo585s90009lf08v1wbhzgq`
- Roster: page `cmvo5ecoh0015lf08g4itet4j`
- ADR 0001: page `cmvnwkw1n0001jq08arv0qj65`
- Local ADRs when present: `docs/adr/` (0002 recovery/mesh, 0003 witness/APK)
- `docs/agents/git-flow.md` — feature PRs target `dev`

If a local `CONTEXT.md` is missing, proceed from the Exponential pages. Do not invent glossary synonyms.

## Locked language

- Spoken line: **Offline Stellar payments. A second spend of the same note fails on chain.**
- States: pending, heard, settled. Second spend: `note-used`.
- Fee: 0.01 USDC (`DEMO_FEE` = `100_000`).
- Cheque: body 179, sig 64 low-S, wire 243, prefix `SOZU1:`. Follow the code, not prose 330.
- Checkpoint: wire 131, prefix `SOZU2:`.
- No QR payment path. No second byte layout.

## File structure

```
/
├── docs/adr/                 ← when present on sozu-offline / sozu-wallet
├── docs/agents/              ← issue tracker, git flow, this file
└── lib/offline/              ← wallet deposit / pendingCheque
```

`protocol/` on sozu-offline is the spec. Do not fork a second layout in sozu-wallet.
