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

    /**
     * Matches the transaction amount. Contract: the numeric value may land in
     * any capture group — the parser uses the first non-blank group
     * (prefix-symbol packs like `$42.10` use a single group; suffix-form
     * packs like `480円` need two).
     */
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

    /**
     * Category inference rules; first match wins, falling back to "Other".
     *
     * Ordering contract: rules MUST be ordered most-specific-brand-first —
     * Food, Groceries, Transport, Rent, Utilities, Entertainment, Health.
     * Brand names routinely contain generic mode nouns (Tesco Metro,
     * Montreal's Metro grocer vs transit), and brand categories must win
     * those collisions; a genuine transit charge still matches via its own
     * specific tokens (TfL, STM, Opal, Suica...).
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
