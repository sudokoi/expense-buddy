/**
 * ML Parser Test Helper
 *
 * Provides deterministic mock results for ML parser testing
 */

import { MLParseResult } from "./ml-parser"

interface MockMLResult {
  merchant: string
  amount: number
  date: string
  confidence: number
}

/**
 * Mock ML parser for testing
 * Returns deterministic results based on message content
 */
export function mockMLParse(message: string): MockMLResult | null {
  const upperMessage = message.toUpperCase()

  // Check if it looks like a transaction message
  const transactionKeywords = [
    "DEBITED",
    "SPENT",
    "PAID",
    "WITHDRAWN",
    "CHARGED",
    "CREDITED",
    "RECEIVED",
    "REFUND",
    "CASHBACK",
    "PURCHASE",
    "TRANSACTION",
    "RS.",
    "INR",
    "$",
    "€",
  ]

  const isTransaction = transactionKeywords.some((kw) => upperMessage.includes(kw))

  if (!isTransaction) {
    return null
  }

  // Extract amount
  const amountMatch = message.match(/[\d,]+\.?\d*/)
  const amount = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, "")) : 0

  // Extract merchant - look for common patterns
  let merchant = "Unknown"
  const merchantPatterns = [
    /(?:at|to)\s+([A-Za-z][A-Za-z0-9\s]*?)(?:\s+on|\s+via|\.|$)/i,
    /(?:from|at)\s+([A-Za-z][A-Za-z0-9\s]*?)(?:\s+on|\s+via|\.|$)/i,
  ]

  for (const pattern of merchantPatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      merchant = match[1].trim()
      break
    }
  }

  // Check for known merchants
  const knownMerchants = [
    "SWIGGY",
    "AMAZON",
    "FLIPKART",
    "ZOMATO",
    "UBER",
    "OLA",
    "STARBUCKS",
    "TESTMERCHANT",
  ]

  for (const known of knownMerchants) {
    if (upperMessage.includes(known)) {
      merchant = known.charAt(0) + known.slice(1).toLowerCase()
      break
    }
  }

  // Extract date
  const dateMatch = message.match(/(\d{2})[-/](\d{2})[-/](\d{4})/)
  const date = dateMatch
    ? new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`).toISOString()
    : new Date().toISOString()

  return {
    merchant,
    amount,
    date,
    confidence: 0.85,
  }
}

/**
 * Setup mock for ML parser in tests
 */
export function setupMLParserMock(): void {
  jest.mock("./ml-parser", () => {
    const actual = jest.requireActual("./ml-parser")
    return {
      ...actual,
      mlParser: {
        ...actual.mlParser,
        initialize: jest.fn().mockResolvedValue(undefined),
        parse: jest.fn().mockImplementation(async (message: string) => {
          const result = mockMLParse(message)
          if (result) {
            return {
              parsed: {
                amount: result.amount,
                currency: "INR",
                merchant: result.merchant,
                date: result.date,
                paymentMethod: "Other",
                paymentInstrument: undefined,
                transactionType: "debit",
                confidenceScore: result.confidence,
                rawMessage: message,
                metadata: {
                  source: "sms",
                  sender: "Unknown",
                  messageId: "test-msg-id",
                  confidenceScore: result.confidence,
                  parsedAt: new Date().toISOString(),
                },
              },
              confidence: result.confidence,
              method: "ml",
              mlConfidence: result.confidence,
            } as MLParseResult
          }
          return {
            parsed: null,
            confidence: 0,
            method: "none",
          } as MLParseResult
        }),
        isMLAvailable: jest.fn().mockReturnValue(true),
        dispose: jest.fn().mockResolvedValue(undefined),
      },
    }
  })
}
