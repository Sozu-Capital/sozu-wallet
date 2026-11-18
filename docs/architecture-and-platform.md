# Architecture and platform

Current platform shape. Product surface and integration status: root [README](../README.md). Privacy/compliance phasing (not shipped): [privacy-wallet-roadmap.md](./privacy-wallet-roadmap.md).

## Frontend and API

- **Next.js 16 App Router** — PWA at `/home` (Settings · Pay/Deposit · History) plus `/auth` and env-flagged rails (deposits, SDP, ledger).
- **Route handlers** under `app/api/` — Node, not a separate Edge service.
- **Supabase (PostgreSQL + RLS)** — profiles, passkeys, `stellar_wallets`, ledger, deposit intents. Incremental DDL in `supabase/migrations/` does not recreate a full database from scratch.

## Custody and wallets

- **WebAuthn passkey** stored in `passkeys`. That credential is the spend authority.
- **OpenZeppelin smart account (`C…`)** via `smart-account-kit`. Provisioned at auth ([ADR 0001](./adr/0001-auth-owned-oz-wallet-provisioning.md)). `stellar_wallets.public_key` is the `C…` address; `wallet_type` is `oz`.
- **Fee-payer `G…`** (`STELLAR_FUNDER_SECRET`) is the Soroban transaction source. It sponsors gas; it cannot spend user USDC without the passkey `__check_auth`.
- **Turnkey** is leftover (`lib/turnkey/`, `createStellarWallet`). New users do not get a Turnkey HD wallet.
- Balances and sends are **Soroban token contracts** (Circle USDC SAC by default). Earn is an optional DeFindex vault → Blend USDC reserve. See [wallet-stellar-defindex.md](./wallet-stellar-defindex.md).

## Schema source of truth

Shipped incremental DDL lives under **`supabase/migrations/`** (today focused on email ledger + related tables). Older environments may already contain the core wallet/trust schema from historical operational SQL.

**Net-new databases** should import a schema dump from an existing Supabase project (recommended) or recover the deleted numbered `scripts/*.sql` pack from git history before the cleanup commit — do not assume `supabase/migrations/` alone recreates every legacy table.

## Security posture (summary)

- Passkeys/WebAuthn for authentication; no legacy passwords in the happy path.
- Service-role usage limited to trusted server routes and automation; user-facing routes should respect RLS where applicable.
- Payment webhooks must verify partner signatures and enforce idempotency before moving funds.
