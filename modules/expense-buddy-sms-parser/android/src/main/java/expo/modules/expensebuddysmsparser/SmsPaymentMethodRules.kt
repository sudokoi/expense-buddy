package expo.modules.expensebuddysmsparser

/** Native extraction supplies payer facts; JS may enrich them using the user's saved instruments. */
internal object SmsPaymentMethodRules {
    private val recipientInstrument =
        Regex(
            "\\b(?:to|for|recipient|beneficiary)\\s+(?:(?:your|the|a)\\s+)?(?:credit card|debit card|card|a/c|acct|account)\\b[^.;!?]{0,50}?(?=\\s+(?:via|using|by|from)\\b|[.;!?]|$)",
            RegexOption.IGNORE_CASE,
        )
    private val card =
        Regex("(?:\\bcard\\b|カード)\\s*(?:(?:ending|ends)(?: with| in)?\\s*|末尾\\s*)?[*xX]*(\\d{4})(?!\\d)", RegexOption.IGNORE_CASE)
    private val account =
        Regex(
            "(?:\\ba/c\\b|\\bacct\\b|\\baccount\\b|口座)\\s*(?:(?:no\\.?|number)\\s*)?[:#-]?\\s*[*xX]*(\\d{3,4})(?!\\d)",
            RegexOption.IGNORE_CASE,
        )

    fun infer(
        pack: SmsRulePack,
        text: String,
        templateMethod: String?,
    ): SmsPaymentMethod? {
        val payerText = text.replace(recipientInstrument) { " ".repeat(it.value.length) }
        val type = templateMethod ?: pack.paymentMethodHints.firstOrNull { it.second.containsMatchIn(payerText) }?.first ?: return null
        val identifier =
            when (type) {
                "Credit Card", "Debit Card" ->
                    card
                        .findAll(payerText)
                        .map { it.groupValues[1] }
                        .distinct()
                        .toList()
                        .singleOrNull()
                "UPI" ->
                    account
                        .findAll(payerText)
                        .map { it.groupValues[1].takeLast(3) }
                        .distinct()
                        .toList()
                        .singleOrNull()
                else -> null
            }
        return SmsPaymentMethod(type, identifier)
    }
}
