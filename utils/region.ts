import { getLocales } from "expo-localization"

export const SMS_REGIONS = ["IN", "CA", "AU"] as const

export type SmsRegion = (typeof SMS_REGIONS)[number]

const DEFAULT_SMS_REGION: SmsRegion = "IN"

const REGION_LABELS: Record<SmsRegion, string> = {
  IN: "India",
  CA: "Canada",
  AU: "Australia",
}

/**
 * Maps app language tags to SMS import regions.
 * Unknown languages resolve to IN, preserving historical behavior (ADR-010).
 */
const LANGUAGE_REGION_MAP: Record<string, SmsRegion> = {
  "en-IN": "IN",
  hi: "IN",
  "en-CA": "CA",
  "en-AU": "AU",
}

function regionFromLanguageTag(languageTag: string): SmsRegion {
  return LANGUAGE_REGION_MAP[languageTag] ?? DEFAULT_SMS_REGION
}

export function isValidSmsRegion(region: string): region is SmsRegion {
  return (SMS_REGIONS as readonly string[]).includes(region)
}

/** Normalizes unknown/stale stored values to the default region. */
export function normalizeSmsRegion(region: string | undefined | null): SmsRegion {
  return region && isValidSmsRegion(region) ? region : DEFAULT_SMS_REGION
}

export function getSmsRegionLabel(region: string): string {
  const normalized = normalizeSmsRegion(region)
  return REGION_LABELS[normalized]
}

/**
 * Resolves the region for a language preference.
 * "system" resolves through the device's primary locale tag before mapping.
 */
export function getDefaultRegionForLanguage(language: string): SmsRegion {
  if (language === "system") {
    const systemLang = getLocales()[0]?.languageTag || "en-IN"
    return regionFromLanguageTag(systemLang)
  }

  return regionFromLanguageTag(language)
}

/** Seeds the initial region from the device locale (one-time, at migration). */
export function seedSmsRegionFromDevice(): SmsRegion {
  const systemLang = getLocales()[0]?.languageTag || "en-IN"
  return regionFromLanguageTag(systemLang)
}
