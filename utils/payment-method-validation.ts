/**
 * Payment Method Validation Utilities
 *
 * Pure functions for validating payment method identifiers.
 */

/**
 * Validates and sanitizes a payment method identifier input.
 *
 * This function:
 * 1. Removes all non-digit characters
 * 2. Limits the result to the specified maxLength
 *
 * @param input - The raw input string
 * @param maxLength - Maximum allowed length (3 for UPI, 4 for cards)
 * @returns Sanitized string containing only digits, limited to maxLength
 */
export function validateIdentifier(input: string, maxLength: number): string {
  // Remove all non-digit characters
  const digitsOnly = input.replace(/\D/g, "")
  // Limit to maxLength
  return digitsOnly.slice(0, maxLength)
}
