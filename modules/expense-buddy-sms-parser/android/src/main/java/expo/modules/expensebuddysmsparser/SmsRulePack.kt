package expo.modules.expensebuddysmsparser

/**
 * A region-specific rule set for parsing bank transaction SMS.
 *
 * Implementations supply deterministic regexes and metadata; the shared
 * pipeline in [SmsMessageParser] owns normalization, skip checks, extraction,
 * and fingerprinting so behavior stays consistent across regions.
 */
interface SmsRulePack {
    /** ISO 3166-1 alpha-2 region code this pack serves (e.g. "IN"). */
    val regionCode: String

    /** BCP-47 locale tag stamped onto parsed messages (e.g. "en-IN"). */
    val localeTag: String

    /** ISO 4217 currency code stamped onto parsed amounts (e.g. "INR"). */
    val currencyCode: String

    /** Prefix for matchedPatternKey values (e.g. "india" -> "india.generic.transaction"). */
    val patternKeyPrefix: String

    val amountPattern: Regex
    val debitKeywords: Regex
    val settledDebitKeywords: Regex
    val creditOnlyKeywords: Regex
    val otpKeywords: Regex
    val nonExpenseInfoKeywords: Regex
    val nonExpenseTransactionOutcomeKeywords: Regex
    val approvalPromptKeywords: Regex

    /** Merchant patterns tried in order; first match wins. */
    val merchantPatterns: List<Regex>

    /** Category inference rules; first match wins, falling back to "Other". */
    val categoryInferenceRules: List<Pair<String, Regex>>

    /** Payment-method hints evaluated in order; first match wins. */
    val paymentMethodHints: List<Pair<String, Regex>>
}
