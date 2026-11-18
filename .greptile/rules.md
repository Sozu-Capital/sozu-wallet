# Review context: Sozu Wallet

Sozu Wallet (`app.sozu.capital`) is the beneficiary wallet for the Mujeres 2000 mainnet pilot: passkey (WebAuthn P-256) smart accounts on Stellar, holding real USDC on mainnet. Prioritize correctness and security findings over style.

## What matters most

- Identity: one HMAC-signed session cookie is the only source of the caller's identity.
- Passkeys: a user's funds move only with that user's passkey authorization.
- Lockdown: the mainnet build (`PILOT_MAINNET=1`) exposes only the pilot flow; everything else must 404.
- Network: code must behave correctly on testnet (staging) and mainnet (production); flag testnet-only shortcuts that could run on mainnet.

## Conventions

- Next.js App Router; tests use vitest (`lib/**/*.test.ts`, `test/**/*.test.ts`); build with `bun run build`.
- PRs target `dev`.
