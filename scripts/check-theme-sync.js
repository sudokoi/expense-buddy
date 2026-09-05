#!/usr/bin/env node
/**
 * Validates that palette.ts, global.css, and tailwind.config.js stay in sync.
 * Single source: constants/palette.ts
 * Derived: global.css vars, tailwind colors, borderRadius, and app.config.js splash.
 * Run via `yarn check:theme` or in CI.
 */
const fs = require("fs")
const path = require("path")
const ts = require("typescript")

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

// Read literal token declarations, rather than validating against a second palette.
function readTokens(file) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
  function literal(node) {
    if (ts.isAsExpression(node)) return literal(node.expression)
    if (ts.isStringLiteral(node)) return node.text
    if (ts.isNumericLiteral(node)) return Number(node.text)
    if (ts.isIdentifier(node) && Object.hasOwn(result, node.text))
      return result[node.text]
    if (ts.isPropertyAccessExpression(node))
      return literal(node.expression)[node.name.text]
    if (ts.isObjectLiteralExpression(node)) {
      return Object.fromEntries(
        node.properties.map((property) => [
          property.name.getText(source),
          literal(property.initializer),
        ])
      )
    }
    throw new Error(`Non-literal theme token: ${node.getText(source)}`)
  }
  const result = {}
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      result[declaration.name.getText(source)] = literal(declaration.initializer)
    }
  }
  return result
}
const tokens = readTokens("constants/palette.ts")
const lightTokens = tokens.palette.light
const darkTokens = tokens.palette.dark

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
const kebab = (key) => key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
const extraVars = {
  ...Object.fromEntries(
    Object.entries(tokens.FINANCIAL_COLORS).map(([key, value]) => [
      `--${kebab(key)}`,
      value,
    ])
  ),
  ...Object.fromEntries(
    Object.entries(tokens.KAWAII_COLORS).map(([key, value]) => [
      `--kawaii-${kebab(key)}`,
      value,
    ])
  ),
  "--destructive": tokens.DESTRUCTIVE_COLOR,
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
  const variable = v.trim().slice(2)
  if (!tailwind.includes(`"var(--${variable})"`))
    fail(`tailwind missing --${variable} mapping`)
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

const numeric = readTokens("constants/ui-tokens.ts")
const config = require("../tailwind.config.js").theme.extend
for (const key of ["body", "micro"]) {
  if (config.fontSize[key] !== `${numeric.UI_FONT_SIZE[key]}px`)
    fail(`fontSize.${key} differs from UI_FONT_SIZE`)
}
if (config.maxWidth.content !== `${numeric.UI_LAYOUT.contentMaxWidth}px`)
  fail("content width differs from UI_LAYOUT")
if (config.height["chart-empty"] !== `${numeric.UI_LAYOUT.chartEmptyHeight}px`)
  fail("chart empty height differs from UI_LAYOUT")

const nativeColors = read(
  "modules/expense-buddy-widget/android/src/main/res/values/colors.xml"
)
const nativeNames = {
  background: "background",
  surface: "surface",
  foreground: "text_primary",
  mutedForeground: "text_muted",
  accent: "accent",
  accentForeground: "accent_text",
  border: "track",
}
for (const [scheme, palette] of Object.entries(tokens.palette)) {
  for (const [key, name] of Object.entries(nativeNames)) {
    if (
      !nativeColors.includes(
        `name="expense_widget_${name}_${scheme}">${palette[key]}</color>`
      )
    )
      fail(`native widget ${scheme} ${key} differs from palette`)
  }
  const block =
    scheme === "dark"
      ? css.match(/\.dark:root\s*\{([\s\S]*?)\}/)?.[1]
      : css.match(/:root\s*\{([\s\S]*?)\}/)?.[1]
  for (const [key, color] of Object.entries(tokens.SEMANTIC_FOREGROUND_COLORS[scheme])) {
    if (!block?.includes(`--${key}: ${color};`))
      fail(`${scheme} semantic ${key} differs from palette`)
  }
}
ok("numeric aliases, semantic foregrounds, and native widget palette checked")

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
