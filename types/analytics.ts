/**
 * Analytics Types
 *
 * Centralized exports for all analytics-related types.
 * This barrel file provides a single source of truth for analytics type imports.
 */

// Core types from utils/analytics/time
export type { TimeWindow } from "../utils/analytics/time"

// Filter types from utils/analytics/filters
export type {
  FilterState,
  PaymentInstrumentSelectionKey,
  PaymentMethodSelectionKey,
} from "../utils/analytics/filters"

// Chart data types from utils/analytics/aggregations
export type {
  CategoryColorMap,
  PieChartDataItem,
  PaymentMethodChartDataItem,
  PaymentInstrumentChartDataItem,
  LineChartDataItem,
} from "../utils/analytics/aggregations"

// Date range type (local)
export interface DateRange {
  start: Date
  end: Date
}
