package expo.modules.expensebuddysmsparser

/**
 * United States rule pack. Conservative v1 patterns reconstructed from
 * publicly documented bank/card alert templates (Chase/Citi/Amex-style
 * "purchase at" alerts, Zelle payments). Precision is prioritized over
 * recall; the review queue absorbs misses (ADR-010). Tune against real
 * samples post-release.
 */
object UsSmsRulePack : SmsRulePack {
    override val regionCode = "US"
    override val localeTag = "en-US"
    override val currencyCode = "USD"
    override val patternKeyPrefix = "usa"

    override val amountPattern =
        Regex("(?:USD|US\\$|\\$)\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
    override val debitKeywords =
        Regex(
            "debited|spent|withdrawn|paid|purchase|txn|transaction|charged|payment of|auto-debit|debit of|sent|zelle",
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
            "available balance|avl(?:\\.|\\s)?bal|a/c balance|account balance|balance is|ledger balance|min(?:imum)? payment|total balance|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|standing instruction|card ending|card blocked|card locked|card limit|credit limit|cash limit|cvv|\\bpin\\b|token(?:isation|ization)?|token generated|interest charge|apr\\b|credit score|fraud alert",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseTransactionOutcomeKeywords =
        Regex(
            "declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited|could not be completed|was not completed",
            RegexOption.IGNORE_CASE,
        )
    override val approvalPromptKeywords =
        Regex(
            "if not you|if this wasn'?t you|didn'?t you|approve|approval|authenticate|authorize|authorise|confirm this transaction|complete this transaction|to complete your transaction|to proceed|dispute",
            RegexOption.IGNORE_CASE,
        )

    override val merchantPatterns =
        listOf(
            Regex(
                "\\b(?:at|to|from|merchant)\\s+([A-Za-z0-9][\\w&\\-.#* ]{1,40}?)(?:\\s+(?:on|using|via|with|card|ending)\\b|[.,!]|$)",
                RegexOption.IGNORE_CASE,
            ),
            Regex("\\b(?:at|to)\\s+(\\w+(?:[&\\-]\\w+)?(?:\\s+\\w+(?:[&\\-]\\w+)?)?)", RegexOption.IGNORE_CASE),
        )

    override val categoryInferenceRules =
        listOf(
            "Food" to
                Regex(
                    "mcdonald|starbucks|restaurant|cafe|coffee|pizza|burger|dining|eatery|bakery|food|uber eats|doordash|grubhub|chipotle|subway|dominos",
                    RegexOption.IGNORE_CASE,
                ),
            "Groceries" to
                Regex(
                    "grocery|groceries|supermarket|kroger|safeway|aldi|trader joe|whole foods|costco|walmart|publix|heb|meijer",
                    RegexOption.IGNORE_CASE,
                ),
            "Transport" to
                Regex(
                    "uber|lyft|taxi|cab|transit|metro|mta|bus|train|fuel|gas station|chevron|shell|exxon|parking|toll|travel|airlines|southwest|delta|united air",
                    RegexOption.IGNORE_CASE,
                ),
            "Rent" to Regex("\\brent\\b|landlord|lease|tenancy|apartment rent|house rent", RegexOption.IGNORE_CASE),
            "Utilities" to
                Regex(
                    "electricity|water bill|utility bill|gas bill|coned|pg&e|duke energy|broadband|internet bill|mobile bill|comcast|xfinity|verizon|at&t|t-mobile|mint mobile",
                    RegexOption.IGNORE_CASE,
                ),
            "Entertainment" to
                Regex(
                    "netflix|spotify|prime video|hulu|disney|max |movie|cinema|theater|amc|gaming|playstation|xbox|steam",
                    RegexOption.IGNORE_CASE,
                ),
            "Health" to
                Regex(
                    "hospital|clinic|pharmacy|medical|medicine|drugstore|cvs|walgreens|rite aid|lab|health|dental|dentist",
                    RegexOption.IGNORE_CASE,
                ),
        )

    override val paymentMethodHints =
        listOf(
            "Net Banking" to Regex("\\bzelle\\b", RegexOption.IGNORE_CASE),
            "Credit Card" to
                Regex(
                    "credit card|credit a/c|credit acct|\\bamex\\b|american express|\\bvisa\\b|master\\s?card|\\bmastercard\\b|discover",
                    RegexOption.IGNORE_CASE,
                ),
            "Debit Card" to
                Regex("debit card|debit a/c|debited from a/c|debited from acct|debit purchase", RegexOption.IGNORE_CASE),
        )
}
