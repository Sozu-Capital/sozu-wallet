-- A paid order may be mid-transfer. The hash is stored only after one unit is sent.

ALTER TABLE public.merch_orders
  ADD COLUMN IF NOT EXISTS transfer_hash text;

ALTER TABLE public.merch_orders DROP CONSTRAINT IF EXISTS merch_orders_status_check;

ALTER TABLE public.merch_orders
  ADD CONSTRAINT merch_orders_status_check
  CHECK (status IN ('awaiting_payment', 'charging', 'paid', 'transferring', 'failed', 'completed'));

DROP INDEX IF EXISTS public.merch_orders_one_open;

CREATE UNIQUE INDEX merch_orders_one_open
  ON public.merch_orders (user_id, slug)
  WHERE status IN ('awaiting_payment', 'charging', 'paid', 'transferring');
