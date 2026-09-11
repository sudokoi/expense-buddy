package expo.modules.expensebuddysmsparser

internal object SmsMerchantRules {
    private val upi = Regex("\\bUPI/(?:DR|DEBIT)/[^/\\s]+/([^/\\r\\n]{1,100})", RegexOption.IGNORE_CASE)

    // Compact P2M merchant field, bounded by another field, sentence, end of text,
    // or a masked security instruction. Do not consume trailing bank/support prose.
    // The multi-space boundary depends on transactionText retaining masked spans
    // as spaces after matching whitespace has already been collapsed.
    private val upiP2m =
        Regex(
            "\\bUPI/P2M/\\d+/([\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}&'’@_.#*()-]{0,99})(?=/|\\s{2,}|\\s*$|[.!?;](?:\\s|$))",
            RegexOption.IGNORE_CASE,
        )
    private val english =
        Regex(
            "\\b(?!to be (?:debited|charged|paid)\\b)(?:at|to|towards|merchant)[: ]+" +
                "([\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N}&'’@_./#*() -]{0,119}?)(?=\\s+(?:on|using|via|with|by|for|ref|reference|card|ending|avl|available|balance|if|not|was|is|paid|debited|spent|received|credited|completed|successfully|failed|declined|refunded|reversed|pending|to complete)\\b|\\s+and\\s+(?:[A-Z]{3}\\s*\\d|[₹$£€¥￥])|[.!?](?:\\s|$)|[,;\\r\\n]|$)",
            RegexOption.IGNORE_CASE,
        )
    private val japanese = Regex("(?:利用先|加盟店|利用店名)[：:]?\\s*(.{1,100}?)(?=\\s*(?:利用日|ご利用|金額|利用金額)|[。;\\r\\n]|$)")
    private val nonMerchant =
        Regex("^(?:your|the|my)$|^(?:(?:your|the|my)\\s+)?(?:a/c|account|acct|card|bank|complete|proceed)\\b", RegexOption.IGNORE_CASE)
    private val whitespace = Regex("\\s+")

    fun evidence(
        pack: SmsRulePack,
        body: String,
    ): SmsMerchantEvidence? {
        val patterns =
            when (pack.regionCode) {
                "IN" -> listOf(upi, upiP2m, english)
                "JP" -> listOf(japanese, english)
                else -> listOf(english)
            }
        for (pattern in patterns) {
            for (match in pattern.findAll(body)) {
                val merchant =
                    match.groupValues[1]
                        .replace(whitespace, " ")
                        .trim()
                        .trimEnd('.', ',')
                if (merchant.any(Char::isLetter) && !nonMerchant.containsMatchIn(merchant)) {
                    return SmsMerchantEvidence(requireNotNull(match.groups[1]).range, merchant)
                }
            }
        }
        return null
    }
}
