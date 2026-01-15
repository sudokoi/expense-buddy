import AsyncStorage from "@react-native-async-storage/async-storage"
import type { TimeWindow } from "../utils/analytics-calculations"
import type { PaymentInstrumentSelectionKey } from "../utils/analytics-calculations"
import type { PaymentMethodSelectionKey } from "../components/analytics/PaymentMethodFilter"
import { PAYMENT_METHOD_COLORS } from "../constants/payment-method-colors"

const ANALYTICS_FILTERS_KEY = "analytics_filters_v1"

export interface AnalyticsFiltersState {
  timeWindow: TimeWindow
  selectedCategories: string[]
  selectedPaymentMethods: PaymentMethodSelectionKey[]
  selectedPaymentInstruments: PaymentInstrumentSelectionKey[]
}

export const DEFAULT_ANALYTICS_FILTERS: AnalyticsFiltersState = {
  timeWindow: "7d",
  selectedCategories: [],
  selectedPaymentMethods: [],
  selectedPaymentInstruments: [],
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

export async function loadAnalyticsFilters(): Promise<AnalyticsFiltersState> {
  try {
    const stored = await AsyncStorage.getItem(ANALYTICS_FILTERS_KEY)
    if (!stored) return { ...DEFAULT_ANALYTICS_FILTERS }

    const parsed = JSON.parse(stored) as Partial<AnalyticsFiltersState>

    const next: AnalyticsFiltersState = {
      timeWindow: asTimeWindow(parsed.timeWindow),
      selectedCategories: asStringArray(parsed.selectedCategories),
      selectedPaymentMethods: asPaymentMethodKeys(parsed.selectedPaymentMethods),
      selectedPaymentInstruments: asStringArray(
        parsed.selectedPaymentInstruments
      ) as PaymentInstrumentSelectionKey[],
    }

    // Normalize: if payment methods are "All", instruments must also be "All".
    if (next.selectedPaymentMethods.length === 0) {
      next.selectedPaymentInstruments = []
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
