-- Souvenirs are merchant launches from Sozu Pay. Drop the hardcoded event badge.
DELETE FROM public.souvenirs
WHERE slug = 'liquid-society-souvenir';
