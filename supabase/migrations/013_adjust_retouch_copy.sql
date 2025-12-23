-- Adjust product copy: €50 bundle includes all digitals, all retouched/beautified.
-- Safe to run multiple times.

alter table products
  add column if not exists description text;

update products
set description = 'High‑resolution digital download. Includes retouching on this photo.'
where id = '11111111-1111-1111-1111-111111111111';

update products
set description = 'All photos as digital downloads. All photos are retouched and beautified.'
where id = '77777777-7777-7777-7777-777777777777';

update products
set name = 'All digital photos (retouched)'
where id = '77777777-7777-7777-7777-777777777777';


