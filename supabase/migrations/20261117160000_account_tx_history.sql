-- Payments an account has already seen. Chain event scans only cover a recent
-- ledger window, so without this table a smart account forgets older transfers
-- and faucet claims. Rows are inserted and updated, never deleted, by the
-- wallet history API (service role). One row belongs to one wallet address.

create table if not exists public.account_tx_history (
  wallet_address text not null,
  tx_hash text not null,
  created_at timestamptz not null,
  successful boolean not null default true,
  memo text,
  operations jsonb not null,
  primary key (wallet_address, tx_hash)
);

create index if not exists account_tx_history_wallet_time_idx
  on public.account_tx_history (wallet_address, created_at desc);

alter table public.account_tx_history enable row level security;
