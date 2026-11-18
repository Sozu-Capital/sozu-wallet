# ADR 0002 — One canonical smart account per Sozu account

## Rule

A Sozu account has one smart-account address. That address is the first `C…` stored in `stellar_wallets.public_key`. Pay, `$tag` resolution, and the wallet home screen all use it.

A later passkey, browser, or request cannot deploy a replacement or save a different `C…` over it. USDC sent to the canonical address stays there. Opening the app cannot move it.

Tags are case-insensitive. `$FrankOcean` and `frankocean` are one tag. Registration rejects a case variant of a tag that already exists. If two profiles already differ only by case, payments and login use the account whose wallet was created first.

## Why

On 2026-11-15 a payout of 10 testnet USDC to `$FrankOcean` succeeded on chain at `CDJVGT46…AZ3F`, the wallet created on Nov 8 for profile `FrankOcean`. Forty seconds later a second profile, `frankocean`, registered because the uniqueness check compared tags with exact case. That login deployed `CCJY33SG…2KGZ`. The wallet home showed the new empty contract. Pay's tag normalizer lowercases, so the next lookup would have preferred the newer profile.

## What is canonical

1. If `stellar_wallets.public_key` is a `C…`, that is the receive address.
2. If it is empty or still a classic `G…`, and the account is an org tag with a treasury `C…`, that treasury is adopted once. Login does not deploy beside it.
3. Otherwise the first successful deploy is written once.

An org disbursement contract and a personal smart account are the same receive address for that tag. They are not two payable addresses for one Sozu account.

## Abuse and tamper prevention

The client chooses a passkey. It does not choose the receive address after the first one exists.

| Request | Server behavior |
|---------|-----------------|
| `POST /api/smart-accounts/submit-deploy` | Sponsors a create only when the account has no canonical `C…`. The inner envelope must be one `CreateContract` from the OpenZeppelin deployer, the pinned WASM, and a salt derived from a passkey already stored for this user. A second contract is not sponsored. The deployed id is written immediately, so a following request sees it. |
| `POST /api/smart-accounts/register` | Saves the client `contractId` only when the account has no `C…` yet. If one exists, the response returns that address and `unchanged: true`. The row is not updated. |
| `POST /api/wallet/stellar/create`, `update-address`, `sozu-tag` | A different `C…` or a `G…` is rejected with `CANONICAL_SMART_ACCOUNT_IMMUTABLE`. The same `C…` is a no-op. |
| Factory provision and G→C migration | Return the canonical `C…` instead of deploying when one already exists or an org treasury can be adopted. |
| Send alignment | If the session already has a `C…`, a passkey that derives a different contract does not get registered over it. |
| Sozu Pay `$tag` payout | The tag is resolved again at send time. A saved recipient `C…` that no longer matches the account is replaced with the canonical address. |
| Sozu Pay `stellar_wallets` and `smart_accounts` writes | An existing `C…` is not replaced. Org `treasury_contract_id` is not replaced once set. |

The funder key pays fees. It cannot spend a user's USDC. Sponsorship does not authorize a second account.

## What still requires the original passkey

The contract's signer is fixed on chain at deploy. The server cannot add a passkey or sweep USDC from the canonical account. A new device that cannot sign the existing contract gets a setup error naming that address. It does not get a new one.

Repairing an account that already diverged is a deliberate directory edit back to the funded `C…`. The app will not do that from a login.
