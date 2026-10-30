package expo.modules.expensebuddysmsparser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** User-reported format with anonymized payer, payee and reference identifiers. */
class HdfcCardTemplateTest {
    @Test
    fun `detects reported HDFC card UPI transactions with masked payees`() {
        for ((amount, payee) in listOf(
            "2524.00" to "*1234@ybl",
            "300.00" to "*shop@ptys",
            "20.00" to "*5678@ybl",
            "50.00" to "*9012@ybl",
        )) {
            val body = message(amount, payee)
            val result = parse(body)
            assertNull(body, result.skipReason)
            val parsed = requireNotNull(result.parsed)
            assertEquals(amount.toDouble(), requireNotNull(parsed.amount), 0.0)
            assertEquals("INR", parsed.currency)
            assertEquals(payee, parsed.merchantName)
            assertEquals("UPI", parsed.paymentMethodSuggestion?.type)
            // The security footer does not establish credit-card type or a UPI account suffix.
            assertNull(parsed.paymentMethodSuggestion?.identifier)
            assertEquals(body, parsed.sourceMessage.body)
            assertEquals("2026-10-30T10:00:00Z", parsed.transactionDate)
            assertEquals("india.generic.transaction", parsed.matchedPatternKey)
        }
    }

    @Test
    fun `normalizes whitespace and typography without requiring the security footer`() {
        val body = message("2,524.00", "*shop@ptys", footer = false)
        for (variant in listOf(
            body,
            body.lowercase(),
            body.replace("\n", " "),
            body.replace(" ", "\u00a0"),
            body.replace("2,524", "２,５２４"),
        )) {
            val parsed = parse(variant).parsed
            assertEquals(variant, 2524.0, parsed?.amount)
            assertEquals(variant, "*shop@ptys", parsed?.merchantName)
        }
        assertEquals("CORNER CAFE", parse(message(payee = "CORNER CAFE")).parsed?.merchantName)
    }

    @Test
    fun `template cannot bypass outcome request OTP or money validation`() {
        val body = message(footer = false)
        for (suffix in listOf(
            "Transaction failed.",
            "Transaction pending.",
            "Transaction reversed.",
            "Payment request.",
            "Approve this transaction.",
        )) {
            val result = parse("$body. $suffix")
            assertNull(suffix, result.parsed)
            assertEquals(suffix, SkipReason.NEGATIVE_ALERT, result.skipReason)
        }
        assertEquals(SkipReason.OTP_MATCH, parse("OTP 123456 for $body").skipReason)
        for (amount in listOf("0.00", "1,2,3.00", "20.123")) {
            assertNull(amount, parse(message(amount = amount)).parsed)
        }
    }

    @Test
    fun `requires the HDFC card UPI structure rather than just a transaction label`() {
        val body = message(footer = false)
        for (variant in listOf(
            "Txn Rs.20.00",
            body.replace("HDFC", "OTHER"),
            body.replace("Card", "Account"),
            body.replace("by UPI 123456789012", ""),
            body.replace("On 26-10", ""),
        )) {
            assertNull(variant, parse(variant).parsed)
        }
    }

    @Test
    fun `separate card transactions are not combined into one expense`() {
        for (footer in listOf(false, true)) {
            val body = message(footer = footer)
            for (second in listOf(body, message(amount = "50.00", footer = footer))) {
                assertNull(parse("$body\n$second").parsed)
            }
        }
    }

    private fun message(
        amount: String = "20.00",
        payee: String = "*1234@ybl",
        footer: Boolean = true,
    ): String {
        val transaction =
            """
            Txn Rs.$amount
            On HDFC Bank Card 9876
            At $payee
            by UPI 123456789012
            On 26-10
            """.trimIndent()
        return if (footer) "$transaction\nNot You?\nCall 18000000000/SMS BLOCK CC 9876 to 7300000000" else transaction
    }

    private fun parse(body: String) = SmsMessageParser.parseRawMessageWithReason("TESTBANK", body, "2026-10-30T10:00:00Z")
}
