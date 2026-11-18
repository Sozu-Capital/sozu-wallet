# Mainnet smoke test checklist (Nov 11)

Run on a phone against the mainnet build (`PILOT_MAINNET=1`) with a pilot smart account holding a small USDC balance. Record each tx hash.

## Withdraw-all (szc #40)

Prerequisite: `supabase/migrations/20261106120000_payment_idempotency_keys.sql` applied to the mainnet Supabase project (the withdraw submit refuses to run without it).

- [ ] "Retirar todo" is visible on the home screen and opens the withdraw sheet.
- [ ] "¿Cómo retirar? Guía paso a paso" opens `/ayuda/retirar` (works signed out too).
- [ ] Pasting a G address **without** a Circle USDC trustline shows "Esa cuenta todavía no acepta USDC" before any passkey prompt.
- [ ] Pasting a text memo (e.g. `abc123`) shows the numeric-memo error.
- [ ] Withdraw-all to a G address with a USDC trustline: confirm screen shows the full address (4-char groups) and the exact balance with all decimals.
- [ ] Passkey prompt appears once; receipt shows the tx hash; Stellar Expert shows `transfer` of the exact amount to the G; Sozu balance is 0.
- [ ] Withdraw-all to an exchange with a numeric memo: Stellar Expert shows the transfer event with `to_muxed_id` = memo; exchange credits the deposit (record which exchange and how long it took, or that it did not credit).
- [ ] Double tap "Confirmar con passkey": only one transfer on-chain.

## Regular send

- [ ] Confirm step shows the full recipient address, not truncated.
- [ ] Send succeeds and the submit carries an `idempotencyKey` (browser devtools, request body).
