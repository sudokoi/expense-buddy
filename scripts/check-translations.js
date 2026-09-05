const fs = require("fs")
const path = require("path")
const ts = require("typescript")

const LOCALES_DIR = path.join(__dirname, "../locales")
const I18N_FILE = path.join(__dirname, "../i18n.ts")

// Regional variants that share another locale's translation bundle at runtime
// (see i18n.ts and ADR-010). Keep in sync with the alias switch there.
const ALIAS_LOCALES = {
  "en-CA": "en-GB",
  "en-AU": "en-GB",
}

function flattenKeys(obj, prefix = "") {
  let keys = []
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const newKey = prefix ? `${prefix}.${key}` : key
      if (typeof obj[key] === "object" && obj[key] !== null) {
        keys = keys.concat(flattenKeys(obj[key], newKey))
      } else {
        keys.push(newKey)
      }
    }
  }
  return keys
}

function loadTranslation(locale) {
  const filePath = path.join(LOCALES_DIR, locale, "translation.json")
  if (!fs.existsSync(filePath)) {
    throw new Error(`Translation file not found for locale: ${locale}`)
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function getBundleLocales() {
  return fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
}

/**
 * Reads SUPPORTED_LOCALES from i18n.ts so a new runtime locale cannot skip
 * this check. Fails loudly if the declaration cannot be parsed.
 */
function getSupportedLocales() {
  const source = fs.readFileSync(I18N_FILE, "utf8")
  const match = source.match(/const SUPPORTED_LOCALES = \[([^\]]*)\]/)
  if (!match) {
    throw new Error(`Could not parse SUPPORTED_LOCALES from ${I18N_FILE}`)
  }
  const locales = [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
  if (locales.length === 0) {
    throw new Error(`SUPPORTED_LOCALES in ${I18N_FILE} is empty or unparsable`)
  }
  return locales
}

/** Bundle parity alone misses keys absent from every locale. Check real call sites too. */
function checkSourceKeys(keys) {
  const root = path.join(__dirname, "..")
  let valid = true
  const visitDirectory = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== "__tests__") visitDirectory(file)
        continue
      }
      if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\./.test(entry.name)) continue
      const source = ts.createSourceFile(
        file,
        fs.readFileSync(file, "utf8"),
        ts.ScriptTarget.Latest,
        true
      )
      const visit = (node) => {
        if (
          ts.isCallExpression(node) &&
          /^(t|i18n\.t|i18next\.t)$/.test(node.expression.getText(source))
        ) {
          const key = node.arguments[0]
          if (
            key &&
            ts.isStringLiteral(key) &&
            !keys.has(key.text) &&
            !keys.has(`${key.text}_other`)
          ) {
            const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1
            console.error(
              `❌ ${path.relative(root, file)}:${line}: unknown locale key "${key.text}"`
            )
            valid = false
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
  }
  for (const directory of [
    "app",
    "components",
    "hooks",
    "providers",
    "services",
    "stores",
    "utils",
    "constants",
  ]) {
    visitDirectory(path.join(root, directory))
  }
  return valid
}

// Background notifications and first-launch widgets must work before JS starts.
function checkNativeKeys() {
  let valid = true
  for (const module of ["expense-buddy-sms-module", "expense-buddy-widget"]) {
    const directory = path.join(
      __dirname,
      "..",
      "modules",
      module,
      "android/src/main/res"
    )
    const keysFor = (folder) =>
      new Set(
        [
          ...fs
            .readFileSync(path.join(directory, folder, "strings.xml"), "utf8")
            .matchAll(/<(?:string|plurals) name="([^"]+)"/g),
        ].map((match) => match[1])
      )
    const canonical = keysFor("values")
    for (const locale of ["hi", "ja"]) {
      const keys = keysFor(`values-${locale}`)
      if (keys.size !== canonical.size || [...canonical].some((key) => !keys.has(key))) {
        console.error(
          `❌ ${module}: Android ${locale} resource keys differ from defaults`
        )
        valid = false
      }
    }
  }
  return valid
}

function checkTranslations() {
  const bundleLocales = getBundleLocales()
  const supportedLocales = getSupportedLocales()

  let hasErrors = false

  // 1. Every supported locale must resolve to an existing translation bundle,
  //    either directly or through a declared alias.
  const resolvedBundles = new Set()
  for (const locale of supportedLocales) {
    if (bundleLocales.includes(locale)) {
      resolvedBundles.add(locale)
    } else if (ALIAS_LOCALES[locale]) {
      const target = ALIAS_LOCALES[locale]
      if (!bundleLocales.includes(target)) {
        console.error(
          `❌ Error: alias locale ${locale} points to "${target}" which has no translation directory.`
        )
        hasErrors = true
      } else {
        resolvedBundles.add(target)
        console.log(`✅ ${locale} aliases ${target}.`)
      }
    } else {
      console.error(
        `❌ Error: supported locale "${locale}" has no translation directory and no alias entry in ALIAS_LOCALES.`
      )
      hasErrors = true
    }
  }

  // 2. No stale bundle directories that the app can never load.
  for (const locale of bundleLocales) {
    if (
      !supportedLocales.includes(locale) &&
      !Object.values(ALIAS_LOCALES).includes(locale)
    ) {
      console.error(
        `❌ Error: translation directory "${locale}" is not in SUPPORTED_LOCALES and is not an alias target — it is dead weight.`
      )
      hasErrors = true
    }
  }

  if (hasErrors) {
    process.exit(1)
  }

  // 3. Collect all unique keys from all resolvable bundles.
  const allKeys = new Set()
  const localeKeys = {}

  for (const locale of resolvedBundles) {
    try {
      const translation = loadTranslation(locale)
      const keys = flattenKeys(translation)
      localeKeys[locale] = new Set(keys)
      keys.forEach((key) => allKeys.add(key))
    } catch (error) {
      console.error(`\n❌ Error processing ${locale}:`, error.message)
      process.exit(1)
    }
  }

  console.log(
    `Found ${allKeys.size} unique keys across ${resolvedBundles.size} bundles ` +
      `(${supportedLocales.length} supported locales).`
  )

  // 4. Check each bundle against the superset of all keys.
  for (const locale of resolvedBundles) {
    const keys = localeKeys[locale]
    const missingKeys = [...allKeys].filter((key) => !keys.has(key))

    if (missingKeys.length > 0) {
      console.error(`\n❌ Error: Missing ${missingKeys.length} keys in ${locale}:`)
      missingKeys.forEach((key) => console.error(`  - ${key}`))
      hasErrors = true
    } else {
      console.log(`✅ ${locale} covers all known keys.`)
    }
  }

  if (!checkSourceKeys(allKeys)) hasErrors = true
  if (!checkNativeKeys()) hasErrors = true
  if (hasErrors) process.exit(1)
  console.log("\nAll translations valid and synced; static source keys resolve!")
}

checkTranslations()
