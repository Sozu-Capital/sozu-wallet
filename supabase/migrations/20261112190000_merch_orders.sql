-- One Liquid Society purchase attempt. A retry of the same attempt reads this row
-- instead of submitting another USDC payment. Service role only.

CREATE TABLE IF NOT EXISTS public.merch_orders (
  id text PRIMARY KEY,
  attempt_id text NOT NULL CHECK (char_length(attempt_id) BETWEEN 16 AND 128),
  user_id text NOT NULL,
  slug text NOT NULL,
  payer text NOT NULL,
  price_usdc text NOT NULL,
  destination text NOT NULL,
  status text NOT NULL CHECK (status IN ('awaiting_payment', 'charging', 'paid', 'failed', 'completed')),
  payment_hash text,
  failure_reason text,
  transfer_attempted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, attempt_id)
);

-- One open purchase per guest per item. Failed and completed rows do not count.
CREATE UNIQUE INDEX IF NOT EXISTS merch_orders_one_open
  ON public.merch_orders (user_id, slug)
  WHERE status IN ('awaiting_payment', 'charging', 'paid');

ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;
