package expo.modules.expensebuddysmsparser

/**
 * India vocabulary: English transaction alerts and a limited set of explicit
 * Hindi debit/outcome phrases. Shared rules own money/merchant extraction;
 * category suggestions do not participate in message fingerprints.
 */
object IndiaSmsRulePack : SmsRulePack {
    override val regionCode = "IN"
    override val localeTag = "en-IN"
    override val currencyCode = "INR"
    override val patternKeyPrefix = "india"

    override val settledDebitKeywords =
        Regex("debited|spent|withdrawn|paid|purchase(?:d)?|charged|डेबिट (?:हुए|हुआ)|काटे गए|भुगतान किया", RegexOption.IGNORE_CASE)
    override val creditOnlyKeywords = Regex("credited|received|जमा हुए|क्रेडिट हुए", RegexOption.IGNORE_CASE)
    override val otpKeywords =
        Regex(
            "\\botp\\b|one[ -]?time password|verification code|security code|auth(?:entication)? code|passcode|do not share|never share|valid for \\d+ (?:minute|min|minutes|mins)",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseInfoKeywords =
        Regex(
            "available balance|avl(?:\\.|\\s)?bal|a/c balance|account balance|balance is|ledger balance|min(?:imum)? due|total due|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|auto-debit mandate|standing instruction|card ending|card blocked|card hotlisted|card limit|credit limit|cash limit|cvv|pin|mpin|tpin|token(?:isation|ization)?|token generated|registered for e-?com|e-?commerce|online usage enabled|international usage enabled|contactless usage enabled",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseTransactionOutcomeKeywords =
        Regex(
            "declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited|डेबिट (?:होंगे|होगा)|भुगतान (?:विफल|असफल)|राशि वापस",
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
                    "swiggy|zomato|restaurant|restro|cafe|coffee|pizza|burger|biryani|dining|eatery|bakery|food|uber[ *]?eats",
                    RegexOption.IGNORE_CASE,
                ),
            "Groceries" to
                Regex(
                    "grocery|groceries|supermarket|hypermarket|bigbasket|blinkit|zepto|instamart|fresh|dmart|reliance fresh",
                    RegexOption.IGNORE_CASE,
                ),
            "Transport" to
                Regex(
                    "uber|ola|rapido|metro|rail|train|irctc|bmtcbus[a-z0-9]*|bus|cab|taxi|petrol|diesel|fuel|parking|toll|travel",
                    RegexOption.IGNORE_CASE,
                ),
            "Rent" to Regex("\\brent\\b|landlord|lease|tenancy|apartment rent|house rent", RegexOption.IGNORE_CASE),
            "Utilities" to
                Regex(
                    "electricity|water bill|utility bill|gas bill|broadband|wifi|internet bill|mobile bill|recharge|airtel|jio|vi\\b|bsnl",
                    RegexOption.IGNORE_CASE,
                ),
            "Entertainment" to
                Regex(
                    "netflix|spotify|prime video|hotstar|bookmyshow|movie|cinema|theatre|gaming|playstation|xbox",
                    RegexOption.IGNORE_CASE,
                ),
            "Health" to
                Regex("hospital|clinic|pharmacy|medical|medicine|diagnostic|lab|apollo|practo|medplus|health", RegexOption.IGNORE_CASE),
        )

    override val paymentMethodHints =
        listOf(
            "UPI" to Regex("\\bupi\\b", RegexOption.IGNORE_CASE),
            "Net Banking" to Regex("\\b(?:neft|imps|rtgs|net banking|internet banking)\\b", RegexOption.IGNORE_CASE),
            "Credit Card" to
                Regex("credit card|\\bamex\\b|american express", RegexOption.IGNORE_CASE),
            "Debit Card" to Regex("\\bdebit card\\b", RegexOption.IGNORE_CASE),
        )
}
