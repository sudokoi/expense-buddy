package expo.modules.expensebuddysmsparser

/**
 * Canada rule pack. Conservative v1 patterns reconstructed from publicly
 * documented bank alert templates (TD/RBC/Scotia alerts, Interac e-Transfer).
 * Precision is prioritized over recall; the review queue absorbs misses
 * (ADR-010). Tune against real samples post-release.
 */
object CanadaSmsRulePack : SmsRulePack {
    override val regionCode = "CA"
    override val localeTag = "en-CA"
    override val currencyCode = "CAD"
    override val patternKeyPrefix = "canada"

    override val settledDebitKeywords =
        Regex("debited|spent|withdrawn|paid|purchase(?:d)?|charged|sent", RegexOption.IGNORE_CASE)
    override val creditOnlyKeywords = Regex("credited|received|deposited", RegexOption.IGNORE_CASE)
    override val otpKeywords =
        Regex(
            "\\botp\\b|one[ -]?time (?:password|code)|verification code|security code|auth(?:entication)? code|passcode|do not share|never share|valid for \\d+ (?:minute|min|minutes|mins)",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseInfoKeywords =
        Regex(
            "available balance|avl(?:\\.|\\s)?bal|a/c balance|account balance|balance is|ledger balance|min(?:imum)? due|total due|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|standing instruction|card ending|card blocked|card locked|card limit|credit limit|cash limit|cvv|\\bpin\\b|token(?:isation|ization)?|token generated|pre-?authorized payment plan|interest charge|interest rate",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseTransactionOutcomeKeywords =
        Regex(
            "declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited|could not be completed|was not completed",
            RegexOption.IGNORE_CASE,
        )
    override val approvalPromptKeywords =
        Regex(
            "if not you|if this wasn'?t you|approve|approval|authenticate|authorize|authorise|confirm this transaction|complete this transaction|to complete your transaction|to proceed",
            RegexOption.IGNORE_CASE,
        )

    override val categoryInferenceRules =
        listOf(
            "Food" to
                Regex(
                    "tim hortons|starbucks|mcdonald(?:['’]?s)?|restaurant|cafe|coffee|pizza|burger|dining|eatery|bakery|food|uber eats|skipthedishes|doordash|a\\&w|harvey",
                    RegexOption.IGNORE_CASE,
                ),
            "Groceries" to
                Regex(
                    "grocery|groceries|supermarket|loblaws|provigo|maxi|sobeys|safeway|freshco|food basics|no frills|metro|walmart|costco|whole foods|farmers",
                    RegexOption.IGNORE_CASE,
                ),
            "Transport" to
                Regex(
                    "uber|lyft|taxi|cab|transit|ttc|presto|bus|train|stm|fuel|gas station|petro|esso|shell|parking|toll|travel|aircanada|westjet",
                    RegexOption.IGNORE_CASE,
                ),
            "Rent" to Regex("\\brent\\b|landlord|lease|tenancy|apartment rent|house rent", RegexOption.IGNORE_CASE),
            "Utilities" to
                Regex(
                    "hydro|electricity|water bill|utility bill|gas bill|enbridge|broadband|internet bill|mobile bill|rogers|bell|telus|fido|koodo|freedom mobile",
                    RegexOption.IGNORE_CASE,
                ),
            "Entertainment" to
                Regex(
                    "netflix|spotify|prime video|crave|disney|movie|cinema|theatre|cineplex|gaming|playstation|xbox|steam",
                    RegexOption.IGNORE_CASE,
                ),
            "Health" to
                Regex(
                    "hospital|clinic|pharmacy|medical|medicine|drugstore|shoppers drug|rexall|jean coutu|lab|health|dental|dentist",
                    RegexOption.IGNORE_CASE,
                ),
        )

    override val paymentMethodHints =
        listOf(
            "Net Banking" to Regex("interac|e-?transfer", RegexOption.IGNORE_CASE),
            "Credit Card" to
                Regex(
                    "credit card|\\bamex\\b|american express",
                    RegexOption.IGNORE_CASE,
                ),
            "Debit Card" to
                Regex("\\b(?:debit card|debit purchase)\\b", RegexOption.IGNORE_CASE),
        )
}
