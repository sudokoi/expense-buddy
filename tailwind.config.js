const density = require("./constants/display-density.json").standard
const densityVar = (group, name) => `var(--${group}-${name})`
const fontRole = (name) => [
  densityVar("font", name),
  ...(density.line[name] ? [{ lineHeight: densityVar("line", name) }] : []),
]
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./providers/**/*.{js,jsx,ts,tsx}",
    "./hooks/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "System", "sans-serif"],
        bold: ["InterBold", "System", "sans-serif"],
      },
      fontSize: {
        default: [densityVar("font", "label")],
        micro: fontRole("micro"),
        body: fontRole("body"),
        label: fontRole("label"),
        xs: fontRole("caption"),
        sm: fontRole("label"),
        base: fontRole("title"),
        lg: fontRole("section"),
        xl: fontRole("screen"),
        "2xl": fontRole("amount"),
        "3xl": fontRole("total"),
      },
      spacing: {
        ...Object.fromEntries(
          Object.keys(density.space).map((key) => [`ui-${key}`, densityVar("space", key)])
        ),
        ...Object.fromEntries(
          Object.keys(density.control).map((key) => [
            `control-${key}`,
            densityVar("control", key),
          ])
        ),
        ...Object.fromEntries(
          Object.keys(density.layout).map((key) => [
            `layout-${key}`,
            densityVar("layout", key),
          ])
        ),
      },
      maxWidth: { content: "600px" },
      minWidth: {
        legend: densityVar("layout", "legend"),
        metric: densityVar("layout", "metric"),
        action: densityVar("layout", "action"),
      },
      height: { "chart-empty": densityVar("layout", "chartEmpty") },
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
        destructive: "var(--destructive)",
        "kawaii-pink": "var(--kawaii-pink)",
        "kawaii-pink-light": "var(--kawaii-pink-light)",
        "kawaii-pink-dark": "var(--kawaii-pink-dark)",
        "kawaii-lavender": "var(--kawaii-lavender)",
        "kawaii-mint": "var(--kawaii-mint)",
      },
      borderRadius: {
        control: "12px",
        chip: "14px",
        card: "20px",
        round: "999px",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("tailwindcss/plugin")(({ addBase }) => {
      addBase({
        ":root": Object.fromEntries(
          Object.entries(density).flatMap(([group, values]) =>
            Object.entries(values).map(([key, value]) => [
              `--${group}-${key}`,
              `${value}px`,
            ])
          )
        ),
      })
    }),
  ],
}
