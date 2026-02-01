import AsyncStorage from "@react-native-async-storage/async-storage"
import { z } from "zod"
import type { TimeWindow } from "../utils/analytics-calculations"
import type { PaymentInstrumentSelectionKey } from "../utils/analytics-calculations"
import type { PaymentMethodSelectionKey } from "../utils/analytics-calculations"
import { PAYMENT_METHOD_COLORS } from "../constants/payment-method-colors"

const ANALYTICS_FILTERS_KEY = "analytics_filters_v1"

// Zod schema for validation
export const AnalyticsFiltersStateSchema = z
  .object({
    timeWindow: z.enum(["7d", "15d", "1m", "3m", "6m", "1y", "all"]),
    selectedMonth: z.string().nullable(),
    selectedCategories: z.array(z.string()),
    selectedPaymentMethods: z.array(z.string()),
    selectedPaymentInstruments: z.array(z.string()),
    selectedCurrency: z.string().nullable(),
    searchQuery: z.string().default(""),
    minAmount: z.number().min(0).nullable(),
    maxAmount: z.number().min(0).nullable(),
  })
  .refine(
    (data) => {
      // Validate min ≤ max only when both are present
      if (data.minAmount !== null && data.maxAmount !== null) {
        return data.minAmount <= data.maxAmount
      }
      return true
    },
    {
      message: "Min amount must be less than or equal to max amount",
      path: ["minAmount"],
    }
  )

export interface AnalyticsFiltersState {
  timeWindow: TimeWindow
  selectedMonth: string | null
  selectedCategories: string[]
  selectedPaymentMethods: PaymentMethodSelectionKey[]
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
  selectedCurrency: string | null
  searchQuery: string
  minAmount: number | null
  maxAmount: number | null
}

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFiltersState = {
  timeWindow: "7d",
  selectedMonth: null,
  selectedCategories: [],
  selectedPaymentMethods: [],
  selectedPaymentInstruments: [],
  selectedCurrency: null,
  searchQuery: "",
  minAmount: null,
  maxAmount: null,
}

const ALLOWED_TIME_WINDOWS: TimeWindow[] = ["7d", "15d", "1m", "3m", "6m", "1y", "all"]
const ALLOWED_PAYMENT_METHODS = new Set<string>([
  ...Object.keys(PAYMENT_METHOD_COLORS),
  "__none__",
])

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

function asMonthKey(value: unknown): string | null {
  if (typeof value !== "string") return null
  return /^\d{4}-\d{2}$/.test(value) ? value : null
}

function asTimeWindow(value: unknown): TimeWindow {
  if (typeof value !== "string") return DEFAULT_ANALYTICS_FILTERS.timeWindow
  return (ALLOWED_TIME_WINDOWS as string[]).includes(value)
    ? (value as TimeWindow)
    : DEFAULT_ANALYTICS_FILTERS.timeWindow
}

function asPaymentMethodKeys(value: unknown): PaymentMethodSelectionKey[] {
  const strings = asStringArray(value)
  return strings
    .filter((k) => ALLOWED_PAYMENT_METHODS.has(k))
    .map((k) => k as PaymentMethodSelectionKey)
}

function asNumberOrNull(value: unknown): number | null {
  if (typeof value !== "number") return null
  return isNaN(value) ? null : value
}

export async function loadAnalyticsFilters(): Promise<AnalyticsFiltersState> {
  try {
    const stored = await AsyncStorage.getItem(ANALYTICS_FILTERS_KEY)
    if (!stored) return { ...DEFAULT_ANALYTICS_FILTERS }

    const parsed = JSON.parse(stored) as Partial<AnalyticsFiltersState>

    const next: AnalyticsFiltersState = {
      timeWindow: asTimeWindow(parsed.timeWindow),
      selectedMonth: asMonthKey(parsed.selectedMonth),
      selectedCategories: asStringArray(parsed.selectedCategories),
      selectedPaymentMethods: asPaymentMethodKeys(parsed.selectedPaymentMethods),
      selectedPaymentInstruments: asStringArray(
        parsed.selectedPaymentInstruments
      ) as PaymentInstrumentSelectionKey[],
      selectedCurrency:
        typeof parsed.selectedCurrency === "string" ? parsed.selectedCurrency : null,
      searchQuery: typeof parsed.searchQuery === "string" ? parsed.searchQuery : "",
      minAmount: asNumberOrNull(parsed.minAmount),
      maxAmount: asNumberOrNull(parsed.maxAmount),
    }

    // Normalize: if payment methods are "All", instruments must also be "All".
    if (next.selectedPaymentMethods.length === 0) {
      next.selectedPaymentInstruments = []
    }

    if (next.selectedMonth) {
      next.timeWindow = "all"
    }

    return next
  } catch (error) {
    console.warn("Failed to load analytics filters:", error)
    return { ...DEFAULT_ANALYTICS_FILTERS }
  }
}

export async function saveAnalyticsFilters(
  filters: AnalyticsFiltersState
): Promise<void> {
  const normalized: AnalyticsFiltersState = {
    ...filters,
    selectedMonth: filters.selectedMonth ?? null,
    selectedPaymentInstruments:
      filters.selectedPaymentMethods.length === 0
        ? []
        : filters.selectedPaymentInstruments,
  }

  try {
    await AsyncStorage.setItem(ANALYTICS_FILTERS_KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn("Failed to save analytics filters:", error)
    throw error
  }
}

export function analyticsFiltersStorageKeyForTests(): string {
  return ANALYTICS_FILTERS_KEY
}
