package expo.modules.expensebuddybackgroundsms

import android.telephony.SmsMessage
import expo.modules.expensebuddylogger.LoggerApi
import java.security.MessageDigest
import java.text.Normalizer
import java.time.Instant
import java.util.Locale

private val amountPattern = Regex("(?:INR|RS\\.?|₹)\\s*([0-9][0-9,]*(?:\\.\\d{1,2})?)", RegexOption.IGNORE_CASE)
private val debitKeywords = Regex("debited|spent|withdrawn|paid|purchase|txn|transaction|upi", RegexOption.IGNORE_CASE)
private val settledDebitKeywords = Regex("debited|spent|withdrawn|paid|purchase", RegexOption.IGNORE_CASE)
private val creditOnlyKeywords = Regex("credited|received", RegexOption.IGNORE_CASE)
private val otpKeywords =
    Regex(
        "\\botp\\b|one[ -]?time password|verification code|security code|auth(?:entication)? code|passcode|do not share|never share|valid for \\d+ (?:minute|min|minutes|mins)",
        RegexOption.IGNORE_CASE,
    )
private val nonExpenseInfoKeywords =
    Regex(
        "available balance|avl(?:\\.|\\s)?bal|a/c balance|account balance|balance is|ledger balance|min(?:imum)? due|total due|payment due|due date|bill(?:ing)? statement|statement generated|statement ready|e-?statement|autopay|auto-debit mandate|standing instruction|card ending|card blocked|card hotlisted|card limit|credit limit|cash limit|cvv|pin|mpin|tpin|token(?:isation|ization)?|token generated|registered for e-?com|e-?commerce|online usage enabled|international usage enabled|contactless usage enabled",
        RegexOption.IGNORE_CASE,
    )
private val nonExpenseTransactionOutcomeKeywords =
    Regex(
        "declined due to|was declined|failed due to|unsuccessful|reversed|reversal|refund initiated|chargeback|no amount debited",
        RegexOption.IGNORE_CASE,
    )
private val approvalPromptKeywords =
    Regex(
        "if not you|if this wasn'?t you|approve|approval|authenticate|authorize|authorise|confirm this transaction|complete this transaction|to complete your transaction|to proceed",
        RegexOption.IGNORE_CASE,
    )
private val merchantPattern = Regex("\\b(?:at|to|merchant)\\s+([A-Za-z0-9&._\\-/ ]{2,40})", RegexOption.IGNORE_CASE)

private val categoryInferenceRules =
    listOf(
        "Food" to
            Regex("swiggy|zomato|restaurant|restro|cafe|coffee|pizza|burger|biryani|dining|eatery|bakery|food", RegexOption.IGNORE_CASE),
        "Transport" to
            Regex("uber|ola|rapido|metro|rail|train|irctc|bus|cab|taxi|petrol|diesel|fuel|parking|toll|travel", RegexOption.IGNORE_CASE),
        "Groceries" to
            Regex(
                "grocery|groceries|supermarket|hypermarket|bigbasket|blinkit|zepto|instamart|fresh|dmart|reliance fresh",
                RegexOption.IGNORE_CASE,
            ),
        "Rent" to Regex("\\brent\\b|landlord|lease|tenancy|apartment rent|house rent", RegexOption.IGNORE_CASE),
        "Utilities" to
            Regex(
                "electricity|water bill|utility bill|gas bill|broadband|wifi|internet bill|mobile bill|recharge|airtel|jio|vi\\b|bsnl",
                RegexOption.IGNORE_CASE,
            ),
        "Entertainment" to
            Regex("netflix|spotify|prime video|hotstar|bookmyshow|movie|cinema|theatre|gaming|playstation|xbox", RegexOption.IGNORE_CASE),
        "Health" to Regex("hospital|clinic|pharmacy|medical|medicine|diagnostic|lab|apollo|practo|medplus|health", RegexOption.IGNORE_CASE),
    )

private val upiHintPattern = Regex("\\bupi\\b", RegexOption.IGNORE_CASE)
private val creditCardHintPattern = Regex("credit card|credit a/c|credit acct|\\bamex\\b|american express", RegexOption.IGNORE_CASE)
private val debitCardHintPattern = Regex("debit card|debit a/c|debited from a/c|debited from acct", RegexOption.IGNORE_CASE)

object BackgroundSmsParser {
    private fun normalizeUnicode(text: String): String =
        try {
            Normalizer.normalize(text, Normalizer.Form.NFKD)
        } catch (_: Exception) {
            text
        }

    fun parseIncomingMessage(messages: Array<SmsMessage>): BackgroundSmsReviewItem? {
        val combined = toRawMessage(messages) ?: return null
        val result = parseRawMessage(combined)
        if (result == null) {
            LoggerApi.d("SMS_PARSER", "Skipped message from ${combined.sender}: did not match transaction pattern")
        } else {
            LoggerApi.d("SMS_PARSER", "Parsed: fingerprint=${result.fingerprint} amount=${result.amount} merchant=${result.merchantName}")
        }
        return result
    }

