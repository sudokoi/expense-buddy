package expo.modules.expensebuddysmsparser

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Fixture tests for the US, UK and Japan rule packs.
 *
 * Fixtures are reconstructed from publicly documented bank alert templates
 * (ADR-010) and treated as hypotheses, not ground truth - tune against real
 * samples collected post-release. The Japan pack is the most speculative:
 * Japanese alert phrasing varies widely between banks.
 */
class RegionRulePacksUsUkJpTest {
    // ---- Pack resolution ----------------------------------------------------

    @Test
    fun `resolveRulePack routes US GB JP`() {
        assertThat(SmsMessageParser.resolveRulePack("US")).isSameInstanceAs(UsSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("GB")).isSameInstanceAs(UkSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("JP")).isSameInstanceAs(JpSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("jp")).isSameInstanceAs(JpSmsRulePack)
    }

    // ---- United States ------------------------------------------------------

    private fun parseUs(body: String) =
        SmsMessageParser.parseRawMessageWithReason(
            sender = "CHASE",
            body = body,
            receivedAt = "2026-08-23T14:00:00.000Z",
            rulePack = UsSmsRulePack,
        )

    @Test
    fun `us parses Chase card purchase alert with merchant and category`() {
        val result =
            parseUs(
                "Chase: You made a \$4.75 purchase at STARBUCKS using your Visa ending 1234.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(4.75)
        assertThat(parsed?.currency).isEqualTo("USD")
        assertThat(parsed?.matchedLocale).isEqualTo("en-US")
        assertThat(parsed?.matchedPatternKey).isEqualTo("usa.generic.transaction")
        assertThat(parsed?.merchantName).contains("STARBUCKS")
        assertThat(parsed?.categorySuggestion).isEqualTo("Food")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Credit Card")
    }

    @Test
    fun `us parses Zelle payment with payment method hint`() {
        val result =
            parseUs(
                "You sent \$650.00 to Michael via Zelle. Memo: Rent.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(650.0)
        assertThat(parsed?.currency).isEqualTo("USD")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Zelle")
        assertThat(parsed?.categorySuggestion).isEqualTo("Rent")
    }

    @Test
    fun `us infers Groceries for Kroger and skips balance alerts`() {
        val groceries =
            parseUs("\$85.32 spent at KROGER on debit card ending 4321.").parsed
                ?: error("expected parse")

        val balance =
            SmsMessageParser.parseRawMessageWithReason(
                "CHASE",
                "Your available balance is \$2,451.10 as of Aug 23.",
                "2026-08-23T18:00:00.000Z",
                UsSmsRulePack,
            )
        val creditOnly =
            SmsMessageParser.parseRawMessageWithReason(
                "CHASE",
                "You received \$50.00 from jane via Zelle.",
                "2026-08-23T18:15:00.000Z",
                UsSmsRulePack,
            )

        assertThat(groceries.categorySuggestion).isEqualTo("Groceries")
        assertThat(balance.skipReason).isEqualTo(SkipReason.NEGATIVE_ALERT)
        assertThat(creditOnly.skipReason).isEqualTo(SkipReason.NOT_DEBIT)
    }

    // ---- United Kingdom -----------------------------------------------------

    private fun parseUk(body: String) =
        SmsMessageParser.parseRawMessageWithReason(
            sender = "Monzo",
            body = body,
            receivedAt = "2026-08-23T09:00:00.000Z",
            rulePack = UkSmsRulePack,
        )

    @Test
    fun `uk parses Monzo debited alert with merchant and category`() {
        val result =
            parseUk(
                "You spent £12.40 at TESCO METRO on your debit card.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(12.40)
        assertThat(parsed?.currency).isEqualTo("GBP")
        assertThat(parsed?.matchedLocale).isEqualTo("en-GB")
        assertThat(parsed?.matchedPatternKey).isEqualTo("uk.generic.transaction")
        assertThat(parsed?.merchantName).contains("TESCO")
        assertThat(parsed?.categorySuggestion).isEqualTo("Groceries")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Debit Card")
    }

    @Test
    fun `uk parses Faster Payment with payment method hint`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                sender = "BARCLAYS",
                body = "£850.00 paid to J SMITH by Faster Payment. Ref: RENT AUG.",
                receivedAt = "2026-08-23T09:30:00.000Z",
                rulePack = UkSmsRulePack,
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(850.0)
        assertThat(parsed?.currency).isEqualTo("GBP")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Faster Payments")
        assertThat(parsed?.categorySuggestion).isEqualTo("Rent")
    }

    @Test
    fun `uk infers Transport for TfL and skips OTP messages`() {
        val transport =
            parseUk("£5.00 spent at TFL TRAVEL CHARGE using contactless.").parsed
                ?: error("expected parse")

        val otp =
            SmsMessageParser.parseRawMessageWithReason(
                "BARCLAYS",
                "Your security code is 482911. Never share this code.",
                "2026-08-23T10:05:00.000Z",
                UkSmsRulePack,
            )

        assertThat(transport.categorySuggestion).isEqualTo("Transport")
        assertThat(otp.skipReason).isEqualTo(SkipReason.OTP_MATCH)
    }

    // ---- Japan --------------------------------------------------------------

    private fun parseJp(body: String) =
        SmsMessageParser.parseRawMessageWithReason(
            sender = "SMBC",
            body = body,
            receivedAt = "2026-08-23T02:00:00.000Z",
            rulePack = JpSmsRulePack,
        )

    @Test
    fun `japan parses yen card usage alert with merchant`() {
        val result =
            parseJp(
                "カード利用 ¥1,200 at NETFLIX.COM. ご利用ありがとうございます。",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(1200.0)
        assertThat(parsed?.currency).isEqualTo("JPY")
        assertThat(parsed?.matchedLocale).isEqualTo("ja-JP")
        assertThat(parsed?.matchedPatternKey).isEqualTo("japan.generic.transaction")
        assertThat(parsed?.categorySuggestion).isEqualTo("Entertainment")
    }

    @Test
    fun `japan parses 円 suffix amounts with latin merchant`() {
        val result =
            parseJp(
                "ご利用金額 480円 at UBER EATS. Card ending 1234.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(480.0)
        assertThat(parsed?.currency).isEqualTo("JPY")
        assertThat(parsed?.merchantName).contains("UBER")
        assertThat(parsed?.categorySuggestion).isEqualTo("Food")
    }

    @Test
    fun `japan skips balance alerts OTP and credit-only messages`() {
        val balance =
            SmsMessageParser.parseRawMessageWithReason(
                "SMBC",
                "残高は 25,430円 です。",
                "2026-08-23T03:00:00.000Z",
                JpSmsRulePack,
            )
        val otp =
            SmsMessageParser.parseRawMessageWithReason(
                "SMBC",
                "認証コードは 482911 です。誰にも教えないでください。",
                "2026-08-23T03:05:00.000Z",
                JpSmsRulePack,
            )
        val creditOnly =
            SmsMessageParser.parseRawMessageWithReason(
                "SMBC",
                "入金 50,000円 ありました。",
                "2026-08-23T03:15:00.000Z",
                JpSmsRulePack,
            )

        assertThat(balance.skipReason).isEqualTo(SkipReason.NEGATIVE_ALERT)
        assertThat(otp.skipReason).isEqualTo(SkipReason.OTP_MATCH)
        assertThat(creditOnly.skipReason).isEqualTo(SkipReason.NOT_DEBIT)
    }
}
