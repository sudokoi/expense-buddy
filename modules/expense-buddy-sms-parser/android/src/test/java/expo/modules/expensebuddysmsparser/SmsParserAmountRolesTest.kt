package expo.modules.expensebuddysmsparser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SmsParserAmountRolesTest {
    @Test
    fun `selects explicitly billed currency over purchase currency`() {
        for (body in listOf(
            "USD 10 spent at Store. Amount billed to your card INR 840.",
            "Amount billed to your card INR 840. USD 10 spent at Store.",
        )) {
            val result = parse(body)
            assertNull(body, result.skipReason)
            assertEquals(840.0, result.parsed?.amount)
            assertEquals("INR", result.parsed?.currency)
            assertEquals("Store", result.parsed?.merchantName)
        }
    }

    @Test
    fun `selects explicit fee-inclusive debit total`() {
        for (body in listOf(
            "INR 500 paid to Alex. Fee INR 5. Total debited INR 505.",
            "Total debited INR 505. Fee INR 5. INR 500 paid to Alex.",
        )) {
            val result = parse(body)
            assertNull(body, result.skipReason)
            assertEquals(505.0, result.parsed?.amount)
            assertEquals("INR", result.parsed?.currency)
            assertEquals("Alex", result.parsed?.merchantName)
        }
    }

    @Test
    fun `competing estimates fees and malformed billed amounts are not guessed`() {
        for (body in listOf(
            "USD 10 spent at Store. INR 840.",
            "USD 10 spent at Store. Estimated amount billed INR 840.",
            "INR 500 paid to Alex. Fee INR 5.",
            "INR 500 paid to Alex. Fee INR 5. Total debited INR 505. Total debited INR 510.",
            "USD 10 spent at Store. Amount billed CHF $840.",
            "USD 10 spent at Store. Amount billed INR 840abc.",
            "INR 500 paid to Alex. Fee INR 5abc. Total debited INR 505.",
        )) {
            assertNull(body, parse(body).parsed)
        }
    }

    private fun parse(body: String): ParseResult = SmsMessageParser.parseRawMessageWithReason("TESTBANK", body, "2026-09-06T10:15:30Z")
}
