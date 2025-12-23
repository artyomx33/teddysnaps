-- Add/update digital products for retouching copy + €50 full-digital bundle.
-- Safe to run multiple times.

alter table products
  add column if not exists description text;

insert into products (id, name, type, size, price, description, sort_order, is_active)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'Digital Edit (HD)',
    'digital',
    null,
    2.50,
    'High‑resolution digital download. Includes retouching on this photo.',
    1,
    true
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'All digital photos (retouched)',
    'digital',
    null,
    50.00,
    'All photos as digital downloads. All photos are retouched and beautified.',
    2,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  type = excluded.type,
  size = excluded.size,
  price = excluded.price,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;


