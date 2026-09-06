package expo.modules.expensebuddysmsparser

/** Evidence about transaction state is separate from amount/merchant extraction. */
internal object SmsTransactionRules {
    private val instruction =
        Regex(
            "\\b(?:never share|do not share|not you)\\b|\\bif (?:not (?:you|done by you)|this wasn'?t you|" +
                "(?:your|the) (?:payment|transaction) (?:failed|was declined))\\b|" +
                "\\b(?:please )?(?:contact|call) (?:your|the) bank\\b|\\bfor (?:assistance|help|refund enquiries|refund inquiries)\\b|^\\s*(?:call\\s+[0-9]|SMS BLOCK|to dispute call)",
            RegexOption.IGNORE_CASE,
        )
    private val notCompleted =
        Regex(
            "\\b(?:failed|declined|unsuccessful|reversed|reversal|refund|refunded|cancelled|canceled|pending)\\b|" +
                "\\b(?:will|would|shall|to) be (?:debited|charged|paid)\\b|\\b(?:scheduled|upcoming|due) (?:payment|debit)\\b|" +
                "\\b(?:collect|payment|money) request\\b|\\brequest (?:for|to pay)\\b|\\bnext purchase\\b|" +
                "\\b(?:approve|authori[sz]e|authenticate|confirm) (?:this |the |your )?(?:purchase|payment|transaction)\\b|" +
                "\\b(?:requires? (?:authentication|approval)|to complete (?:your |the )?transaction|" +
                "not (?:debited|charged|completed))\\b|" +
                "\\bpurchase limit\\b|\\bdid you (?:make|attempt)\\b|\\breply (?:yes|no)\\b|\\breceived (?:today )?for processing\\b|" +
                "\\b(?:can|could|may) (?:purchase|pay|spend)\\b|\\bawaiting (?:approval|confirmation|payment)\\b",
            RegexOption.IGNORE_CASE,
        )
    private val definiteDebit =
        Regex("\\b(?:debited|spent|withdrawn|paid|charged|sent|purchased)\\b|引き落とし|引落|引き出し|支払い|決済", RegexOption.IGNORE_CASE)
    private val completedPurchase =
        Regex("\\bmade\\b.{0,80}\\bpurchase\\b|\\bpurchase\\b.{0,80}\\b(?:completed|successful)\\b", RegexOption.IGNORE_CASE)
    private val completedRail =
        Regex(
            "\\b(?:payment|transaction|txn|debit)\\b.{0,80}\\b(?:successful|completed)\\b|\\bvia UPI\\b.{0,30}\\bref(?:erence)?\\b|\\bUPI/DR/[0-9]+/",
            RegexOption.IGNORE_CASE,
        )

    fun transactionText(body: String): String {
        val matching = body.toCharArray()
        for (clause in SmsEvidence.clauses(body)) {
            val start = instruction.find(clause.text)?.range?.first ?: continue
            for (index in (clause.range.first + start)..clause.range.last) matching[index] = ' '
        }
        return String(matching).trim()
    }

    private fun settled(
        pack: SmsRulePack,
        text: String,
    ): Boolean =
        pack.settledDebitKeywords.tokenMatches(text).any {
            !it.value.equals("purchase", ignoreCase = true) || completedPurchase.containsMatchIn(text)
        } ||
            completedRail.containsMatchIn(text)

    fun skipReason(
        pack: SmsRulePack,
        text: String,
        money: List<SmsMoneyEvidence>,
        template: SmsTemplateMatch? = null,
    ): SkipReason? {
        if (pack.otpKeywords.containsMatchIn(text)) return SkipReason.OTP_MATCH
        if (notCompleted.containsMatchIn(text) || pack.nonExpenseTransactionOutcomeKeywords.containsMatchIn(text)) {
            return SkipReason.NEGATIVE_ALERT
        }
        val settled = template != null || settled(pack, text)
        if (pack.creditOnlyKeywords.containsMatchIn(text) && !definiteDebit.containsMatchIn(text)) return SkipReason.NOT_DEBIT
        if (!settled && (pack.nonExpenseInfoKeywords.containsMatchIn(text) || pack.approvalPromptKeywords.containsMatchIn(text))) {
            return SkipReason.NEGATIVE_ALERT
        }
        if (!settled) return SkipReason.NOT_DEBIT
        var moneyIndex = 0
        var eventClauses = 0
        var linkedAmount = template != null && money.any { it.range.first == template.amountRange.first && !it.informational }
        for (clause in SmsEvidence.clauses(text)) {
            var hasAmount = false
            var hasPrincipal = false
            while (moneyIndex < money.size && money[moneyIndex].range.first <= clause.range.last) {
                if (!money[moneyIndex].informational && money[moneyIndex].range.first in clause.range) hasAmount = true
                if (money[moneyIndex].role == SmsMoneyRole.TRANSACTION && money[moneyIndex].range.first in clause.range) hasPrincipal = true
                moneyIndex++
            }
            if (pack.creditOnlyKeywords.containsMatchIn(clause.text) &&
                !definiteDebit.containsMatchIn(clause.text) &&
                hasAmount
            ) {
                return SkipReason.NOT_DEBIT
            }
            if (hasAmount && settled(pack, clause.text)) linkedAmount = true
            if (hasPrincipal && (settled(pack, clause.text) || template?.amountRange?.first in clause.range)) eventClauses++
        }
        if (eventClauses > 1) return SkipReason.NEGATIVE_ALERT
        if (money.any { !it.informational } && !linkedAmount) return SkipReason.NOT_DEBIT
        val summaryLabels = money.filter { it.role == SmsMoneyRole.TOTAL || it.role == SmsMoneyRole.BILLED }.mapNotNull { it.labelRange }
        val actions = definiteDebit.findAll(text).filter { action -> summaryLabels.none { action.range.first in it } }
        if (actions.count() > 1) return SkipReason.NEGATIVE_ALERT
        return null
    }
}
