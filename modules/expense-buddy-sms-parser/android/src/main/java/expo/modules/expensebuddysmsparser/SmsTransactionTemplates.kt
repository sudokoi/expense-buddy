package expo.modules.expensebuddysmsparser

internal data class SmsTemplateMatch(
    val ruleId: String,
    val amountRange: IntRange,
    val merchant: SmsMerchantEvidence?,
    val method: String? = null,
)

/** Templates establish relationships, never bypass shared outcome and money validation. */
internal object SmsTransactionTemplates {
    fun matches(
        pack: SmsRulePack,
        text: String,
    ): List<SmsTemplateMatch> = if (pack.regionCode == "IN") IndiaSmsTransactionTemplates.matches(text) else emptyList()
}
