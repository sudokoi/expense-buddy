/**
 * Error handling utilities for service layer
 *
 * Provides consistent error handling patterns across all services,
 * including user-friendly message generation and standard error result creation.
 */

import type { ServiceResult } from "../types/service-result"

/**
 * Error categories for classification
 */
export type ErrorCategory =
  | "network"
  | "authentication"
  | "validation"
  | "storage"
  | "unknown"

/**
 * Classify an error into a category for appropriate handling
 */
export function classifyError(error: unknown): ErrorCategory {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  // Network errors
  if (
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("network error") ||
    message.includes("no internet") ||
    message.includes("offline") ||
    message.includes("timeout") ||
    message.includes("econnrefused") ||
    message.includes("enotfound")
  ) {
    return "network"
  }

  // Authentication errors
  if (
    message.includes("401") ||
    message.includes("403") ||
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("invalid token") ||
    message.includes("authentication failed") ||
    message.includes("bad credentials")
  ) {
    return "authentication"
  }

  // Validation errors
  if (
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("missing") ||
    message.includes("validation")
  ) {
    return "validation"
  }

  // Storage errors
  if (
    message.includes("storage") ||
    message.includes("quota") ||
    message.includes("disk") ||
    message.includes("write") ||
    message.includes("read")
  ) {
    return "storage"
  }

  return "unknown"
}

/**
 * Get a user-friendly error message based on error category
 *
 * Strips technical details like stack traces and internal error codes,
 * returning messages that are understandable by end users.
 */
export function getUserFriendlyMessage(error: unknown): string {
  const category = classifyError(error)

  switch (category) {
    case "network":
      return "Unable to connect. Please check your internet connection."

    case "authentication":
      return "Authentication failed. Please check your GitHub token."

    case "validation":
      // For validation errors, try to preserve the specific message
      if (error instanceof Error) {
        // Strip technical prefixes and clean up the message
        const cleaned = error.message
          .replace(/\[.*?\]/g, "") // Remove bracketed prefixes like [ServiceName]
          .replace(/Error:/gi, "") // Remove "Error:" prefix
          .trim()
        if (cleaned.length > 0 && cleaned.length < 200) {
          return cleaned
        }
      }
      return "Invalid input. Please check your data and try again."

    case "storage":
      return "Unable to save data. Please try again."

    default:
      return "An unexpected error occurred. Please try again."
  }
}

/**
 * Create a standard error result for service functions
 *
 * Logs the error with console.warn and returns a properly structured
 * ServiceResult with success: false and a user-friendly error message.
 *
 * @param serviceName - Name of the service for logging context
 * @param operation - Description of the operation that failed
 * @param error - The caught error
 * @returns ServiceResult with success: false and error message
 */
export function createErrorResult<T = void>(
  serviceName: string,
  operation: string,
  error: unknown
): ServiceResult<T> {
  // Log the error with context for debugging
  const rawMessage = error instanceof Error ? error.message : String(error)
  console.warn(`[${serviceName}] ${operation} failed:`, rawMessage)

  // Return user-friendly result
  return {
    success: false,
    error: getUserFriendlyMessage(error),
  }
}

/**
 * Create a success result for service functions
 *
 * @param data - Optional data to include in the result
 * @param message - Optional success message
 * @returns ServiceResult with success: true
 */
export function createSuccessResult<T = void>(
  data?: T,
  message?: string
): ServiceResult<T> {
  const result: ServiceResult<T> = { success: true }
  if (data !== undefined) {
    result.data = data
  }
  if (message !== undefined) {
    result.message = message
  }
  return result
}

/**
 * Wrap an async operation with standard error handling
 *
 * @param serviceName - Name of the service for logging context
 * @param operation - Description of the operation
 * @param fn - The async function to execute
 * @returns ServiceResult with the operation result or error
 */
export async function withErrorHandling<T>(
  serviceName: string,
  operation: string,
  fn: () => Promise<T>
): Promise<ServiceResult<T>> {
  try {
    const data = await fn()
    return createSuccessResult(data)
  } catch (error) {
    return createErrorResult<T>(serviceName, operation, error)
  }
}
