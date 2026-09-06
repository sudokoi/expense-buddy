package expo.modules.expensebuddysmsparser

/** Ranges always refer to matching text, never the original SMS or fingerprint text. */
internal data class SmsMoneyEvidence(
    val range: IntRange,
    val money: SmsMoney?,
    val role: SmsMoneyRole,
    val labelRange: IntRange? = null,
) {
    val informational: Boolean get() = role == SmsMoneyRole.INFORMATION
}

internal enum class SmsMoneyRole { TRANSACTION, INFORMATION, BILLED, TOTAL, FEE, ESTIMATE }

internal data class SmsClause(
    val range: IntRange,
    val text: String,
)

internal data class SmsMerchantEvidence(
    val range: IntRange,
    val name: String,
)

internal object SmsEvidence {
    fun without(
        text: String,
        range: IntRange?,
    ): String {
        if (range == null) return text
        return text.replaceRange(range, " ".repeat(range.count()))
    }

    // A decimal point, Rs. abbreviation or merchant domain is not a sentence boundary.
    private val boundary = Regex("[!?。;]+\\s*|\\.\\s+(?=[\\p{L}₹$£€¥￥])")

    fun clauses(text: String): List<SmsClause> {
        val clauses = mutableListOf<SmsClause>()
        var start = 0
        for (match in boundary.findAll(text)) {
            if (match.range.first > start) clauses.add(SmsClause(start until match.range.first, text.substring(start, match.range.first)))
            start = match.range.last + 1
        }
        if (start < text.length) clauses.add(SmsClause(start until text.length, text.substring(start)))
        return clauses
    }
}
