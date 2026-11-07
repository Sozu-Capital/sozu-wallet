-- Waitlist emails collected at app.sozu.capital while WAITLIST_MODE is on.
-- Apply in Supabase SQL editor or `supabase db push`.

CREATE TABLE IF NOT EXISTS public.waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored lowercased and trimmed by the API.
  email text NOT NULL UNIQUE CHECK (char_length(email) <= 254),
  locale text CHECK (locale IN ('es', 'en')),
  -- Referrer host, when the browser sends one.
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS waitlist_signups_created_idx
  ON public.waitlist_signups (created_at DESC);

-- Service role only: no public read or write policies.
ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;
