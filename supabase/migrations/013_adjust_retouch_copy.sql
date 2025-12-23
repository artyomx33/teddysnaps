-- Adjust product copy: €50 bundle includes only 3 retouched photos (chosen from favourites).
-- Safe to run multiple times.

alter table products
  add column if not exists description text;

update products
set description = 'High‑resolution digital download. Includes retouching on this photo.'
where id = '11111111-1111-1111-1111-111111111111';

update products
set description = 'All photos as digital downloads. Includes 3 premium retouch edits (choose your top 3 favourites; if none, we select).'
where id = '77777777-7777-7777-7777-777777777777';


