package expo.modules.expensebuddysmsparser

/** Independently written structures; example attribution is in docs/sms-regex-parser.md. */
internal object IndiaSmsTransactionTemplates {
    private const val MONEY = "(?<money>(?:[A-Z]{3}|Rs\\.?|[₹$£€¥￥])\\s*[0-9][0-9,.]*)"
    private const val MERCHANT = "(?<merchant>[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N} &'’@_./*()-]{0,100}?)"

    private data class Template(
        val id: String,
        val pattern: Regex,
        val method: String? = null,
    )

    private val templates =
        listOf(
            Template("hdfc.sent", Regex("^Sent $MONEY From HDFC Bank A/C [*Xx0-9]+ To $MERCHANT On \\d", RegexOption.IGNORE_CASE)),
            Template(
                "hdfc.netbanking",
                Regex("Payment Successful!\\s*$MONEY from A/c [*Xx0-9]+ to $MERCHANT via HDFC Bank NetBanking", RegexOption.IGNORE_CASE),
                "Net Banking",
            ),
            Template(
                "icici.card",
                Regex(
                    "$MONEY spent using ICICI Bank Card [*Xx0-9]+ on [0-9A-Za-z/-]{3,24} on $MERCHANT(?=\\. |\\s+Avl|$)",
                    RegexOption.IGNORE_CASE,
                ),
            ),
            Template(
                "icici.upi",
                Regex(
                    "ICICI Bank Acct [*Xx0-9]+ debited for $MONEY on [0-9A-Za-z/-]{3,24};\\s*$MERCHANT credited\\.\\s*UPI:",
                    RegexOption.IGNORE_CASE,
                ),
                "UPI",
            ),
            Template(
                "sbi.card.done",
                Regex("transaction number \\d+ for $MONEY by SBI Debit Card [*Xx0-9]+ done at $MERCHANT on \\d", RegexOption.IGNORE_CASE),
                "Debit Card",
            ),
        )

    fun matches(text: String): List<SmsTemplateMatch> =
        templates.flatMap { template ->
            template.pattern
                .findAll(text)
                .map { result ->
                    val amount = requireNotNull(result.groups["money"])
                    val merchant = result.groups["merchant"]?.let { SmsMerchantEvidence(it.range, it.value.trim()) }
                    SmsTemplateMatch(template.id, amount.range, merchant, template.method)
                }.toList()
        }
}
