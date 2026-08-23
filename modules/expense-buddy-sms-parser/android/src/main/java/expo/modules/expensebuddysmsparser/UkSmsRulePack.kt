package expo.modules.expensebuddysmsparser

/**
 * United Kingdom rule pack. Conservative v1 patterns reconstructed from
 * publicly documented bank alert templates (Monzo/Barclays/Lloyds/Halifax
 * "Debited" alerts, Faster Payments). Precision is prioritized over recall;
 * the review queue absorbs misses (ADR-010). Tune against real samples
 * post-release.
 */
object UkSmsRulePack : SmsRulePack {
    override val regionCode = "GB"
    override val localeTag = "en-GB"
    override val currencyCode = "GBP"
    override val patternKeyPrefix = "uk"

    override val amountPattern =
        Regex("(?:GBP|£)\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
    override val debitKeywords =
        Regex(
            "debited|spent|withdrawn|paid|purchase|txn|transaction|charged|payment of|auto-debit|debit of|sent|faster payment|standing order|direct debit",
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
            "available balance|avl(?:\\.|\\s)?bal|a/c balance|account balance|balance is|ledger balance|min(?:imum)? payment|total due|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|standing instruction|card ending|card blocked|card locked|card limit|credit limit|cash limit|cvv|\\bpin\\b|token(?:isation|ization)?|token generated|interest charge|overdraft",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseTransactionOutcomeKeywords =
        Regex(
            "declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited|could not be completed|was not completed",
            RegexOption.IGNORE_CASE,
        )
    override val approvalPromptKeywords =
        Regex(
            "if not you|if this wasn'?t you|approve|approval|authenticate|authorize|authorise|confirm this transaction|complete this transaction|to complete your transaction|to proceed|dispute",
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
                    "greggs|pret|mcdonald|nando|restaurant|cafe|coffee|pizza|burger|dining|eatery|bakery|food|uber eats|just eat|deliveroo|subway|dominos|wetherspoon|pub",
                    RegexOption.IGNORE_CASE,
                ),
            "Groceries" to
                Regex(
                    "grocery|groceries|supermarket|tesco|sainsbury|asda|morrisons|aldi|lidl|waitrose|iceland|co-op|coop|marks & spencer|ms food",
                    RegexOption.IGNORE_CASE,
                ),
            "Transport" to
                Regex(
                    "uber|bolt|taxi|cab|tfl|oyster|contactless transit|transit|metro|bus|train|national rail|fuel|petrol|bp |shell|esso|parking|toll|travel|ba |british airways|easyjet|ryanair|virgin trains|avanti",
                    RegexOption.IGNORE_CASE,
                ),
            "Rent" to Regex("\\brent\\b|landlord|lease|tenancy|apartment rent|house rent|council tax", RegexOption.IGNORE_CASE),
            "Utilities" to
                Regex(
                    "electricity|water bill|utility bill|gas bill|british gas|octopus energy|edf|eon|ovo energy|thames water|broadband|internet bill|mobile bill|bt |virgin media|sky |vodafone|ee |o2 |giffgaff|council",
                    RegexOption.IGNORE_CASE,
                ),
            "Entertainment" to
                Regex(
                    "netflix|spotify|prime video|now tv|disney|movie|cinema|theatre|odeon|vue |cineworld|gaming|playstation|xbox|steam|national lottery",
                    RegexOption.IGNORE_CASE,
                ),
            "Health" to
                Regex(
                    "hospital|clinic|pharmacy|medical|medicine|chemist|boots|superdrug|lab|health|dental|dentist",
                    RegexOption.IGNORE_CASE,
                ),
        )

    override val paymentMethodHints =
        listOf(
            "Net Banking" to Regex("faster payment|fps\\b", RegexOption.IGNORE_CASE),
            "Credit Card" to
                Regex(
                    "credit card|credit a/c|credit acct|\\bamex\\b|american express|\\bvisa\\b|master\\s?card|\\bmastercard\\b",
                    RegexOption.IGNORE_CASE,
                ),
            "Debit Card" to
                Regex("debit card|debit a/c|debited from a/c|debited from acct|debit purchase", RegexOption.IGNORE_CASE),
        )
}
