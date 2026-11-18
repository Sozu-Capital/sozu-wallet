-- Idempotency keys for payment submits (withdraw-all and regular sends).
-- Apply in Supabase SQL editor or `supabase db push` BEFORE deploying the withdraw-all routes:
-- /api/wallet/withdraw/submit refuses to submit without this table.
-- One row per (user, client-generated key). The first submit inserts `in_progress`; a repeat
-- with the same key returns the stored response instead of submitting again.

CREATE TABLE IF NOT EXISTS public.payment_idempotency_keys (
  -- Session user id (TEXT, same as deposit_intents / faucet_claims).
  user_id text NOT NULL,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),

  -- 'withdraw_all' | 'payment'
  scope text NOT NULL,
  -- Payment intent (asset|from|to|amount), not the signed bytes.
  fingerprint text NOT NULL,

  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  response_status integer,
  response_body jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,

  PRIMARY KEY (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS payment_idempotency_keys_created_at_idx
  ON public.payment_idempotency_keys (created_at);

-- Service role only (API routes). No anon/authenticated policies.
ALTER TABLE public.payment_idempotency_keys ENABLE ROW LEVEL SECURITY;
