package expo.modules.expensebuddysmsparser

import java.util.Locale

internal data class SmsMoney(
    val amount: Double,
    val currency: String,
)

/** Parse whole money tokens, then reject non-transaction amounts and ambiguity. */
internal object SmsAmountRules {
    private val prefix =
        Regex(
            "(?<![\\p{L}\\p{N}])((?:[A-Z]{3}\\s*\\$|INR|USD|GBP|EUR|CAD|AUD|JPY|RS\\.?|US\\$|CA\\$|C\\$|AU\\$|A\\$)|[₹$£€¥￥])\\s*([0-9][0-9,.]*)",
            RegexOption.IGNORE_CASE,
        )
    private val suffix = Regex("(?<![\\p{L}\\p{N},.])([0-9][0-9,.]*)\\s*(INR|USD|GBP|EUR|CAD|AUD|JPY|円)(?!\\p{L})", RegexOption.IGNORE_CASE)
    private val westernGrouping = Regex("(?:[0-9]+|[0-9]{1,3}(?:,[0-9]{3})+)")
    private val indianGrouping = Regex("[0-9]{1,2}(?:,[0-9]{2})*,[0-9]{3}")
    private val infoLabel =
        Regex(
            "(?:available balance|avl[. ]*bal|a/c balance|account balance|balance|bal|credit limit|available limit|total due|minimum due|cashback|残高|利用可能枠)\\s*(?:is|of|は|[:.=-])?\\s*$",
            RegexOption.IGNORE_CASE,
        )
    private val codes = setOf("INR", "USD", "GBP", "EUR", "CAD", "AUD", "JPY")

    private fun currency(
        token: String,
        pack: SmsRulePack,
    ): String? {
        val key = token.trim().uppercase(Locale.ROOT).replace(" ", "")
        return when {
            key in codes -> key
            key.removeSuffix("$") in codes -> key.removeSuffix("$")
            key in listOf("RS", "RS.", "₹") -> "INR"
            key == "US$" -> "USD"
            key in listOf("C$", "CA$") -> "CAD"
            key in listOf("A$", "AU$") -> "AUD"
            key == "£" -> "GBP"
            key == "€" -> "EUR"
            key in listOf("¥", "￥", "円") -> "JPY"
            key == "$" && pack.currencyCode in setOf("USD", "CAD", "AUD") -> pack.currencyCode
            else -> null
        }
    }

    fun extract(
        pack: SmsRulePack,
        text: String,
    ): SmsMoney? {
        data class Token(
            val range: IntRange,
            val currency: String,
            val number: String,
        )
        val prefixed = prefix.findAll(text).map { Token(it.range, it.groupValues[1], it.groupValues[2]) }.toList()
        val suffixed =
            suffix
                .findAll(text)
                .filter { match ->
                    // Do not rebind "INR 10000. INR 250" as the suffix token "10000. INR".
                    prefixed.none { it.range.first <= match.range.last && match.range.first <= it.range.last }
                }.map { Token(it.range, it.groupValues[2], it.groupValues[1]) }
        val tokens = (prefixed + suffixed).sortedBy { it.range.first }
        val amounts = mutableListOf<SmsMoney>()
        for (token in tokens) {
            val before = text.substring(0, token.range.first).takeLast(100)
            if (infoLabel.containsMatchIn(before)) continue
            if (text.getOrNull(token.range.last + 1)?.lowercaseChar() in 'a'..'z') return null
            val code = currency(token.currency, pack) ?: return null
            val number = token.number.removeSuffix(",").removeSuffix(".")
            val parts = number.split('.')
            if (parts.size > 2 || !westernGrouping.matches(parts[0]) && !(code == "INR" && indianGrouping.matches(parts[0]))) return null
            if (parts.size == 2 && (parts[1].isEmpty() || parts[1].length > if (code == "JPY") 0 else 2)) return null
            val decimal = number.replace(",", "").toBigDecimalOrNull() ?: return null
            val amount = decimal.toDouble()
            if (!amount.isFinite() || amount <= 0) return null
            if (java.math.BigDecimal
                    .valueOf(amount)
                    .compareTo(decimal) != 0
            ) {
                return null
            }
            amounts.add(SmsMoney(amount, code))
        }
        // Multiple transaction amounts need an explicit template, not first-match guessing.
        return amounts.distinct().singleOrNull()
    }
}
