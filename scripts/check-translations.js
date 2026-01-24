const fs = require("fs")
const path = require("path")

const LOCALES_DIR = path.join(__dirname, "../locales")
const BASE_LOCALE = "en-IN"

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
  if (!locales.includes(BASE_LOCALE)) {
    console.error(`Base locale ${BASE_LOCALE} not found in ${LOCALES_DIR}`)
    process.exit(1)
  }

  console.log(`Base locale: ${BASE_LOCALE}`)
  const baseTranslation = loadTranslation(BASE_LOCALE)
  const baseKeys = new Set(flattenKeys(baseTranslation))
  let hasErrors = false

  locales.forEach((locale) => {
    if (locale === BASE_LOCALE) return

    try {
      const translation = loadTranslation(locale)
      const keys = new Set(flattenKeys(translation))
      const missingKeys = [...baseKeys].filter((key) => !keys.has(key))

      if (missingKeys.length > 0) {
        console.error(`\n❌ Error: Missing ${missingKeys.length} keys in ${locale}:`)
        missingKeys.forEach((key) => console.error(`  - ${key}`))
        hasErrors = true
      } else {
        console.log(`✅ ${locale} matches base keys.`)
      }
    } catch (error) {
      console.error(`\n❌ Error processing ${locale}:`, error.message)
      hasErrors = true
    }
  })

  if (hasErrors) {
    process.exit(1)
  }
  console.log("\nAll translations valid!")
}

checkTranslations()
