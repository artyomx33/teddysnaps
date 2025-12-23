// Product IDs match the UUIDs in the database (supabase/schema.sql)
export const PRODUCTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Digital Edit (HD)",
    type: "digital" as const,
    size: null,
    price: 2.5,
    description:
      "High‑resolution digital download. Includes retouching on this photo.",
  },
  {
    id: "77777777-7777-7777-7777-777777777777",
    name: "All digital photos (retouched)",
    type: "digital" as const,
    size: null,
    price: 50.0,
    description:
      "All photos as digital downloads. All photos are retouched and beautified.",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "10×15 Print",
    type: "print" as const,
    size: "10x15",
    price: 4.5,
    description: "Glossy or matte finish",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "13×18 Print",
    type: "print" as const,
    size: "13x18",
    price: 6.0,
    description: "Glossy or matte finish",
  },
  {
    id: "44444444-4444-4444-4444-444444444444",
    name: "20×30 Print",
    type: "print" as const,
    size: "20x30",
    price: 8.5,
    description: "Large format print",
  },
  {
    id: "55555555-5555-5555-5555-555555555555",
    name: "Canvas 30×40",
    type: "canvas" as const,
    size: "30x40",
    price: 29.0,
    description: "Premium stretched canvas",
  },
  {
    id: "66666666-6666-6666-6666-666666666666",
    name: "Photo Book 20 pages",
    type: "book" as const,
    size: "20pages",
    price: 35.0,
    description: "Curated selection hardcover book",
  },
] as const;

export const DISCOUNTS = {
  bundleThreshold: 5,
  bundlePercent: 15,
};

export const DELIVERY_OPTIONS = [
  {
    id: "email",
    name: "Email",
    icon: "📧",
    description: "Instant digital delivery",
    price: 0,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "💬",
    description: "Receive via WhatsApp",
    price: 0,
  },
  {
    id: "pickup",
    name: "Pickup at TeddyKids",
    icon: "🏫",
    description: "Collect at daycare",
    price: 0,
  },
  {
    id: "delivery",
    name: "Home Delivery",
    icon: "🏠",
    description: "Delivered to your door",
    price: 2.95,
  },
] as const;

export type ProductId = (typeof PRODUCTS)[number]["id"];
export type DeliveryMethod = (typeof DELIVERY_OPTIONS)[number]["id"];
