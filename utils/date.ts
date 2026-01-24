import { format, parseISO } from "date-fns"
import { enUS, enGB, enIN, hi, ja } from "date-fns/locale"
import i18next from "i18next"

const locales: Record<string, any> = {
  "en-US": enUS,
  "en-GB": enGB,
  "en-IN": enIN,
  hi: hi,
  ja: ja,
}

export function getLocale() {
  const lang = i18next.language
  return locales[lang] || enUS
}

export function getLocalDayKey(isoDate: string): string {
  return format(parseISO(isoDate), "yyyy-MM-dd")
}

export function formatDate(date: string | Date, formatStr: string): string {
  const d = typeof date === "string" ? parseISO(date) : date
  return format(d, formatStr, { locale: getLocale() })
}
