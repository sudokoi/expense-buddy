package expo.modules.expensebuddysmsparser

/** Merchant evidence outranks prose; a specific phrase outranks a generic word. */
internal object SmsCategoryRules {
    fun infer(
        pack: SmsRulePack,
        body: String,
        merchant: String?,
    ): String {
        fun match(text: String): String? =
            pack.categoryInferenceRules
                .mapNotNull { (category, pattern) ->
                    pattern.tokenMatches(text).maxOfOrNull { it.value.trim().length }?.let { category to it }
                }.maxByOrNull { it.second }
                ?.first
        return merchant?.let(::match) ?: match(body) ?: "Other"
    }
}
