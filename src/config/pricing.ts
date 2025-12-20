export const PRODUCTS = [
  {
    id: "digital-hd",
    name: "Digital HD",
    type: "digital" as const,
    size: null,
    price: 2.5,
    description: "High resolution digital download",
  },
  {
    id: "print-10x15",
    name: "10×15 Print",
    type: "print" as const,
    size: "10x15",
    price: 4.5,
    description: "Glossy or matte finish",
  },
  {
    id: "print-13x18",
    name: "13×18 Print",
    type: "print" as const,
    size: "13x18",
    price: 6.0,
    description: "Glossy or matte finish",
  },
  {
    id: "print-20x30",
    name: "20×30 Print",
    type: "print" as const,
    size: "20x30",
    price: 8.5,
    description: "Large format print",
  },
  {
    id: "canvas-30x40",
    name: "Canvas 30×40",
    type: "canvas" as const,
    size: "30x40",
    price: 29.0,
    description: "Premium stretched canvas",
  },
  {
    id: "photobook-20",
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
