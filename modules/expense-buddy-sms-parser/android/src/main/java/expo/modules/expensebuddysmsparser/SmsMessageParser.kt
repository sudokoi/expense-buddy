package expo.modules.expensebuddysmsparser

import android.util.Log
import java.security.MessageDigest
import java.text.Normalizer
import java.time.Instant
import java.util.Locale

enum class SkipReason {
    EMPTY_BODY,
    OTP_MATCH,
    NEGATIVE_ALERT,
    NOT_DEBIT,
    AMOUNT_MISSING,
}

data class ParseResult(
    val parsed: SmsParsedMessage?,
    val skipReason: SkipReason?,
)

object SmsMessageParser {
    private val latinAccentMarksPattern = Regex("([a-zA-Z])[\\u0300-\\u036f\\ufe20-\\ufe2f]+")
    private val matchingWhitespace = Regex("[\\s\\p{Z}]+")
    private val invisibleSeparators = Regex("[\\u200b\\ufeff]")

    /**
     * Normalizes message text for pattern matching.
     *
     * NFKD folds fullwidth/halfwidth variants; combining marks are then
     * stripped only after Latin letters so accented Latin folds (café ->
     * cafe) while scripts that use combining marks semantically survive -
     * NFKD splits Japanese voiced kana (が -> か + U+3099), and NFC
     * re-composes them afterwards. Without the Latin guard, every dakuten
     * in CJK text would be destroyed and regional patterns could never
     * match (ADR-010).
     */
    private fun normalizeUnicode(text: String): String =
        try {
            val nfkd = Normalizer.normalize(text, Normalizer.Form.NFKD)
            val latinFolded = nfkd.replace(latinAccentMarksPattern, "$1")
            Normalizer.normalize(latinFolded, Normalizer.Form.NFC)
        } catch (_: Exception) {
            text
        }

    /**
     * Resolves the rule pack for a region code (ISO 3166-1 alpha-2).
     * Unknown or null regions fall back to India — the historical behavior —
     * so absence of a region argument can never change parsing outcomes.
     */
    fun resolveRulePack(regionCode: String?): SmsRulePack =
        when (regionCode?.uppercase(Locale.ROOT)) {
            CanadaSmsRulePack.regionCode -> CanadaSmsRulePack
            AustraliaSmsRulePack.regionCode -> AustraliaSmsRulePack
            UsSmsRulePack.regionCode -> UsSmsRulePack
            UkSmsRulePack.regionCode -> UkSmsRulePack
            JpSmsRulePack.regionCode -> JpSmsRulePack
            else -> IndiaSmsRulePack
        }

    fun parseRawMessage(
        sender: String,
        body: String,
        receivedAt: String,
    ): SmsParsedMessage? = parseRawMessageWithReason(sender, body, receivedAt).parsed

    fun parseRawMessageWithReason(
        sender: String,
        body: String,
        receivedAt: String,
        rulePack: SmsRulePack = resolveRulePack(null),
    ): ParseResult {
        // Matching normalization may evolve, but raw text and the historical
        // fingerprint normalization below must retain their identity contract.
        val matchingBody =
            normalizeUnicode(body)
                .replace(invisibleSeparators, "")
                .map { char -> if (char.isDigit()) Character.digit(char, 10).digitToChar() else char }
                .joinToString("")
                .replace(matchingWhitespace, " ")
                .trim()
        val normalizedBody = SmsTransactionRules.transactionText(matchingBody)
        if (normalizedBody.isEmpty()) {
            Log.d("SMS_PARSER", "skip reason=EMPTY_BODY sender=$sender")
            return ParseResult(null, SkipReason.EMPTY_BODY)
        }

        SmsTransactionRules.skipReason(rulePack, normalizedBody)?.let { return ParseResult(null, it) }

        val money = SmsAmountRules.extract(rulePack, normalizedBody)
        if (money == null) {
            Log.d("SMS_PARSER", "skip reason=AMOUNT_MISSING sender=$sender")
            return ParseResult(null, SkipReason.AMOUNT_MISSING)
        }
        val amount = money.amount
        val merchantName = SmsMerchantRules.extract(rulePack, normalizedBody)

        val messageId = "scan_${sha256("$sender|$body|$receivedAt")}"
        val rawMessage =
            SmsRawMessage(
                messageId = messageId,
                sender = sender,
                body = body,
                receivedAt = receivedAt,
            )
        val fingerprint = createFingerprint(sender, body, receivedAt, amount)
        val category = SmsCategoryRules.infer(rulePack, normalizedBody, merchantName)
        val paymentMethod = inferPaymentMethod(rulePack, normalizedBody)

        Log.d(
            "SMS_PARSER",
            "parsed sender=$sender amount=$amount merchant=$merchantName category=$category paymentMethod=$paymentMethod fingerprint=$fingerprint",
        )

        return ParseResult(
            SmsParsedMessage(
                fingerprint = fingerprint,
                sourceMessage = rawMessage,
                amount = amount,
                currency = money.currency,
                merchantName = merchantName,
                categorySuggestion = category,
                paymentMethodSuggestion = paymentMethod,
                noteSuggestion = merchantName?.let { "SMS import: $it" },
                transactionDate = receivedAt,
                matchedLocale = rulePack.localeTag,
                matchedPatternKey = "${rulePack.patternKeyPrefix}.generic.transaction",
            ),
            null,
        )
    }

    private fun inferPaymentMethod(
        rulePack: SmsRulePack,
        body: String,
    ): SmsPaymentMethod? =
        rulePack.paymentMethodHints
            .firstOrNull { (_, pattern) -> pattern.containsMatchIn(body) }
            ?.let { (type, _) -> SmsPaymentMethod(type = type) }

    private fun getTimeWindow(receivedAt: String): Long? {
        val timestamp =
            try {
                Instant.parse(receivedAt).toEpochMilli()
            } catch (_: Exception) {
                return null
            }

        val windowMs = 3 * 60 * 1000L
        return (timestamp / windowMs) * windowMs
    }

    private fun normalizeAmount(amount: Double?): String = amount?.let { String.format(Locale.ROOT, "%.2f", it) } ?: ""

    private fun sha256(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    fun createFingerprint(
        sender: String,
        body: String,
        receivedAt: String,
        amount: Double? = null,
    ): String {
        val normalizedSender = sender.replace(Regex("\\s+"), " ").trim().lowercase(Locale.ROOT)
        val normalizedBody =
            normalizeUnicode(body)
                .replace(Regex("\\s+"), " ")
                .trim()
                .lowercase(Locale.ROOT)
        val normalizedAmount = normalizeAmount(amount)
        val timeWindow = getTimeWindow(receivedAt)?.toString() ?: "no-window"
        val key = "$normalizedSender|$normalizedAmount|$timeWindow|$normalizedBody"
        return "sms_${sha256(key)}"
    }
}
