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

    /** Default for ambiguous local currency symbols; explicit currency wins. */
    val currencyCode: String

    /** Prefix for matchedPatternKey values (e.g. "india" -> "india.generic.transaction"). */
    val patternKeyPrefix: String

    val settledDebitKeywords: Regex

    val creditOnlyKeywords: Regex

    val otpKeywords: Regex

    val nonExpenseInfoKeywords: Regex

    val nonExpenseTransactionOutcomeKeywords: Regex

    val approvalPromptKeywords: Regex

    /**
     * Merchant matches outrank body matches; longer phrases outrank shorter
     * words. List order breaks equal-specificity ties. Generic Latin terms
     * must match complete tokens, not substrings (lease must not match please).
     */
    val categoryInferenceRules: List<Pair<String, Regex>>

    /**
     * Payment-method hints evaluated in order; first match wins.
     *
     * Contract: type strings MUST be members of the app's closed
     * `PaymentMethodType` vocabulary (Cash, Amazon Pay, UPI, Credit Card,
     * Debit Card, Net Banking, Other) — they are persisted verbatim into
     * expenses. Map region-specific rails onto the closest member
     * (Interac/Zelle/PayID/Osko/Faster Payments -> Net Banking).
     */
    val paymentMethodHints: List<Pair<String, Regex>>
}

/** Latin boundaries without imposing English word segmentation on other scripts. */
internal fun Regex.tokenMatches(text: String): Sequence<MatchResult> =
    findAll(text).filter { match ->
        text.getOrNull(match.range.first - 1)?.lowercaseChar() !in 'a'..'z' &&
            text.getOrNull(match.range.last + 1)?.lowercaseChar() !in 'a'..'z'
    }
