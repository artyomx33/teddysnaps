export const siteConfig = {
  name: "TeddySnaps",
  description: "Premium Daycare Photo Experience",
  tagline: "Precious Moments, Perfectly Preserved",
  url: process.env.NEXT_PUBLIC_URL || "http://localhost:3000",

  company: {
    name: "TeddyKids",
    email: "photos@teddykids.nl",
    phone: "+31 (0) 71 123 4567",
  },

  social: {
    instagram: "https://instagram.com/teddykids",
    facebook: "https://facebook.com/teddykids",
  },

  theme: {
    colors: {
      primary: "#C9A962", // Gold
      secondary: "#4ECDC4", // Teal
      background: "#0D0D0F", // Charcoal
    },
  },
};
