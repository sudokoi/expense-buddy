package expo.modules.expensebuddysmsparser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

@RunWith(Parameterized::class)
class SmsParserRobustnessTest(
    private val region: String,
    private val currency: String,
) {
    private fun parse(body: String) =
        SmsMessageParser.parseRawMessageWithReason(
            "TESTBANK",
            body,
            "2026-09-06T10:15:30Z",
            SmsMessageParser.resolveRulePack(region),
        )

    @Test
    fun `spacing typography and safety footers do not change the transaction`() {
        val original = "$currency 250 spent at CORNER CAFE using debit card."
        val variants =
            listOf(
                original,
                original.replace(" ", "\n\t"),
                original.replace(" ", "\u00a0"),
                original.replace("250", "２５０"),
                original.replace("250", "२५०"),
                original.replace("spent", "spe\u200bnt"),
                "$original Never share your OTP or PIN.",
                "$original If not you, call your bank.",
            )
        for (body in variants) {
            val result = parse(body)
            assertNotNull(body, result.parsed)
            val candidate = requireNotNull(result.parsed)
            assertEquals(250.0, requireNotNull(candidate.amount), 0.0)
            assertEquals(currency, candidate.currency)
            assertEquals("CORNER CAFE", candidate.merchantName)
            assertEquals("Food", candidate.categorySuggestion)
            assertEquals("Debit Card", candidate.paymentMethodSuggestion?.type)
            assertEquals(body, candidate.sourceMessage.body)
        }
    }

    @Test
    fun `negative outcomes and prompts never become candidates`() {
        for (body in listOf(
            "$currency 250 purchase at STORE was declined.",
            "$currency 250 purchase at STORE failed.",
            "$currency 250 purchase at STORE is pending.",
            "$currency 250 purchase at STORE was reversed.",
            "OTP 123456 for $currency 250 purchase at STORE.",
            "Approve purchase of $currency 250 at STORE.",
            "Your account will be debited $currency 250 tomorrow.",
        )) {
            assertNull(body, parse(body).parsed)
        }
    }

    @Test(timeout = 5000)
    fun `malformed and very long amounts are never partially accepted`() {
        for (amount in listOf("0", "1,2,3", "12.345", "9".repeat(400), "1.2.3")) {
            val body = "$currency $amount spent at STORE."
            assertNull(body, parse(body).parsed)
        }
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun regions() =
            listOf(
                arrayOf("IN", "INR"),
                arrayOf("US", "USD"),
                arrayOf("GB", "GBP"),
                arrayOf("CA", "CAD"),
                arrayOf("AU", "AUD"),
                arrayOf("JP", "JPY"),
            )
    }
}
