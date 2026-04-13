/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./contexts/**/*.{js,jsx,ts,tsx}",
    "./utils/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // CSS variable references — values defined per theme in global.css
        background: "var(--color-background)",
        surface: "var(--color-surface)",
        primary: "var(--color-primary)",
        text: "var(--color-text)",
        textSecondary: "var(--color-text-secondary)",
        border: "var(--color-border)",
        danger: "var(--color-danger)",
        tint: "var(--color-tint)",
      },
    },
  },
  plugins: [],
};