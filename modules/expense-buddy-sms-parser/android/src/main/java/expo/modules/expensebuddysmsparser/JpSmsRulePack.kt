package expo.modules.expensebuddysmsparser

/**
 * Japan rule pack. The most speculative pack: Japanese bank alert templates
 * vary widely and commonly mix Japanese prose with latin merchant names.
 * Patterns cover common phrasing (カード利用, 引き落とし/引落, 支払い) plus
 * English keywords that appear in bilingual alerts. Precision is prioritized
 * over recall; the review queue absorbs misses (ADR-010). Tune against real
 * samples post-release.
 */
object JpSmsRulePack : SmsRulePack {
    override val regionCode = "JP"
    override val localeTag = "ja-JP"
    override val currencyCode = "JPY"
    override val patternKeyPrefix = "japan"

    override val amountPattern =
        Regex("(?:(?:JPY)|[¥￥])\\s*([0-9][0-9,]*)|([0-9][0-9,]*)\\s*円", RegexOption.IGNORE_CASE)
    override val debitKeywords =
        Regex(
            "debited|spent|withdrawn|paid|purchase|txn|transaction|charged|sent|引き落とし|引落|引き出し|支払い|ご利用|利用金額|決済",
            RegexOption.IGNORE_CASE,
        )
    override val settledDebitKeywords =
        Regex(
            "debited|spent|withdrawn|paid|purchase|charged|sent|引き落とし|引落|引き出し|支払い|ご利用|決済",
            RegexOption.IGNORE_CASE,
        )
    override val creditOnlyKeywords =
        Regex("credited|received|deposited|入金|振込", RegexOption.IGNORE_CASE)
    override val otpKeywords =
        Regex(
            "\\botp\\b|one[ -]?time (?:password|code)|verification code|security code|auth(?:entication)? code|passcode|do not share|never share|認証コード|ワンタイム",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseInfoKeywords =
        Regex(
            "available balance|account balance|balance is|ledger balance|payment due|due date|statement generated|e-?statement|card ending|card blocked|card limit|credit limit|cvv|\\bpin\\b|残高|利用可能枠|締切日|お知らせ",
            RegexOption.IGNORE_CASE,
        )
    override val nonExpenseTransactionOutcomeKeywords =
        Regex(
            "declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited|取り消し|返金",
            RegexOption.IGNORE_CASE,
        )
    override val approvalPromptKeywords =
        Regex(
            "if not you|if this wasn'?t you|approve|approval|authenticate|authorize|authorise|confirm this transaction|to proceed|心当たり|ご確認",
            RegexOption.IGNORE_CASE,
        )

    override val merchantPatterns =
        listOf(
            Regex(
                "\\b(?:at|to|merchant)\\s+([A-Za-z0-9][\\w&\\-. ]{1,40}?)(?:\\s+(?:on|using|via|with|card)\\b|[.,!]|$)",
                RegexOption.IGNORE_CASE,
            ),
            Regex("(?:利用先|加盟店)[：:]?\\s*([\\w&\\-.]+)", RegexOption.IGNORE_CASE),
        )

    override val categoryInferenceRules =
        listOf(
            "Food" to
                Regex(
                    "mcdonald|starbucks|restaurant|cafe|coffee|pizza|burger|food|uber eats|demaecan|出前館|すき家|吉野家|松屋|セブンイレブン food",
                    RegexOption.IGNORE_CASE,
                ),
            "Groceries" to
                Regex("grocery|supermarket|aeon|ito yokado|life |gyomu|trials|ok store|kaldi|イオン|イトーヨーカドー|ライフ", RegexOption.IGNORE_CASE),
            "Transport" to
                Regex(
                    "uber|taxi|transit|bus|train|suica|pasmo|jr |metro|fuel|gasoline|parking|travel|ana |jal|日本航空|全日空",
                    RegexOption.IGNORE_CASE,
                ),
            "Rent" to Regex("賃料|家賃|landlord|lease|apartment rent|house rent", RegexOption.IGNORE_CASE),
            "Utilities" to
                Regex(
                    "electricity|utility bill|gas bill|tokyo gas|tepco|関西電力|東京電力|broadband|internet bill|mobile bill|docomo|au |softbank|rakuten mobile|nuro",
                    RegexOption.IGNORE_CASE,
                ),
            "Entertainment" to
                Regex(
                    "netflix|spotify|prime video|hulu|disney|movie|cinema|gaming|playstation|nintendo|xbox|steam",
                    RegexOption.IGNORE_CASE,
                ),
            "Health" to
                Regex(
                    "hospital|clinic|pharmacy|medical|medicine|drugstore|welcia|tsuruha|sundrug|lab|health|dental|dentist",
                    RegexOption.IGNORE_CASE,
                ),
        )

    override val paymentMethodHints = emptyList<Pair<String, Regex>>()
}
