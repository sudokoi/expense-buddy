/**
 * Analytics Calculations
 *
 * This file is now a barrel export for backward compatibility.
 * All functionality has been split into focused modules:
 * - analytics/time.ts - Time window utilities
 * - analytics/filters.ts - Filtering functions
 * - analytics/currency.ts - Currency grouping
 * - analytics/aggregations.ts - Chart aggregations
 * - analytics/statistics.ts - Statistics calculations
 *
 * @deprecated Import from specific modules instead for better tree-shaking
 */

export * from "./analytics/time"
export * from "./analytics/filters"
export * from "./analytics/currency"
export * from "./analytics/aggregations"
export * from "./analytics/statistics"
