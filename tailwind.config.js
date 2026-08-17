/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: "var(--surface)",
        muted: "var(--muted)",
        foreground: "var(--foreground)",
        "muted-foreground": "var(--muted-foreground)",
        border: "var(--border)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        expense: "var(--expense)",
        "expense-light": "var(--expense-light)",
        income: "var(--income)",
        "income-light": "var(--income-light)",
        success: "var(--success)",
        error: "var(--error)",
        warning: "var(--warning)",
        info: "var(--info)",
        "kawaii-pink": "var(--kawaii-pink)",
        "kawaii-pink-light": "var(--kawaii-pink-light)",
        "kawaii-pink-dark": "var(--kawaii-pink-dark)",
        "kawaii-lavender": "var(--kawaii-lavender)",
        "kawaii-mint": "var(--kawaii-mint)",
      },
      borderRadius: {
        control: "8px",
        chip: "12px",
        card: "16px",
        round: "999px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
