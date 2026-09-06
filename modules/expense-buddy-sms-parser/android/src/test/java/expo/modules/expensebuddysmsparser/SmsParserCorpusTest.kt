package expo.modules.expensebuddysmsparser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** Expected values are authored independently, never regenerated from parser output. */
@RunWith(Parameterized::class)
class SmsParserCorpusTest(
    private val fields: List<String>,
) {
    @Test
    fun `matches the independently labelled SMS`() {
        val region = fields[2]
        val amount = fields[3]
        val currency = fields[4]
        val merchant = fields[5]
        val category = fields[6]
        val method = fields[7]
        val skip = fields[8]
        val body = fields[9]
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "TESTBANK",
                body,
                "2026-09-06T10:15:30Z",
                SmsMessageParser.resolveRulePack(region),
            )
        if (skip != "-") {
            assertNull(result.parsed)
            assertEquals(skip, result.skipReason?.name)
        } else {
            assertNull(result.skipReason)
            assertNotNull(result.parsed)
            val parsed = requireNotNull(result.parsed)
            assertEquals(amount.toDouble(), requireNotNull(parsed.amount), 0.000001)
            assertEquals(currency, parsed.currency)
            assertEquals(merchant.takeUnless { it == "-" }, parsed.merchantName)
            assertEquals(category, parsed.categorySuggestion)
            assertEquals(method.takeUnless { it == "-" }, parsed.paymentMethodSuggestion?.type)
            assertEquals("2026-09-06T10:15:30Z", parsed.transactionDate)
        }
    }

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{index}: {0}")
        fun cases(): List<Array<Any>> =
            listOf("/sms-regex-corpus.tsv", "/sms-evidence-corpus.tsv")
                .asSequence()
                .flatMap { requireNotNull(SmsParserCorpusTest::class.java.getResource(it)).readText().lineSequence() }
                .filter { it.isNotBlank() && !it.startsWith("#") }
                .map { line ->
                    val fields = line.split('\t')
                    require(fields.size == 10) { "Expected ten columns: $line" }
                    arrayOf<Any>(fields)
                }.toList()
    }
}
