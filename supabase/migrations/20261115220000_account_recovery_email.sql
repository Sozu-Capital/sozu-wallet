-- Email used only to send a one-time link when a device is lost.
-- The auth login email stays the internal passkey address.

alter table public.profiles
  add column if not exists recovery_email text;

create unique index if not exists profiles_recovery_email_unique
  on public.profiles (lower(recovery_email))
  where recovery_email is not null;

create table if not exists public.account_recovery_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists account_recovery_links_user_idx
  on public.account_recovery_links (user_id);

alter table public.account_recovery_links enable row level security;
