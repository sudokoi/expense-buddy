/**
 * Generic result type for service operations
 *
 * Provides a consistent pattern for service functions to return
 * success/failure status along with optional data and error messages.
 */
export interface ServiceResult<T = void> {
  /** Whether the operation succeeded */
  success: boolean
  /** The result data (only present on success) */
  data?: T
  /** Error message (only present on failure) */
  error?: string
  /** Optional user-friendly message */
  message?: string
}
