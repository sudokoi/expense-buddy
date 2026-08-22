#!/usr/bin/env node
/**
 * Validates the theme flow invariant:
 *   the settings store owns only the raw preference ("light" | "dark" | "system"),
 *   ThemedProvider forwards it unmodified to NativeWind, and nothing resolves
 *   "system" in JS or listens to Appearance directly.
 *
 * Resolving "system" to a concrete value pins a native night-mode override,
 * which silences OS appearance events and breaks live system-theme following.
 * Run via `yarn check:theme-flow` or in CI.
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

// 1. ThemedProvider forwards the raw preference
const provider = read("components/Provider.tsx")
if (!provider.includes("setColorScheme(settings.theme)"))
  fail("Provider.tsx must forward the raw preference: setColorScheme(settings.theme)")
else ok("ThemedProvider forwards raw settings.theme")

if (/selectEffectiveTheme/.test(provider))
  fail("Provider.tsx must not resolve the theme via selectEffectiveTheme")
else ok("ThemedProvider has no JS-side theme resolution")

if (/theme\s*===\s*"system"|===\s*'system'/.test(provider))
  fail('Provider.tsx must not branch on "system" — forward the preference as-is')
else ok("ThemedProvider does not branch on system")

// 2. Settings store owns only the preference
const store = read("stores/settings-store.ts")
for (const banned of ["Appearance", "systemColorScheme", "selectEffectiveTheme"]) {
  if (store.includes(banned))
    fail(
      `settings-store.ts must not reference ${banned} (resolved scheme lives in NativeWind)`
    )
  else ok(`settings-store.ts free of ${banned}`)
}

// 3. No app code subscribes to Appearance directly
const dirs = ["app", "components", "hooks", "services", "stores"]
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue
      walk(rel)
    } else if (/\.tsx?$/.test(entry.name)) {
      const src = read(rel)
      if (/Appearance\.addChangeListener/.test(src))
        fail(
          `${rel} subscribes to Appearance.addChangeListener (OS tracking belongs to NativeWind)`
        )
    }
  }
}
dirs.forEach(walk)
ok("no direct Appearance subscriptions in app code")

if (failures > 0) {
  console.error(
    `\n${failures} theme flow check(s) failed. Forward the raw preference to NativeWind; never resolve "system" in JS.`
  )
  process.exit(1)
}
console.log("\nAll theme flow checks passed.")
