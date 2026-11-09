-- Internal ledger row for the deposit-screen Sozu Faucet button.
-- Claims are stored in faucet_claims and share the 24h per-wallet / per-user cooldown.
-- Status stays inactive so this row never appears on the public faucet map.
-- The claim API also creates this row if the migration has not been applied yet.

INSERT INTO public.faucets (
  slug,
  name,
  description,
  status,
  location_name,
  lat,
  lng,
  daily_limit,
  claim_amount,
  cooldown_minutes
)
VALUES (
  'wallet-deposit',
  'Wallet deposit claim',
  'Internal ledger for one testnet USDC claim per wallet per day. Not a physical faucet.',
  'inactive',
  'Sozu Wallet',
  0,
  0,
  1000000,
  100,
  0
)
ON CONFLICT (slug) DO NOTHING;
