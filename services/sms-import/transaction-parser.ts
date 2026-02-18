/**
 * Transaction Parser
 *
 * Parses SMS messages to extract transaction data using regex patterns
 */

import { ParsedTransaction, ParseResult, ImportSource } from "../../types/sms-import"
import { PaymentMethodType } from "../../types/expense"
import { BANK_PATTERNS } from "./constants"

export class TransactionParser {
  /**
   * Parse an SMS message to extract transaction data
   */
  async parse(
    message: string,
    source: ImportSource = "sms"
  ): Promise<ParsedTransaction | null> {
    // Try each bank pattern
    for (const [bankName, pattern] of Object.entries(BANK_PATTERNS)) {
      const result = this.tryPattern(message, pattern, source, bankName)
      if (result.parsed && result.confidence > 0.5) {
        return result.parsed
      }
    }

    // Try generic patterns
    return this.tryGenericPatterns(message, source)
  }

  /**
   * Try to match a specific bank pattern
   */
  private tryPattern(
    message: string,
    pattern: { name: string; regex: RegExp; baseConfidence: number; region: string },
    source: ImportSource,
    _bankName: string
  ): ParseResult {
    const match = message.match(pattern.regex)

    if (!match) {
      return { parsed: null, confidence: 0 }
    }

    const groups = match.groups || {}

    // Extract amount
    const amount = this.parseAmount(match[1] || groups.amount)
    if (!amount) {
      return { parsed: null, confidence: 0 }
    }

    // Extract merchant (check multiple capture groups for patterns with alternations)
    const merchant = this.cleanMerchant(
      match[2] || match[3] || groups.merchant || groups.payee || "Unknown"
    )

    // Extract date (use current date if not found)
    const date =
      this.parseDate(groups.date || groups.datetime) || new Date().toISOString()

    // Detect transaction type
    const transactionType = this.detectTransactionType(message)

    // Extract payment method
    const paymentMethod = this.inferPaymentMethod(message, groups)

    // Calculate confidence
    const confidence = this.calculateConfidence(match, pattern.baseConfidence, groups)

    // Generate message ID for duplicate detection
    const messageId = this.generateMessageId(message)

    return {
      parsed: {
        amount,
        currency: this.extractCurrency(message, groups),
        merchant,
        date,
        paymentMethod,
        paymentInstrument: this.extractInstrument(message, groups),
        transactionType,
        confidenceScore: confidence,
        metadata: {
          source,
          rawMessage: message,
          sender: this.extractSender(message) || "Unknown",
          messageId,
          confidenceScore: confidence,
          parsedAt: new Date().toISOString(),
        },
      },
      confidence,
    }
  }

  /**
   * Try generic patterns for non-bank SMS
   */
  private tryGenericPatterns(
    message: string,
    source: ImportSource
  ): ParsedTransaction | null {
    // Generic patterns for various transaction formats
    const genericPatterns = [
      // Pattern: "You spent $XX.XX at MERCHANT"
      {
        regex:
          /(?:spent|paid|charged)\s*(?:₹|\$|€|£|Rs\.?|INR)?\s*([\d,.]+)\s*(?:at|to|with)\s+(.+?)(?:\s+on|\.|$)/i,
        baseConfidence: 0.6,
      },
      // Pattern: "Transaction of $XX.XX at MERCHANT"
      {
        regex:
          /(?:transaction|purchase|payment)\s*(?:of\s*)?(?:₹|\$|€|£|Rs\.?|INR)?\s*([\d,.]+)\s*(?:at|to|with)\s+(.+?)(?:\s+on|\.|$)/i,
        baseConfidence: 0.6,
      },
      // Pattern: "Rs.XXX at MERCHANT on DATE"
      {
        regex:
          /(?:₹|Rs\.?|INR)\s*\.?\s*([\d,.]+)\s*(?:at|to)\s+(.+?)(?:\s+on\s+\d{2}[-/]\d{2}[-/]\d{4}|\.|$)/i,
        baseConfidence: 0.8,
      },
    ]

    for (const pattern of genericPatterns) {
      const match = message.match(pattern.regex)
      if (match) {
        const amount = this.parseAmount(match[1])
        const merchant = this.cleanMerchant(match[2] || "Unknown")

        if (amount && merchant !== "Unknown") {
          return {
            amount,
            currency: this.extractCurrency(message, {}),
            merchant,
            date: new Date().toISOString(),
            paymentMethod: "Other",
            paymentInstrument: undefined,
            transactionType: "debit",
            confidenceScore: pattern.baseConfidence,
            metadata: {
              source,
              rawMessage: message,
              sender: this.extractSender(message) || "Unknown",
              messageId: this.generateMessageId(message),
              confidenceScore: pattern.baseConfidence,
              parsedAt: new Date().toISOString(),
            },
          }
        }
      }
    }

    return null
  }

  /**
   * Parse amount from string
   */
  private parseAmount(amountStr: string): number | null {
    if (!amountStr) return null

    // Remove currency symbols and commas
    const cleaned = amountStr
      .replace(/[₹$€¥£,]/g, "")
      .replace(/\s+/g, "")
      .trim()

    const amount = parseFloat(cleaned)
    return isNaN(amount) ? null : amount
  }

