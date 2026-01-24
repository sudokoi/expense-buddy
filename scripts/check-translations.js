const fs = require("fs")
const path = require("path")

const LOCALES_DIR = path.join(__dirname, "../locales")

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

function getLocales() {
  return fs
    .readdirSync(LOCALES_DIR, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
}

function checkTranslations() {
  const locales = getLocales()

  // 1. Collect all unique keys from all locales
  const allKeys = new Set()
  const localeKeys = {}

  locales.forEach((locale) => {
    try {
      const translation = loadTranslation(locale)
      const keys = flattenKeys(translation)
      localeKeys[locale] = new Set(keys)
      keys.forEach((key) => allKeys.add(key))
    } catch (error) {
      console.error(`\n❌ Error processing ${locale}:`, error.message)
      process.exit(1)
    }
  })

  console.log(`Found ${allKeys.size} unique keys across ${locales.length} locales.`)

  // 2. Check each locale against the superset of all keys
  let hasErrors = false

  locales.forEach((locale) => {
    const keys = localeKeys[locale]
    const missingKeys = [...allKeys].filter((key) => !keys.has(key))

    if (missingKeys.length > 0) {
      console.error(`\n❌ Error: Missing ${missingKeys.length} keys in ${locale}:`)
      missingKeys.forEach((key) => console.error(`  - ${key}`))
      hasErrors = true
    } else {
      console.log(`✅ ${locale} covers all known keys.`)
    }
  })

  if (hasErrors) {
    process.exit(1)
  }
  console.log("\nAll translations valid and synced!")
}

checkTranslations()
