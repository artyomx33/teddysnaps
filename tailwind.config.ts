import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // TeddySnaps brand colors
        background: "#0D0D0F",
        foreground: "#FFFFFF",
        gold: {
          50: "#FDF8E7",
          100: "#F9ECC4",
          200: "#F0D88A",
          300: "#E5C14F",
          400: "#D4A82E",
          500: "#C9A962",
          600: "#A88B3D",
          700: "#86702F",
          800: "#6B5A27",
          900: "#584A21",
        },
        teal: {
          50: "#EFFCFC",
          100: "#D6F6F6",
          200: "#B2EDED",
          300: "#7CDEDE",
          400: "#4ECDC4",
          500: "#2FB3AA",
          600: "#24908A",
          700: "#227470",
          800: "#215D5B",
          900: "#204D4C",
        },
        charcoal: {
          50: "#F5F5F6",
          100: "#E5E5E7",
          200: "#CDCDD0",
          300: "#AAAAB0",
          400: "#7F7F88",
          500: "#64646D",
          600: "#55555C",
          700: "#48484E",
          800: "#3F3F44",
          900: "#27272A",
          950: "#0D0D0F",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "glow-gold": "radial-gradient(ellipse at center, rgba(201, 169, 98, 0.15) 0%, transparent 70%)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "scale-in": "scaleIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