  /**
   * Clean merchant name
   */
  private cleanMerchant(merchant: string): string {
    return toTitleCase(
      merchant
        .replace(/\s+/g, " ")
        .replace(/\b(PVT|LTD|INC|LLC|CORP)\.?\b/gi, "")
        .replace(/\s*-\s*.*$/, "") // Remove trailing description after dash
        .replace(/[.]+$/, "") // Remove trailing dots
        .trim()
    )
  }

  /**
   * Parse date from string
   */
  private parseDate(dateStr: string): string | null {
    if (!dateStr) return null

    // Try various date formats
    const formats = [
      // YYYY-MM-DD (check first to avoid 4-digit year matching as day in DMY)
      { regex: /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/, format: "YMD" },
      // DD-MM-YYYY
      { regex: /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/, format: "DMY" },
      // MM-DD-YYYY
      { regex: /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/, format: "MDY" },
    ]

    for (const { regex, format } of formats) {
      const match = dateStr.match(regex)
      if (match) {
        try {
          let year, month, day
          if (format === "DMY") {
            day = parseInt(match[1])
            month = parseInt(match[2]) - 1 // JS months are 0-indexed
            year = match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])
          } else if (format === "YMD") {
            year = parseInt(match[1])
            month = parseInt(match[2]) - 1
            day = parseInt(match[3])
          } else {
            month = parseInt(match[1]) - 1
            day = parseInt(match[2])
            year = parseInt(match[3])
          }

          const date = new Date(year, month, day)
          if (!isNaN(date.getTime())) {
            return date.toISOString()
          }
        } catch {
          // Continue to next format
        }
      }
    }

    return null
  }

  /**
   * Detect transaction type (debit/credit)
   */
  private detectTransactionType(message: string): "debit" | "credit" {
    const creditKeywords = ["credited", "received", "refund", "cashback"]

    const lowerMessage = message.toLowerCase()

    if (creditKeywords.some((kw) => lowerMessage.includes(kw))) {
      return "credit"
    }

    // Default to debit
    return "debit"
  }

  /**
   * Infer payment method from message
   */
  private inferPaymentMethod(
    message: string,
    groups: Record<string, string>
  ): PaymentMethodType {
    const lowerMessage = message.toLowerCase()

    // Check for UPI
    if (lowerMessage.includes("upi") || groups.upiRef) {
      return "UPI"
    }

    // Check for credit card
    if (lowerMessage.includes("credit card") || lowerMessage.includes("cc ")) {
      return "Credit Card"
    }

    // Check for debit card
    if (lowerMessage.includes("debit card") || lowerMessage.includes("dc ")) {
      return "Debit Card"
    }

    // Check for net banking
    if (
      lowerMessage.includes("net banking") ||
      lowerMessage.includes("internet banking")
    ) {
      return "Net Banking"
    }

    // Check for wallets
    if (lowerMessage.includes("paytm")) {
      return "Amazon Pay" // Using Amazon Pay as generic wallet
    }

    // Check for cash
    if (lowerMessage.includes("cash")) {
      return "Cash"
    }

    // Default
    return "Other"
  }

  /**
   * Extract currency from message
   */
  private extractCurrency(message: string, groups: Record<string, string>): string {
    if (groups.currency) return groups.currency

    const lowerMessage = message.toLowerCase()

    if (
      lowerMessage.includes("inr") ||
      lowerMessage.includes("₹") ||
      lowerMessage.includes("rs.")
    ) {
      return "INR"
    }
    if (lowerMessage.includes("$") || lowerMessage.includes("usd")) {
      return "USD"
    }
    if (lowerMessage.includes("€") || lowerMessage.includes("eur")) {
      return "EUR"
    }
    if (lowerMessage.includes("£") || lowerMessage.includes("gbp")) {
      return "GBP"
    }
    if (lowerMessage.includes("¥") || lowerMessage.includes("jpy")) {
      return "JPY"
    }

    // Default to INR for Indian bank messages
    return "INR"
  }

  /**
   * Extract payment instrument details
   */
  private extractInstrument(
    message: string,
    groups: Record<string, string>
  ): { type: string; lastDigits?: string } | undefined {
    // Look for card/account numbers
    const cardMatch = message.match(/\*+(\d{4})/)
    if (cardMatch) {
      return {
        type: this.inferPaymentMethod(message, groups),
        lastDigits: cardMatch[1],
      }
    }

    return undefined
  }

  /**
   * Extract sender from message
   */
  private extractSender(message: string): string | null {
    // Look for sender patterns like "AD-HDFCBK" or "VK-HDFCBK"
    const senderMatch = message.match(/^([A-Z]{2}-[A-Z]+)/)
    if (senderMatch) {
      return senderMatch[1]
    }

    return null
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    match: RegExpMatchArray,
    baseConfidence: number,
    groups: Record<string, string>
  ): number {
    let score = baseConfidence

    // Boost if we have all key fields
    const hasAmount = match[1] || groups.amount
    const hasMerchant = match[2] || groups.merchant || groups.payee

    if (hasAmount && hasMerchant) {
      score += 0.1
    }

    // Boost if we have a date
    if (groups.date || groups.datetime) {
      score += 0.05
    }

    return Math.min(score, 1.0)
  }

  /**
   * Generate unique message ID for duplicate detection
   */
  private generateMessageId(message: string): string {
    let hash = 0
    for (let i = 0; i < message.length; i++) {
      const char = message.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(16)
  }
}

/**
 * Utility: Convert string to title case
 */
function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s)\S/g, (match) => match.toUpperCase())
}

// Singleton instance
export const transactionParser = new TransactionParser()