    private fun toRawMessage(messages: Array<SmsMessage>): BackgroundSmsRawMessage? {
        if (messages.isEmpty()) {
            return null
        }

        val first = messages.first()
        val sender = first.displayOriginatingAddress.orEmpty()
        val body =
            messages
                .joinToString(separator = "") { message ->
                    message.displayMessageBody.orEmpty()
                }.trim()
        if (body.isBlank()) {
            return null
        }

        val timestampMillis = first.timestampMillis.takeIf { it > 0 } ?: System.currentTimeMillis()
        val receivedAt = Instant.ofEpochMilli(timestampMillis).toString()
        val fingerprint = createFingerprint(sender, body, receivedAt)
        val messageId = "bg_${fingerprint}_$timestampMillis"

        return BackgroundSmsRawMessage(
            messageId = messageId,
            sender = sender,
            body = body,
            receivedAt = receivedAt,
        )
    }

    private fun parseRawMessage(message: BackgroundSmsRawMessage): BackgroundSmsReviewItem? {
        val body = normalizeUnicode(message.body).trim()
        if (body.isEmpty()) {
            return null
        }

        if (otpKeywords.containsMatchIn(body) || isNegativeBankAlert(body)) {
            return null
        }

        if (!debitKeywords.containsMatchIn(body) || creditOnlyKeywords.containsMatchIn(body)) {
            return null
        }

        val amount = parseAmount(body) ?: return null
        val merchantName = inferMerchant(body)
        val now = Instant.now().toString()
        val fingerprint = createFingerprint(message.sender, message.body, message.receivedAt, amount)

        return BackgroundSmsReviewItem(
            id = "${fingerprint}_${message.messageId}",
            fingerprint = fingerprint,
            sourceMessage = message,
            amount = amount,
            currency = "INR",
            merchantName = merchantName,
            categorySuggestion = inferCategory(body, merchantName),
            paymentMethodSuggestion = inferPaymentMethod(body),
            noteSuggestion = merchantName?.let { "SMS import: $it" },
            transactionDate = message.receivedAt,
            matchedLocale = "en-IN",
            matchedPatternKey = "india.generic.transaction",
            status = "pending",
            createdAt = now,
            updatedAt = now,
        )
    }

    private fun parseAmount(body: String): Double? {
        val match = amountPattern.find(body) ?: return null
        val amountString = match.groupValues.getOrNull(1)?.replace(",", "") ?: return null
        return amountString.toDoubleOrNull()
    }

    private fun inferMerchant(body: String): String? {
        val match = merchantPattern.find(body) ?: return null
        return match.groupValues
            .getOrNull(1)
            ?.replace(Regex("\\s+"), " ")
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
    }

    private fun inferCategory(
        body: String,
        merchantName: String?,
    ): String {
        val normalizedContent =
            listOfNotNull(merchantName, body)
                .joinToString(separator = " ")
                .trim()
                .lowercase(Locale.ROOT)

        if (normalizedContent.isEmpty()) {
            return "Other"
        }

        return categoryInferenceRules
            .firstOrNull { (_, pattern) ->
                pattern.containsMatchIn(normalizedContent)
            }?.first ?: "Other"
    }

    private fun inferPaymentMethod(body: String): BackgroundSmsPaymentMethod? =
        when {
            upiHintPattern.containsMatchIn(body) -> BackgroundSmsPaymentMethod(type = "UPI")
            creditCardHintPattern.containsMatchIn(body) -> BackgroundSmsPaymentMethod(type = "Credit Card")
            debitCardHintPattern.containsMatchIn(body) -> BackgroundSmsPaymentMethod(type = "Debit Card")
            else -> null
        }

    private fun isNegativeBankAlert(body: String): Boolean {
        val hasDebitSignal = debitKeywords.containsMatchIn(body) && !creditOnlyKeywords.containsMatchIn(body)
        val hasSettledDebitSignal =
            settledDebitKeywords.containsMatchIn(body) && !creditOnlyKeywords.containsMatchIn(body)

        return nonExpenseTransactionOutcomeKeywords.containsMatchIn(body) ||
            (!hasDebitSignal && nonExpenseInfoKeywords.containsMatchIn(body)) ||
            (approvalPromptKeywords.containsMatchIn(body) && !hasSettledDebitSignal)
    }

    private fun getTimeWindow(receivedAt: String): Long {
        val timestamp =
            try {
                Instant.parse(receivedAt).toEpochMilli()
            } catch (_: Exception) {
                return 0L
            }

        val windowMs = 3 * 60 * 1000L
        return (timestamp / windowMs) * windowMs
    }

    private fun normalizeAmount(amount: Double?): String = amount?.let { String.format("%.2f", it) } ?: ""

    private fun sha256(value: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    private fun createFingerprint(
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
        val timeWindow = getTimeWindow(receivedAt)
        val key = "$normalizedSender|$normalizedAmount|$timeWindow|$normalizedBody"
        return "sms_${sha256(key)}"
    }
}
