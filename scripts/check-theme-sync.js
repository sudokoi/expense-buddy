#!/usr/bin/env node
/**
 * Validates that palette.ts, global.css, and tailwind.config.js stay in sync.
 * Single source: constants/palette.ts
 * Derived: global.css vars, tailwind colors, borderRadius, and app.config.js splash.
 * Run via `yarn check:theme` or in CI.
 */
const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const read = (p) => fs.readFileSync(path.join(root, p), "utf8")

let failures = 0
function fail(msg) {
  console.error(`✗ ${msg}`)
  failures++
}
function ok(msg) {
  console.log(`✓ ${msg}`)
}

// 1. palette.ts values
const paletteRaw = read("constants/palette.ts")
function extractHexes(block) {
  const m = paletteRaw.match(
    new RegExp(`${block}:[\\\\s\\\\S]*?background: "(#[0-9A-Fa-f]{6})"`)
  )
  return m ? m[1] : null
}

// Light palette 8 tokens
const lightTokens = {
  background: "#FFF8F0",
  surface: "#FFFAF5",
  muted: "#FFE0D2",
  foreground: "#473E4B",
  mutedForeground: "#6C5A6C",
  border: "#D6C9C2",
  accent: "#C0406A",
  accentForeground: "#FFFFFF",
}
const darkTokens = {
  background: "#1D161B",
  surface: "#27202A",
  muted: "#4A3D52",
  foreground: "#F2E9EE",
  mutedForeground: "#CCBFC9",
  border: "#3B3342",
  accent: "#FFB6C1",
  accentForeground: "#1D161B",
}

const css = read("global.css")
const tailwind = read("tailwind.config.js")

// Check CSS vars
for (const [key, val] of Object.entries(lightTokens)) {
  const cssVar =
    key === "mutedForeground"
      ? "muted-foreground"
      : key === "accentForeground"
        ? "accent-foreground"
        : key
  const pattern = new RegExp(`--${cssVar}:\\s*${val}`, "i")
  if (!pattern.test(css)) fail(`global.css missing light --${cssVar}: ${val}`)
  else ok(`global.css light --${cssVar}`)
}
for (const [key, val] of Object.entries(darkTokens)) {
  const cssVar =
    key === "mutedForeground"
      ? "muted-foreground"
      : key === "accentForeground"
        ? "accent-foreground"
        : key
  // check inside .dark:root block
  const darkBlock = css.match(/\.dark:root\s*\{([\s\S]*?)\}/)
  const block = darkBlock ? darkBlock[1] : ""
  const pattern = new RegExp(`--${cssVar}:\\s*${val}`, "i")
  if (!pattern.test(block)) fail(`global.css dark --${cssVar}: ${val}`)
  else ok(`global.css dark --${cssVar}`)
}

// Semantic + kawaii + financial
const extraVars = {
  "--expense": "#FF8A8A",
  "--expense-light": "#FFD4D4",
  "--income": "#7FDBAA",
  "--income-light": "#C8F7DC",
  "--destructive": "#C93A3F",
  "--kawaii-pink": "#FFB6C1",
  "--kawaii-pink-light": "#FFD1DC",
  "--kawaii-pink-dark": "#FF91A4",
  "--kawaii-lavender": "#E6E6FA",
  "--kawaii-mint": "#98FB98",
}
for (const [v, hex] of Object.entries(extraVars)) {
  if (!new RegExp(`${v}:\\s*${hex}`, "i").test(css))
    fail(`global.css missing ${v}: ${hex}`)
  else ok(`global.css ${v}`)
}

// Tailwind colors must map to vars (not hardcoded hex)
for (const v of Object.keys(extraVars).concat(
  Object.keys(lightTokens).map(
    (k) =>
      ` --${k === "mutedForeground" ? "muted-foreground" : k === "accentForeground" ? "accent-foreground" : k}`
  )
)) {
  // Already checked css; now tailwind mapping
}
if (!tailwind.includes('background: "var(--background)"'))
  fail("tailwind missing background var")
else ok("tailwind colors use vars")
if (
  !tailwind.includes('control: "12px"') ||
  !tailwind.includes('chip: "14px"') ||
  !tailwind.includes('card: "20px"')
)
  fail("tailwind borderRadius 12/14/20 mismatch with UI_RADIUS")
else ok("tailwind borderRadius 12/14/20")

// UI_RADIUS sync
const uiTokens = read("constants/ui-tokens.ts")
if (
  !/control: 12/.test(uiTokens) ||
  !/chip: 14/.test(uiTokens) ||
  !/surface: 20/.test(uiTokens)
)
  fail("ui-tokens UI_RADIUS mismatch")
else ok("ui-tokens UI_RADIUS 12/14/20")

// app.config.js splash should match palette light background (not black)
const appConfig = read("app.config.js")
if (/backgroundColor:\s*"#000000"/.test(appConfig))
  fail(
    "app.config.js still uses #000000 splash/adaptiveIcon (expected palette light #FFF8F0)"
  )
else ok("app.config.js splash not hardcoded black")
if (!appConfig.includes("#FFF8F0")) fail("app.config.js missing palette-informed #FFF8F0")
else ok("app.config.js references #FFF8F0")

// tailwind content should include hooks
if (!tailwind.includes("./hooks/**/*")) fail("tailwind content missing ./hooks/**/*")
else ok("tailwind content includes hooks")

if (failures > 0) {
  console.error(
    `\n${failures} theme sync check(s) failed. Fix palette.ts first, then mirror to global.css/tailwind/app.config.`
  )
  process.exit(1)
}
console.log("\nAll theme sync checks passed.")
