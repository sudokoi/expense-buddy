package expo.modules.expensebuddysmsparser

/** Evidence about transaction state is separate from amount/merchant extraction. */
internal object SmsTransactionRules {
    private val safetyFooter =
        Regex(
            "\\b(?:never share|do not share)\\b[^.!?]*(?:[.!?]|$)|\\bif (?:not you|this wasn'?t you)\\b.*$|\\b(?:please )?(?:contact|call) (?:your|the) bank\\b.*$",
            RegexOption.IGNORE_CASE,
        )
    private val notCompleted =
        Regex(
            "\\b(?:failed|declined|unsuccessful|reversed|reversal|refunded|cancelled|canceled|pending)\\b|" +
                "\\b(?:will|would|shall) be (?:debited|charged|paid)\\b|\\b(?:scheduled|upcoming|due) (?:payment|debit)\\b|" +
                "\\b(?:collect|payment|money) request\\b|\\brequest (?:for|to pay)\\b|\\bnext purchase\\b|" +
                "\\b(?:approve|authori[sz]e|authenticate|confirm) (?:this |the |your )?(?:purchase|payment|transaction)\\b|" +
                "\\b(?:requires? (?:authentication|approval)|to complete (?:your |the )?transaction|" +
                "not (?:debited|charged|completed))\\b|" +
                "\\bpurchase limit\\b|\\bdid you (?:make|attempt)\\b|\\breply (?:yes|no)\\b",
            RegexOption.IGNORE_CASE,
        )
    private val definiteDebit = Regex("\\b(?:debited|spent|withdrawn|paid|charged|sent)\\b|引き落とし|引落|引き出し|支払い|決済", RegexOption.IGNORE_CASE)
    private val completedRail =
        Regex(
            "\\b(?:payment|transaction|txn|debit)\\b.{0,80}\\b(?:successful|completed)\\b|\\bvia UPI\\b.{0,30}\\bref(?:erence)?\\b|\\bUPI/DR/[0-9]+/",
            RegexOption.IGNORE_CASE,
        )

    fun transactionText(body: String): String = body.replace(safetyFooter, " ").trim()

    fun skipReason(
        pack: SmsRulePack,
        text: String,
    ): SkipReason? {
        if (pack.otpKeywords.containsMatchIn(text)) return SkipReason.OTP_MATCH
        if (notCompleted.containsMatchIn(text) || pack.nonExpenseTransactionOutcomeKeywords.containsMatchIn(text)) {
            return SkipReason.NEGATIVE_ALERT
        }
        val settled = pack.settledDebitKeywords.tokenMatches(text).any() || completedRail.containsMatchIn(text)
        if (pack.creditOnlyKeywords.containsMatchIn(text) && !definiteDebit.containsMatchIn(text)) return SkipReason.NOT_DEBIT
        if (!settled && (pack.nonExpenseInfoKeywords.containsMatchIn(text) || pack.approvalPromptKeywords.containsMatchIn(text))) {
            return SkipReason.NEGATIVE_ALERT
        }
        if (!settled) return SkipReason.NOT_DEBIT
        return null
    }
}
