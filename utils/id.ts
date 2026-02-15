/**
 * ID Generator Utility
 *
 * Generates unique IDs for expenses and other entities
 */

/**
 * Generate a unique ID
 * Format: timestamp-random
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
