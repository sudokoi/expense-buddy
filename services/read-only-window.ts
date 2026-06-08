import { differenceInCalendarMonths, parseISO } from "date-fns"
import { getLocalDayKey } from "../utils/date"
import type { Expense } from "../types/expense"

/** Configurable, NOT user-facing. Entries dated older than this many months
 *  from today cannot be created, edited, or deleted by the user. */
export const READ_ONLY_WINDOW_MONTHS = 6

/** A dayKey is "yyyy-MM-dd". A day is editable if it is within the window. */
export function isDayEditable(dayKey: string, now: Date = new Date()): boolean {
  const day = parseISO(dayKey)
  return differenceInCalendarMonths(now, day) < READ_ONLY_WINDOW_MONTHS
}

/** An expense is editable if the day it is filed under is editable. */
export function isExpenseEditable(expense: Expense, now: Date = new Date()): boolean {
  return isDayEditable(getLocalDayKey(expense.date), now)
}

/** For create / back-date: validate the target date itself. */
export function isDateEditable(isoDate: string, now: Date = new Date()): boolean {
  return isDayEditable(getLocalDayKey(isoDate), now)
}
