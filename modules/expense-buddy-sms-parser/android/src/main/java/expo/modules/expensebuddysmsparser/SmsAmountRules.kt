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
            "(?:available balance|avl[. ]*(?:bal|limit)|a/c balance|account balance|balance|bal|credit limit|available limit|total due|minimum due|cashback|残高|利用可能枠)\\s*(?:is|of|は|[:.=-])?\\s*$",
            RegexOption.IGNORE_CASE,
        )
    private val codes = setOf("INR", "USD", "GBP", "EUR", "CAD", "AUD", "JPY")
    private val billedLabel =
        Regex("(?:amount billed(?: to (?:your )?card)?|billed amount|card charged)\\s*[:=-]?\\s*$", RegexOption.IGNORE_CASE)
    private val totalLabel = Regex("total (?:amount )?(?:debited|charged|debit)\\s*[:=-]?\\s*$", RegexOption.IGNORE_CASE)
    private val feeLabel = Regex("\\b(?:fee|fees|charges)\\s*[:=-]?\\s*$|手数料\\s*[:：]?\\s*$", RegexOption.IGNORE_CASE)
    private val estimateLabel = Regex("\\b(?:estimated?|approximate|indicative)\\b[^.!?;]{0,60}$", RegexOption.IGNORE_CASE)

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

    fun evidence(
        pack: SmsRulePack,
        text: String,
    ): List<SmsMoneyEvidence> {
        data class Token(
            val range: IntRange,
            val currency: String,
            val number: String,
        )
        val prefixed = prefix.findAll(text).map { Token(it.range, it.groupValues[1], it.groupValues[2]) }.toList()
        var prefixIndex = 0
        val suffixed =
            suffix
                .findAll(text)
                .filter { match ->
                    // Do not rebind "INR 10000. INR 250" as the suffix token "10000. INR".
                    while (prefixIndex < prefixed.size && prefixed[prefixIndex].range.last < match.range.first) prefixIndex++
                    prefixIndex == prefixed.size || prefixed[prefixIndex].range.first > match.range.last
                }.map { Token(it.range, it.groupValues[2], it.groupValues[1]) }
                .toList()
        val tokens = (prefixed + suffixed).sortedBy { it.range.first }
        return tokens.map { token ->
            val before = text.substring((token.range.first - 100).coerceAtLeast(0), token.range.first)
            val money =
                if (text.getOrNull(token.range.last + 1)?.lowercaseChar() in 'a'..'z') {
                    null
                } else {
                    parseMoney(pack, token.currency, token.number)
                }
            val labelled =
                listOf(
                    SmsMoneyRole.INFORMATION to infoLabel,
                    SmsMoneyRole.ESTIMATE to estimateLabel,
                    SmsMoneyRole.TOTAL to totalLabel,
                    SmsMoneyRole.BILLED to billedLabel,
                    SmsMoneyRole.FEE to feeLabel,
                ).firstNotNullOfOrNull { (role, pattern) -> pattern.find(before)?.let { role to it.range } }
            val labelRange = labelled?.second?.let { ((token.range.first - before.length) + it.first) until token.range.first }
            SmsMoneyEvidence(token.range, money, labelled?.first ?: SmsMoneyRole.TRANSACTION, labelRange)
        }
    }

    private fun parseMoney(
        pack: SmsRulePack,
        currencyToken: String,
        numberToken: String,
    ): SmsMoney? {
        val code = currency(currencyToken, pack) ?: return null
        val number = numberToken.removeSuffix(",").removeSuffix(".")
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
        return SmsMoney(amount, code)
    }

    fun extract(evidence: List<SmsMoneyEvidence>): SmsMoney? {
        val transaction = evidence.filterNot { it.informational }
        val amounts = transaction.map { it.money }
        if (amounts.any { it == null }) return null
        if (transaction.any { it.role == SmsMoneyRole.ESTIMATE }) return null
        val totals = transaction.filter { it.role == SmsMoneyRole.TOTAL }.mapNotNull { it.money }.distinct()
        if (totals.isNotEmpty()) {
            val total = totals.singleOrNull() ?: return null
            if (transaction.any { it.role == SmsMoneyRole.BILLED || it.money?.currency != total.currency }) return null
            val principal = transaction.filter { it.role == SmsMoneyRole.TRANSACTION }.mapNotNull { it.money }.distinct()
            if (principal.size > 1 || principal.any { it.amount > total.amount }) return null
            return total
        }
        if (transaction.any { it.role == SmsMoneyRole.FEE }) return null
        val billed = transaction.filter { it.role == SmsMoneyRole.BILLED }.mapNotNull { it.money }.distinct()
        if (billed.isNotEmpty()) {
            val selected = billed.singleOrNull() ?: return null
            val purchase = transaction.filter { it.role == SmsMoneyRole.TRANSACTION }.mapNotNull { it.money }.distinct()
            if (purchase.size > 1 || purchase.any { it.currency == selected.currency && it != selected }) return null
            return selected
        }
        return amounts.distinct().singleOrNull()
    }
}
