/**
 * Property-based tests for Service Error Handling
 * Feature: codebase-improvements
 *
 * These tests verify that the error handling utilities produce consistent,
 * user-friendly error messages and properly structured error results.
 */

import * as fc from "fast-check"
import {
  getUserFriendlyMessage,
  createErrorResult,
  classifyError,
  ErrorCategory,
} from "./error-utils"

/**
 * Property 2: Service Error Result Structure
 * For any service function that encounters an error, the returned result
 * object SHALL have success: false and a non-empty error string property.
 */
describe("Property 2: Service Error Result Structure", () => {
  // Arbitrary for generating various error types
  const errorArb = fc.oneof(
    fc.string().map((msg) => new Error(msg)),
    fc.string().map((msg) => new TypeError(msg)),
    fc.string(),
    fc.constant(null),
    fc.constant(undefined)
  )

  it("error results SHALL have success: false and non-empty error message", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }), // serviceName
        fc.string({ minLength: 1 }), // operation
        errorArb, // error
        (serviceName, operation, error) => {
          const result = createErrorResult(serviceName, operation, error)

          // Verify structure
          expect(result.success).toBe(false)
          expect(result.error).toBeDefined()
          expect(typeof result.error).toBe("string")
          expect(result.error!.length).toBeGreaterThan(0)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("error results SHALL NOT contain data property", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        errorArb,
        (serviceName, operation, error) => {
          const result = createErrorResult(serviceName, operation, error)

          // Error results should not have data
          expect(result.data).toBeUndefined()

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 3: Service Error Logging
 * For any service function that catches an error, the service SHALL call
 * console.warn with error details before returning the error result.
 */
describe("Property 3: Service Error Logging", () => {
  const originalWarn = console.warn
  let warnCalls: unknown[][] = []

  beforeEach(() => {
    warnCalls = []
    console.warn = (...args: unknown[]) => {
      warnCalls.push(args)
    }
  })

  afterEach(() => {
    console.warn = originalWarn
  })

  it("createErrorResult SHALL call console.warn with service context", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string(),
        (serviceName, operation, errorMessage) => {
          warnCalls = [] // Reset for each iteration
          const error = new Error(errorMessage)

          createErrorResult(serviceName, operation, error)

          // Verify console.warn was called
          expect(warnCalls.length).toBe(1)

          // Verify the log contains service context
          const logMessage = String(warnCalls[0][0])
          expect(logMessage).toContain(serviceName)
          expect(logMessage).toContain(operation)
          expect(logMessage).toContain("failed")

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("createErrorResult SHALL log the raw error message for debugging", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (errorMessage) => {
        warnCalls = []
        const error = new Error(errorMessage)

        createErrorResult("TestService", "testOperation", error)

        // The raw error message should be in the log for debugging
        const logArgs = warnCalls[0]
        expect(logArgs.length).toBeGreaterThanOrEqual(2)
        expect(String(logArgs[1])).toContain(errorMessage)

        return true
      }),
      { numRuns: 100 }
    )
  })
})

/**
 * Property 4: User-Friendly Network Error Messages
 * For any network error encountered by a service, the returned error message
 * SHALL NOT contain technical details like stack traces or internal error codes,
 * and SHALL be understandable by end users.
 */
describe("Property 4: User-Friendly Network Error Messages", () => {
  // Network error patterns that should be recognized
  const networkErrorPatterns = [
    "Failed to fetch",
    "Network request failed",
    "network error",
    "No internet",
    "offline",
    "timeout",
    "ECONNREFUSED",
    "ENOTFOUND",
  ]

  // Authentication error patterns
  const authErrorPatterns = [
    "401 Unauthorized",
    "403 Forbidden",
    "unauthorized",
    "forbidden",
    "invalid token",
    "authentication failed",
    "Bad credentials",
  ]

  // Technical details that should NOT appear in user messages
  const technicalPatterns = [
    /at\s+\w+\s+\(/i, // Stack trace pattern "at Function ("
    /Error:\s*$/i, // Trailing "Error:"
    /\[object\s+\w+\]/i, // [object Object] etc
    /0x[0-9a-f]+/i, // Hex addresses
    /:\d+:\d+/i, // Line:column numbers
  ]

  it("network errors SHALL return user-friendly connection message", () => {
    fc.assert(
      fc.property(fc.constantFrom(...networkErrorPatterns), (errorPattern) => {
        const error = new Error(`Some prefix ${errorPattern} some suffix`)
        const message = getUserFriendlyMessage(error)

        // Should return the standard network error message
        expect(message).toBe("Unable to connect. Please check your internet connection.")

        return true
      }),
      { numRuns: networkErrorPatterns.length }
    )
  })

  it("authentication errors SHALL return user-friendly auth message", () => {
    fc.assert(
      fc.property(fc.constantFrom(...authErrorPatterns), (errorPattern) => {
        const error = new Error(`Some prefix ${errorPattern} some suffix`)
        const message = getUserFriendlyMessage(error)

        // Should return the standard auth error message
        expect(message).toBe("Authentication failed. Please check your GitHub token.")

        return true
      }),
      { numRuns: authErrorPatterns.length }
    )
  })

  it("error messages SHALL NOT contain technical details", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constantFrom(...networkErrorPatterns),
          fc.constantFrom(...authErrorPatterns),
          fc.string()
        ),
        (errorContent) => {
          const error = new Error(errorContent)
          const message = getUserFriendlyMessage(error)

          // Check that no technical patterns appear in the message
          for (const pattern of technicalPatterns) {
            expect(message).not.toMatch(pattern)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("error messages SHALL be reasonably short for UI display", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 1000 }), (errorContent) => {
        const error = new Error(errorContent)
        const message = getUserFriendlyMessage(error)

        // User-friendly messages should be concise
        expect(message.length).toBeLessThanOrEqual(200)

        return true
      }),
      { numRuns: 100 }
    )
  })

  it("error messages SHALL always be non-empty strings", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().map((s) => new Error(s)),
          fc.constant(null),
          fc.constant(undefined),
          fc.string()
        ),
        (error) => {
          const message = getUserFriendlyMessage(error)

          expect(typeof message).toBe("string")
          expect(message.length).toBeGreaterThan(0)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

/**
 * Additional property tests for error classification
 */
describe("Error Classification Properties", () => {
  const allCategories: ErrorCategory[] = [
    "network",
    "authentication",
    "validation",
    "storage",
    "unknown",
  ]

  it("classifyError SHALL always return a valid category", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string().map((s) => new Error(s)),
          fc.string(),
          fc.constant(null),
          fc.constant(undefined),
          fc.integer()
        ),
        (error) => {
          const category = classifyError(error)

          expect(allCategories).toContain(category)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  it("unknown errors SHALL be classified as 'unknown'", () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter(
            (s) =>
              !s.toLowerCase().includes("fetch") &&
              !s.toLowerCase().includes("network") &&
              !s.toLowerCase().includes("401") &&
              !s.toLowerCase().includes("403") &&
              !s.toLowerCase().includes("unauthorized") &&
              !s.toLowerCase().includes("invalid") &&
              !s.toLowerCase().includes("storage") &&
              !s.toLowerCase().includes("timeout")
          ),
        (randomMessage) => {
          const error = new Error(randomMessage)
          const category = classifyError(error)

          // Random messages without known patterns should be "unknown"
          expect(category).toBe("unknown")

          return true
        }
      ),
      { numRuns: 50 }
    )
  })
})
