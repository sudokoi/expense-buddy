package expo.modules.expensebuddysmsparser

/**
 * Australia rule pack. Conservative v1 patterns reconstructed from publicly
 * documented bank alert templates (CBA/NAB/Westpac/ANZ, PayID/Osko/BPAY).
 * Precision is prioritized over recall; the review queue absorbs misses
 * (ADR-010). Tune against real samples post-release.
 */
object AustraliaSmsRulePack : SmsRulePack {
    override val regionCode = "AU"
    override val localeTag = "en-AU"
    override val currencyCode = "AUD"
    override val patternKeyPrefix = "australia"

    override val amountPattern =
        Regex("(?:AUD|A\\$|\\$)\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
    override val debitKeywords =
        Regex(
            "debited|spent|withdrawn|paid|purchase|txn|transaction|charged|payment of|auto-debit|debit of|direct debit|sent|osko|payid",
            RegexOption.IGNORE_CASE,
        )
    override val settledDebitKeywords =
        Regex("debited|spent|withdrawn|paid|purchase|charged|sent", RegexOption.IGNORE_CASE)
    override val creditOnlyKeywords = Regex("credited|received|deposited", RegexOption.IGNORE_CASE)
    override val otpKeywords =
        Regex(
            "\\botp\\b|one[ -]?time (?:password|code)|verification code|security code|auth(?:entication)? code|passcode|do not share|never share|valid for \\d+ (?:minute|min|minutes|mins)",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseInfoKeywords =
        Regex(
            "available balance|avl(?:\\.|\\s)?bal|a/c balance|account balance|balance is|ledger balance|min(?:imum)? due|total due|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|standing instruction|card ending|card blocked|card locked|card limit|credit limit|cash limit|cvv|\\bpin\\b|token(?:isation|ization)?|token generated|interest charge|interest rate|paypass limit",
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

    override val merchantPatterns =
        listOf(
            Regex(
                "\\b(?:at|to|from|merchant)\\s+([A-Za-z0-9][\\w&\\-. ]{1,40}?)(?:\\s+(?:on|using|via|with|card|ending)\\b|[.,!]|$)",
                RegexOption.IGNORE_CASE,
            ),
            Regex("\\b(?:at|to)\\s+(\\w+(?:[&\\-]\\w+)?(?:\\s+\\w+(?:[&\\-]\\w+)?)?)", RegexOption.IGNORE_CASE),
        )

    override val categoryInferenceRules =
        listOf(
            "Food" to
                Regex(
                    "mcdonald|restaurant|cafe|coffee|pizza|burger|dining|eatery|bakery|food|uber eats|menulog|doordash|hungry jack|dominos|pizza hut|sushi",
                    RegexOption.IGNORE_CASE,
                ),
            "Groceries" to
                Regex(
                    "grocery|groceries|supermarket|woolworths|coles|aldi|iga|foodland|drakes|harris farm|costco|markets",
                    RegexOption.IGNORE_CASE,
                ),
            "Transport" to
                Regex(
                    "uber|ola|diditaxi|13cabs|taxi|cab|opal|myki|transit|metro|bus|train|tram|ferry|fuel|petrol|caltex|bp |shell|parking|toll|linkt|eastlink|travel|qantas|jetstar|virgin australia",
                    RegexOption.IGNORE_CASE,
                ),
            "Rent" to Regex("\\brent\\b|landlord|lease|tenancy|apartment rent|house rent", RegexOption.IGNORE_CASE),
            "Utilities" to
                Regex(
                    "electricity|water bill|utility bill|gas bill|origin energy|agl|energyaustralia|simply energy|broadband|internet bill|mobile bill|telstra|optus|vodafone|tpg|amaysim",
                    RegexOption.IGNORE_CASE,
                ),
            "Entertainment" to
                Regex(
                    "netflix|spotify|prime video|stan|binge|disney|movie|cinema|theatre|event cinemas|hoys|gaming|playstation|xbox|steam",
                    RegexOption.IGNORE_CASE,
                ),
            "Health" to
                Regex(
                    "hospital|clinic|pharmacy|medical|medicine|chemist|priceline|lab|health|dental|dentist|medicare",
                    RegexOption.IGNORE_CASE,
                ),
        )

    override val paymentMethodHints =
        listOf(
            "Net Banking" to Regex("\\bpayid\\b|\\bosko\\b|\\bbpay\\b", RegexOption.IGNORE_CASE),
            "Credit Card" to
                Regex(
                    "credit card|credit a/c|credit acct|\\bamex\\b|american express|\\bvisa\\b|master\\s?card|\\bmastercard\\b",
                    RegexOption.IGNORE_CASE,
                ),
            "Debit Card" to
                Regex("debit card|debit a/c|debited from a/c|debited from acct|debit purchase|eftpos", RegexOption.IGNORE_CASE),
        )
}
