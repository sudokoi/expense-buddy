package expo.modules.expensebuddysmsparser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SmsParserEvidenceTest {
    @Test
    fun `extracts payer suffix and merchant from the reported Axis P2M format`() {
        val body =
            "INR 15.00 debited\nA/c no. XX1708\n10-09-26, 19:51:13\n" +
                "UPI/P2M/123456789012/BMTC\nNot you? SMS BLOCKUPI Cust ID to 910000000000\nAxis Bank"
        val result = parse(body)
        assertNull(result.skipReason)
        assertEquals(15.0, result.parsed?.amount)
        assertEquals("INR", result.parsed?.currency)
        assertEquals("UPI", result.parsed?.paymentMethodSuggestion?.type)
        assertEquals("708", result.parsed?.paymentMethodSuggestion?.identifier)
        assertEquals("BMTC", result.parsed?.merchantName)
        assertEquals(body, result.parsed?.sourceMessage?.body)
    }

    @Test
    fun `account number labels preserve payer and recipient distinction`() {
        for (label in listOf("A/c no.", "ACCOUNT NUMBER:", "acct no", "a/c no.:", "A/c no.\n")) {
            val result = parse("INR 15 debited from $label XX1708 via UPI to account no. XX1987.")
            assertNull(label, result.skipReason)
            assertEquals(label, "708", result.parsed?.paymentMethodSuggestion?.identifier)
        }
        val recipient = parse("INR 15 paid via UPI to account no. XX1708.")
        assertNull(recipient.skipReason)
        assertNull(recipient.parsed?.paymentMethodSuggestion?.identifier)
        val conflicting = parse("INR 15 debited from a/c no. XX1708, account number XX1987 via UPI.")
        assertNull(conflicting.skipReason)
        assertNull(conflicting.parsed?.paymentMethodSuggestion?.identifier)
    }

    @Test
    fun `P2M merchant evidence does not bypass request and failure checks`() {
        for (body in listOf(
            "INR 15 payment request UPI/P2M/123456789012/BMTC",
            "INR 15 debited via UPI/P2M/123456789012/BMTC. Transaction failed.",
        )) {
            assertNull(body, parse(body).parsed)
        }
    }

    @Test
    fun `compact P2M merchants end at field boundaries without swallowing bank prose`() {
        for (suffix in listOf("", "/AXIS")) {
            val result = parse("INR 15 debited via UPI/P2M/123456789012/BMTC$suffix")
            assertNull(result.skipReason)
            assertEquals("BMTC", result.parsed?.merchantName)
        }
        val ambiguous = parse("INR 15 debited via UPI/P2M/123456789012/BMTC Axis Bank")
        assertNull(ambiguous.skipReason)
        assertNull(ambiguous.parsed?.merchantName)
    }

    @Test
    fun `rejects two equal-valued outgoing events`() {
        val result = parse("INR 250 paid to Alex. INR 250 paid to Bob.")
        assertNull(result.parsed)
        assertEquals(SkipReason.NEGATIVE_ALERT, result.skipReason)
    }

    @Test
    fun `does not attach an unrelated paid statement to an incoming amount`() {
        val result = parse("Your account credited INR 500. You previously paid at Cafe.")
        assertNull(result.parsed)
        assertEquals(SkipReason.NOT_DEBIT, result.skipReason)
    }

    @Test
    fun `accepts a linked payer debit and recipient credit`() {
        val body = "INR 250 debited from your account and INR 250 credited to Alex via UPI."
        val result = parse(body)
        assertNull(result.skipReason)
        assertEquals(250.0, result.parsed?.amount)
        assertEquals(body, result.parsed?.sourceMessage?.body)
    }

    @Test
    fun `conditional failure instructions do not veto a completed debit`() {
        val result = parse("INR 250 debited via UPI to Swiggy. If your payment failed, contact support.")
        assertNull(result.skipReason)
        assertEquals(250.0, result.parsed?.amount)
    }

    @Test
    fun `instructions cannot hide a later real transaction`() {
        val result = parse("INR 250 paid to Alex. Please contact your bank for help. INR 250 paid to Bob.")
        assertNull(result.parsed)
        assertEquals(SkipReason.NEGATIVE_ALERT, result.skipReason)
    }

    @Test
    fun `a merchant name is not a reported outcome`() {
        val result = parse("INR 250 spent at REFUNDED CAFE using debit card.")
        assertNull(result.skipReason)
        assertEquals("REFUNDED CAFE", result.parsed?.merchantName)
    }

    @Test
    fun `actual refunds failures and requests stay out`() {
        for (body in listOf(
            "INR 250 paid to Cafe failed.",
            "INR 250 debited, then reversed.",
            "Purchase INR 500 completed. Partial refund INR 100 processed.",
            "INR 250 payment initially failed; retry successful.",
            "INR 250 paid to Cafe. INR 500 payment request pending.",
        )) {
            val result = parse(body)
            assertNull(body, result.parsed)
            assertEquals(body, SkipReason.NEGATIVE_ALERT, result.skipReason)
        }
    }

    @Test
    fun `extracts only the payer identifier for a saved instrument`() {
        val card = parse("INR 250 spent at Store using debit card ending 4321. Reference 9988.")
        assertEquals("Debit Card", card.parsed?.paymentMethodSuggestion?.type)
        assertEquals("4321", card.parsed?.paymentMethodSuggestion?.identifier)
        val upi = parse("INR 500 debited from a/c XX321 via UPI to account XX987.")
        assertEquals("UPI", upi.parsed?.paymentMethodSuggestion?.type)
        assertEquals("321", upi.parsed?.paymentMethodSuggestion?.identifier)
        val transfer = parse("INR 500 paid via NEFT to credit card ending 4321.")
        assertEquals("Net Banking", transfer.parsed?.paymentMethodSuggestion?.type)
        assertNull(transfer.parsed?.paymentMethodSuggestion?.identifier)
    }

    @Test
    fun `money needs a transaction relationship not a debit elsewhere`() {
        for (body in listOf("Your account was debited. Prize INR 250.", "Purchase information. INR 250 at Store.")) {
            assertNull(body, parse(body).parsed)
        }
    }

    @Test
    fun `two completed purchases are distinct even when amounts match`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "You purchased USD 25 at Store. You purchased USD 25 at Cafe.",
                "2026-09-06T10:15:30Z",
                UsSmsRulePack,
            )
        assertNull(result.parsed)
        assertEquals(SkipReason.NEGATIVE_ALERT, result.skipReason)
    }

    @Test
    fun `multiple Japanese usage events are not one expense`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "ご利用金額 250円 加盟店：イオン。ご利用金額 250円 加盟店：出前館。",
                "2026-09-06T10:15:30Z",
                JpSmsRulePack,
            )
        assertNull(result.parsed)
        assertEquals(SkipReason.NEGATIVE_ALERT, result.skipReason)
    }

    @Test
    fun `repeated bank completion templates are not one expense`() {
        val body = "transaction number 9876 for Rs.383 by SBI Debit Card 0000 done at CAFE on 01Sep26. "
        assertNull(parse(body + body).parsed)
    }

    @Test
    fun `support prose does not supply category or payer method`() {
        val result = parse("INR 250 paid at UNKNOWN STORE. For assistance contact Travel credit card support.")
        assertEquals("Other", result.parsed?.categorySuggestion)
        assertNull(result.parsed?.paymentMethodSuggestion)
    }

    @Test
    fun `Japanese payer suffix survives matching normalization`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "デビットカード末尾４３２１ ご利用金額 250円 加盟店：イオン",
                "2026-09-06T10:15:30Z",
                JpSmsRulePack,
            )
        assertEquals("Debit Card", result.parsed?.paymentMethodSuggestion?.type)
        assertEquals("4321", result.parsed?.paymentMethodSuggestion?.identifier)
    }

    @Test
    fun `bank structures cannot bypass failure checks and do not authenticate senders`() {
        val bodies =
            listOf(
                "Sent Rs.1500 From HDFC Bank A/C *9876 To CAFE On 01/09/26 Ref 987654321012.",
                "Payment Successful! Rs.1234 from A/c ****9876 to STORE via HDFC Bank NetBanking.",
                "USD 10 spent using ICICI Bank Card XX9876 on 01-Sep-26 on STORE.",
                "ICICI Bank Acct XX987 debited for Rs 180 on 01-Sep-26; CAFE credited. UPI:987654321012.",
                "transaction number 9876 for Rs.383 by SBI Debit Card 0000 done at CAFE on 01Sep26.",
            )
        for (body in bodies) {
            // Body structure is evidence; sender branding is not authentication or an allowlist.
            assertNull(body, parse(body).skipReason)
            val rejected = parse("$body Transaction failed.")
            assertNull(body, rejected.parsed)
            assertEquals(SkipReason.NEGATIVE_ALERT, rejected.skipReason)
        }
    }

    private fun parse(body: String): ParseResult = SmsMessageParser.parseRawMessageWithReason("TESTBANK", body, "2026-09-06T10:15:30Z")
}
