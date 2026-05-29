package expo.modules.expensebuddysmsparser

import com.google.common.truth.Truth.assertThat
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class SmsMessageParserTest {
    @Test
    fun `parseRawMessage parses debit UPI transaction with merchant and amount`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Rs. 250.50 debited via UPI to Swiggy on 11-04-2026",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.amount).isWithin(1e-9).of(250.5)
        assertThat(result?.currency).isEqualTo("INR")
        assertThat(result?.merchantName).contains("Swiggy")
        assertThat(result?.categorySuggestion).isEqualTo("Food")
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("UPI")
        assertThat(result?.noteSuggestion).contains("Swiggy")
        assertThat(result?.transactionDate).isEqualTo("2026-04-11T10:15:30.000Z")
        assertThat(result?.matchedLocale).isEqualTo("en-IN")
        assertThat(result?.matchedPatternKey).isEqualTo("india.generic.transaction")
    }

    @Test
    fun `infers category Shopping for Amazon purchases`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace using debit card",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Other")
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("Debit Card")
    }

    @Test
    fun `infers category Transport for Uber and payment method Credit Card`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 820 paid to Uber Trip via credit card",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Transport")
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("Credit Card")
    }

    @Test
    fun `infers category Transport for Uber with Amex`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 820 paid to Uber Trip via Amex",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Transport")
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("Credit Card")
    }

    @Test
    fun `infers category Utilities for Jio recharge`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 1499 paid for Jio recharge",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Utilities")
    }

    @Test
    fun `infers category Health for Apollo Pharmacy`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 899 spent at Apollo Pharmacy",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Health")
    }

    @Test
    fun `infers category Groceries for BigBasket`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 550 spent at BigBasket",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Groceries")
    }

    @Test
    fun `falls back to Other when no default category pattern matches`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 299 paid to Amazon Marketplace via UPI",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.categorySuggestion).isEqualTo("Other")
    }

    @Test
    fun `parses debit messages that mention card ending details`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon using debit card ending 1234",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.amount).isWithin(1e-9).of(499.0)
        assertThat(result?.categorySuggestion).isEqualTo("Other")
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("Debit Card")
    }

    @Test
    fun `ignores credited messages`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 500 credited to your account from employer",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores OTP messages`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "OTP 482911 for INR 499 transaction at Amazon. Do not share with anyone.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores one-time password messages`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Your one-time password for UPI txn of Rs. 250 is 834221. Valid for 10 minutes.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores verification code messages`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Verification code 991822 for credit card purchase of INR 820 at Uber. Never share this code.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores available balance alerts`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Your available balance is INR 25,430.55 as of 11-04-2026.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores credit card statement alerts`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Credit card statement generated. Total due INR 8,220. Minimum due INR 410 by 18-04-2026.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores token registration alerts`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Card ending 1234 used for e-commerce token registration. If not you, call bank immediately.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores approval prompt alerts`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "INR 499 transaction at Amazon requires authentication. Approve in app to complete your transaction.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores failed transaction alerts`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "UPI txn of Rs. 250 failed due to incorrect UPI PIN. No amount debited.",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores messages without a supported amount`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "Your debit card transaction at Swiggy was successful",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `ignores empty messages`() {
        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = "",
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNull()
    }

    @Test
    fun `detects SBI Credit Card transaction via UPI with mathematical bold unicode`() {
        val body =
            "Rs.12.00 \uD835\uDE4C\uD835\uDE49\uD835\uDE3E\uD835\uDE47\uD835\uDE4D \uD835\uDE4D\uD835\uDE47 \uD835\uDE42\uD835\uDE4B\uD835\uDE40 \uD835\uDE32\uD835\uDE22\uD835\uDE36 \uD835\uDE22\uD835\uDE40\uD835\uDE3E\uD835\uDE3B\uD835\uDE36\uD835\uDE4D \uD835\uDE22\uD835\uDE30\uD835\uDE40\uD835\uDE3B \uD835\uDE3E\uD835\uDE47\uD835\uDE3B\uD835\uDE36\uD835\uDE47\uD835\uDE44 \uD835\uDE54\uD835\uDE36\uD835\uDE4D\uD835\uDE45 \uD835\uDE45\uD835\uDE36\uD835\uDE4D\uD835\uDE40\uD835\uDE44 5503 at BMTCBUSKA51AK0649 on 27-05-26 via UPI (Ref No. 651338988953). \uD835\uDE33\uD835\uDE40\uD835\uDE51\uD835\uDE47. \uD835\uDE47\uD835\uDE4B\uD835\uDE4D \uD835\uDE3B\uD835\uDE4D\uD835\uDE47\uD835\uDE3E \uD835\uDE2F\uD835\uDE42 \uD835\uDE42\uD835\uDE4B\uD835\uDE42? \uD835\uDE21\uD835\uDE3E\uD835\uDE49\uD835\uDE4B\uD835\uDE4D \uD835\uDE30\uD835\uDE4D https://sbicard.com/Dispute"

        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-HDFCBK",
                body = body,
                receivedAt = "2026-04-11T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.amount).isWithin(1e-9).of(12.0)
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("UPI")
    }

    // Fingerprint tests

    @Test
    fun `fingerprint normalizes sender body and whitespace before hashing`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "  vk-hdfcbk  ",
                body = "INR   499   spent  at  AMAZON Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
            )

        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `fingerprint treats messages within same 3-minute window as same candidate`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:01.000Z",
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:17:59.000Z",
            )

        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `fingerprint treats messages in different 3-minute windows as distinct`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:01.000Z",
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:18:01.000Z",
            )

        assertThat(fp1).isNotEqualTo(fp2)
    }

    @Test
    fun `fingerprint keeps exact duplicates stable`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:59.000Z",
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:59.000Z",
            )

        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `fingerprint includes amount in the fingerprint when provided`() {
        val withoutAmount =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
            )
        val withAmount =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
                amount = 499.0,
            )

        assertThat(withoutAmount).isNotEqualTo(withAmount)
    }

    @Test
    fun `fingerprint normalizes amount to two decimal places`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
                amount = 499.0,
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
                amount = 499.00,
            )

        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `fingerprint produces same result for same sender body time and amount`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
                amount = 499.0,
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "  vk-hdfcbk  ",
                body = "INR   499   spent  at  AMAZON Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
                amount = 499.0,
            )

        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `fingerprint starts with sms_ prefix`() {
        val fp =
            SmsMessageParser.createFingerprint(
                sender = "VK-HDFCBK",
                body = "INR 499 spent at Amazon Marketplace",
                receivedAt = "2026-04-11T10:15:45.000Z",
            )

        assertThat(fp).startsWith("sms_")
    }

    @Test
    fun `fingerprint is deterministic`() {
        val fp1 =
            SmsMessageParser.createFingerprint(
                sender = "TestBank",
                body = "Your account debited INR 500.00 at BigBasket",
                receivedAt = "2026-05-01T12:00:00.000Z",
                amount = 500.0,
            )
        val fp2 =
            SmsMessageParser.createFingerprint(
                sender = "TestBank",
                body = "Your account debited INR 500.00 at BigBasket",
                receivedAt = "2026-05-01T12:00:00.000Z",
                amount = 500.0,
            )

        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `detects SBI Credit Card transaction with plain ASCII`() {
        val result =
            SmsMessageParser.parseRawMessage(
                body =
                    "Rs.4,354.00 spent on your SBI Credit Card ending 1126 at PYUFLIPKARTINTERNET " +
                        "on 28/05/26. Trxn. not done by you? Report at https://sbicard.com/Dispute",
                receivedAt = "2026-05-28T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.amount).isWithin(1e-9).of(4354.0)
    }

    @Test
    fun `detects SBI Credit Card transaction with mathematical sans-serif unicode`() {
        val body =
            "Rs.4,354.00 \uD835\uDDCC\uD835\uDDC9\uD835\uDDBE\uD835\uDDC7\uD835\uDDCD " +
                "\uD835\uDDC8\uD835\uDDC7 " +
                "\uD835\uDDCE\uD835\uDDC8\uD835\uDDCE\uD835\uDDCB \uD835\uDDB2\uD835\uDDA1\uD835\uDDA8 " +
                "\uD835\uDDA2\uD835\uDDCB\uD835\uDDBE\uD835\uDDBD" +
                "\uD835\uDDC2\uD835\uDDCD " +
                "\uD835\uDDA2\uD835\uDDBA\uD835\uDDCB\uD835\uDDBD " +
                "\uD835\uDDBE\uD835\uDDC7\uD835\uDDBD\uD835\uDDC2" +
                "\uD835\uDDC7\uD835\uDDC0 1126 at PYUFLIPKARTINTERNET on 28/05/26. " +
                "\uD835\uDDB3\uD835\uDDCB\uD835\uDDC1\uD835\uDDC7. " +
                "\uD835\uDDC7\uD835\uDDC8\uD835\uDDCD \uD835\uDDBD\uD835\uDDC8\uD835\uDDC7\uD835\uDDBE " +
                "\uD835\uDDBB\uD835\uDDCE \uD835\uDDCE\uD835\uDDC8\uD835\uDDCE? " +
                "\uD835\uDDB1\uD835\uDDBE\uD835\uDDC9\uD835\uDDC8\uD835\uDDCB\uD835\uDDCD \uD835\uDDBA\uD835\uDDCD " +
                "https://sbicard.com/Dispute"

        val result =
            SmsMessageParser.parseRawMessage(
                sender = "VK-SBICRD",
                body = body,
                receivedAt = "2026-05-28T10:15:30.000Z",
            )

        assertThat(result).isNotNull()
        assertThat(result?.amount).isWithin(1e-9).of(4354.0)
        assertThat(result?.merchantName).isEqualTo("PYUFLIPKARTINTERNET")
        assertThat(result?.paymentMethodSuggestion?.type).isEqualTo("Credit Card")
        assertThat(result?.fingerprint).isNotNull()
    }

    @Test
    fun `detects SBI Card transaction with the exact user-reported message`() {
        val body =
            "Rs.4,354.00 \uD835\uDDCC\uD835\uDDC9\uD835\uDDBE\uD835\uDDC7\uD835\uDDCD " +
                "\uD835\uDDC8\uD835\uDDC7 " +
                "\uD835\uDDCE\uD835\uDDC8\uD835\uDDCE\uD835\uDDCB \uD835\uDDB2\uD835\uDDA1\uD835\uDDA8 " +
                "\uD835\uDDA2\uD835\uDDCB\uD835\uDDBE\uD835\uDDBD\uD835\uDDC2\uD835\uDDCD " +
                "\uD835\uDDA2\uD835\uDDBA\uD835\uDDCB\uD835\uDDBD " +
                "\uD835\uDDBE\uD835\uDDC7\uD835\uDDBD\uD835\uDDC2\uD835\uDDC7\uD835\uDDC0 " +
                "1126 at PYUFLIPKARTINTERNET on 28/05/26. " +
                "\uD835\uDDB3\uD835\uDDCB\uD835\uDDC1\uD835\uDDC7. " +
                "\uD835\uDDC7\uD835\uDDC8\uD835\uDDCD \uD835\uDDBD\uD835\uDDC8\uD835\uDDC7\uD835\uDDBE " +
                "\uD835\uDDBB\uD835\uDDCE \uD835\uDDCE\uD835\uDDC8\uD835\uDDCE? " +
                "\uD835\uDDB1\uD835\uDDBE\uD835\uDDC9\uD835\uDDC8\uD835\uDDCB\uD835\uDDCD " +
                "\uD835\uDDBA\uD835\uDDCD " +
                "https://sbicard.com/Dispute"
        val result = SmsMessageParser.parseRawMessageWithReason("SBICARD", body, "2026-05-28T10:15:30.000Z")
        assertNotNull(result.parsed)
        assertNull(result.skipReason)
        assertThat(result.parsed?.amount).isWithin(1e-9).of(4354.0)
        assertThat(result.parsed?.merchantName).isEqualTo("PYUFLIPKARTINTERNET")
    }

    @Test
    fun `fingerprint is stable for mathematical sans-serif message across scans`() {
        val body =
            "Rs.4,354.00 \uD835\uDDCC\uD835\uDDC9\uD835\uDDBE\uD835\uDDC7\uD835\uDDCD " +
                "\uD835\uDDC8\uD835\uDDC7 " +
                "\uD835\uDDCE\uD835\uDDC8\uD835\uDDCE\uD835\uDDCB \uD835\uDDB2\uD835\uDDA1\uD835\uDDA8 " +
                "\uD835\uDDA2\uD835\uDDCB\uD835\uDDBE\uD835\uDDBD\uD835\uDDC2\uD835\uDDCD " +
                "\uD835\uDDA2\uD835\uDDBA\uD835\uDDCB\uD835\uDDBD " +
                "\uD835\uDDBE\uD835\uDDC7\uD835\uDDBD\uD835\uDDC2\uD835\uDDC7\uD835\uDDC0 " +
                "1126 at PYUFLIPKARTINTERNET on 28/05/26. " +
                "\uD835\uDDB3\uD835\uDDCB\uD835\uDDC1\uD835\uDDC7. " +
                "\uD835\uDDC7\uD835\uDDC8\uD835\uDDCD \uD835\uDDBD\uD835\uDDC8\uD835\uDDC7\uD835\uDDBE " +
                "\uD835\uDDBB\uD835\uDDCE \uD835\uDDCE\uD835\uDDC8\uD835\uDDCE? " +
                "\uD835\uDDB1\uD835\uDDBE\uD835\uDDC9\uD835\uDDC8\uD835\uDDCB\uD835\uDDCD " +
                "\uD835\uDDBA\uD835\uDDCD " +
                "https://sbicard.com/Dispute"
        val fp1 = SmsMessageParser.createFingerprint("SBICARD", body, "2026-05-28T10:15:30.000Z", 4354.0)
        val fp2 = SmsMessageParser.createFingerprint("SBICARD", body, "2026-05-28T10:15:31.500Z", 4354.0)
        assertThat(fp1).isEqualTo(fp2)
    }

    @Test
    fun `parseRawMessageWithReason returns EMPTY_BODY for empty message`() {
        val result = SmsMessageParser.parseRawMessageWithReason("BANK", "", "2026-05-28T10:15:30.000Z")
        assertNull(result.parsed)
        assertEquals(SkipReason.EMPTY_BODY, result.skipReason)
    }

    @Test
    fun `parseRawMessageWithReason returns OTP_MATCH for OTP message`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "OTP 482911 for transaction at Amazon",
                "2026-05-28T10:15:30.000Z",
            )
        assertNull(result.parsed)
        assertEquals(SkipReason.OTP_MATCH, result.skipReason)
    }

    @Test
    fun `parseRawMessageWithReason returns NOT_DEBIT for credited message`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "INR 500 credited to your account",
                "2026-05-28T10:15:30.000Z",
            )
        assertNull(result.parsed)
        assertEquals(SkipReason.NOT_DEBIT, result.skipReason)
    }

    @Test
    fun `parseRawMessageWithReason returns AMOUNT_MISSING for message without amount`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "Your debit card transaction at Swiggy was successful",
                "2026-05-28T10:15:30.000Z",
            )
        assertNull(result.parsed)
        assertEquals(SkipReason.AMOUNT_MISSING, result.skipReason)
    }

    @Test
    fun `parseRawMessageWithReason returns NEGATIVE_ALERT for approval prompt message`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "BANK",
                "INR 499 transaction at Amazon requires authentication. Approve in app to complete your transaction.",
                "2026-05-28T10:15:30.000Z",
            )
        assertNull(result.parsed)
        assertEquals(SkipReason.NEGATIVE_ALERT, result.skipReason)
    }

    @Test
    fun `parseRawMessageWithReason returns null skip reason for valid transaction`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                "VK-HDFCBK",
                "INR 499 spent at Amazon Marketplace using debit card",
                "2026-04-11T10:15:30.000Z",
            )
        assertNotNull(result.parsed)
        assertNull(result.skipReason)
    }
}
