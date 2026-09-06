package expo.modules.expensebuddysmsparser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** Public adaptations, independently labelled for this app, not verified bank-issued messages. */
@RunWith(Parameterized::class)
class SmsBankTemplateTest(
    private val row: List<String>,
) {
    @Test
    fun `matches the labelled bank template`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                row[3],
                row[11],
                "2026-09-06T10:15:30Z",
                SmsMessageParser.resolveRulePack(row[2]),
            )
        if (row[10] != "-") {
            assertNull(result.parsed)
            assertEquals(row[10], result.skipReason?.name)
        } else {
            assertNull(result.skipReason)
            val parsed = requireNotNull(result.parsed)
            assertEquals(row[5].toDouble(), parsed.amount)
            assertEquals(row[6], parsed.currency)
            assertEquals(row[7].takeUnless { it == "-" }, parsed.merchantName)
            assertEquals(row[8], parsed.categorySuggestion)
            assertEquals(row[9].takeUnless { it == "-" }, parsed.paymentMethodSuggestion?.type)
            assertEquals(row[11], parsed.sourceMessage.body)
            assertEquals("india.generic.transaction", parsed.matchedPatternKey)
        }
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{index}: {0}")
        fun cases(): List<Array<Any>> =
            requireNotNull(SmsBankTemplateTest::class.java.getResource("/sms-bank-template-corpus.tsv"))
                .readText()
                .lineSequence()
                .filter { it.isNotBlank() && !it.startsWith("#") }
                .map {
                    val row = it.split('\t')
                    require(row.size == 12)
                    arrayOf<Any>(row)
                }.toList()
    }
}
