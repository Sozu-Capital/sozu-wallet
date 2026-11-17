-- Event souvenirs a wallet can claim once. A claimed badge stays on that account forever.
-- Merchants launch extra rows (image, title, claim window) from Sozu Pay.

CREATE TABLE IF NOT EXISTS public.souvenirs (
  slug text PRIMARY KEY CHECK (char_length(slug) BETWEEN 3 AND 80),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 80),
  drop_name text NOT NULL CHECK (char_length(drop_name) BETWEEN 1 AND 120),
  image_url text NOT NULL CHECK (char_length(image_url) BETWEEN 8 AND 200000),
  merchant_org_id text,
  claim_starts_at timestamptz NOT NULL,
  claim_ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT souvenirs_claim_window CHECK (claim_ends_at > claim_starts_at)
);

CREATE TABLE IF NOT EXISTS public.souvenir_claims (
  souvenir_slug text NOT NULL REFERENCES public.souvenirs (slug) ON DELETE CASCADE,
  user_id text NOT NULL,
  wallet_address text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  title text NOT NULL,
  drop_name text NOT NULL,
  image_url text NOT NULL,
  PRIMARY KEY (user_id, souvenir_slug)
);

CREATE INDEX IF NOT EXISTS souvenir_claims_slug_idx
  ON public.souvenir_claims (souvenir_slug);

ALTER TABLE public.souvenirs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.souvenir_claims ENABLE ROW LEVEL SECURITY;

INSERT INTO public.souvenirs (
  slug,
  title,
  drop_name,
  image_url,
  merchant_org_id,
  claim_starts_at,
  claim_ends_at
)
VALUES (
  'liquid-society-souvenir',
  'Collectible Souvenir',
  'Liquid Society · 18 Nov 2026',
  '/merch/liquid-society-souvenir.svg',
  NULL,
  '2026-11-17T00:00:00-03:00',
  '2026-11-19T00:00:00-03:00'
)
ON CONFLICT (slug) DO NOTHING;
