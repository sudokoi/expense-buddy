import { format, parseISO } from "date-fns"

export function getLocalDayKey(isoDate: string): string {
  return format(parseISO(isoDate), "yyyy-MM-dd")
}
