package expo.modules.expensebuddysmsparser

import com.google.common.truth.Truth.assertThat
import org.junit.Test

/**
 * Fixture tests for the Canada and Australia rule packs.
 *
 * Fixtures are reconstructed from publicly documented bank alert templates
 * (ADR-010) and treated as hypotheses, not ground truth - tune the packs
 * against real samples collected post-release. The review queue absorbs
 * imprecision, so v1 patterns deliberately favor precision over recall.
 */
class RegionRulePacksTest {
    // ---- Pack resolution ----------------------------------------------------

    @Test
    fun `resolveRulePack routes CA and AU and falls back to India`() {
        assertThat(SmsMessageParser.resolveRulePack("CA")).isSameInstanceAs(CanadaSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("ca")).isSameInstanceAs(CanadaSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("AU")).isSameInstanceAs(AustraliaSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("au")).isSameInstanceAs(AustraliaSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("IN")).isSameInstanceAs(IndiaSmsRulePack)
        // Unmapped regions fall back to India — historical behavior contract
        assertThat(SmsMessageParser.resolveRulePack("FR")).isSameInstanceAs(IndiaSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack(null)).isSameInstanceAs(IndiaSmsRulePack)
        assertThat(SmsMessageParser.resolveRulePack("")).isSameInstanceAs(IndiaSmsRulePack)
    }

    // ---- Canada pack --------------------------------------------------------

    private fun parseCanada(body: String) =
        SmsMessageParser.parseRawMessageWithReason(
            sender = "TDALERT",
            body = body,
            receivedAt = "2026-08-22T14:30:00.000Z",
            rulePack = CanadaSmsRulePack,
        )

    @Test
    fun `canada parses TD card purchase alert with merchant and category`() {
        val result =
            parseCanada(
                "TD Alert: You purchased \$42.10 at TIM HORTONS on Aug 22 using your Visa ending 1234.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(42.10)
        assertThat(parsed?.currency).isEqualTo("CAD")
        assertThat(parsed?.matchedLocale).isEqualTo("en-CA")
        assertThat(parsed?.matchedPatternKey).isEqualTo("canada.generic.transaction")
        assertThat(parsed?.merchantName).contains("TIM HORTONS")
        assertThat(parsed?.categorySuggestion).isEqualTo("Food")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Credit Card")
    }

    @Test
    fun `canada parses Interac e-Transfer send with payment method hint`() {
        val result =
            parseCanada(
                "INTERAC e-Transfer: You sent \$120.00 to jane@example.com.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(120.0)
        assertThat(parsed?.currency).isEqualTo("CAD")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Net Banking")
    }

    @Test
    fun `canada infers Groceries for Loblaws and Utilities for Enbridge`() {
        val groceries = parseCanada("\$85.32 spent at LOBLAWS on card ending 4321.").parsed ?: error("expected parse")

        val utilities =
            SmsMessageParser
                .parseRawMessageWithReason(
                    sender = "RBCALERT",
                    body = "\$95.40 paid to ENBRIDGE GAS via online banking.",
                    receivedAt = "2026-08-22T17:00:00.000Z",
                    rulePack = CanadaSmsRulePack,
                ).parsed ?: error("expected parse")

        assertThat(groceries.categorySuggestion).isEqualTo("Groceries")
        assertThat(utilities.categorySuggestion).isEqualTo("Utilities")
    }

    @Test
    fun `canada skips balance alerts OTP declined and credit-only messages`() {
        val balance =
            SmsMessageParser.parseRawMessageWithReason(
                "TDALERT",
                "Your available balance is \$1,254.90 as of Aug 22.",
                "2026-08-22T18:00:00.000Z",
                CanadaSmsRulePack,
            )
        val otp =
            SmsMessageParser.parseRawMessageWithReason(
                "TDALERT",
                "Your verification code is 482911. Never share this code.",
                "2026-08-22T18:05:00.000Z",
                CanadaSmsRulePack,
            )
        val declined =
            SmsMessageParser.parseRawMessageWithReason(
                "TDALERT",
                "TD Alert: Your purchase of \$42.10 at TIM HORTONS was declined due to insufficient funds.",
                "2026-08-22T18:10:00.000Z",
                CanadaSmsRulePack,
            )
        val creditOnly =
            SmsMessageParser.parseRawMessageWithReason(
                "TDALERT",
                "You received an Interac e-Transfer of \$50.00 from bob@example.com.",
                "2026-08-22T18:15:00.000Z",
                CanadaSmsRulePack,
            )

        assertThat(balance.skipReason).isEqualTo(SkipReason.NEGATIVE_ALERT)
        assertThat(otp.skipReason).isEqualTo(SkipReason.OTP_MATCH)
        assertThat(declined.skipReason).isEqualTo(SkipReason.NEGATIVE_ALERT)
        assertThat(creditOnly.skipReason).isEqualTo(SkipReason.NOT_DEBIT)
    }

    // ---- Australia pack -----------------------------------------------------

    private fun parseAustralia(body: String) =
        SmsMessageParser.parseRawMessageWithReason(
            sender = "CBAud",
            body = body,
            receivedAt = "2026-08-22T04:30:00.000Z",
            rulePack = AustraliaSmsRulePack,
        )

    @Test
    fun `australia parses CBA card spend alert with merchant and category`() {
        val result =
            parseAustralia(
                "CommBank: \$63.95 spent on Visa ending 4321 at WOOLWORTHS 1234 SYDNEY.",
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(63.95)
        assertThat(parsed?.currency).isEqualTo("AUD")
        assertThat(parsed?.matchedLocale).isEqualTo("en-AU")
        assertThat(parsed?.matchedPatternKey).isEqualTo("australia.generic.transaction")
        assertThat(parsed?.merchantName).contains("WOOLWORTHS")
        assertThat(parsed?.categorySuggestion).isEqualTo("Groceries")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Credit Card")
    }

    @Test
    fun `australia parses Osko payment with payment method hint`() {
        val result =
            SmsMessageParser.parseRawMessageWithReason(
                sender = "NAB",
                body = "NAB: You paid \$250.00 via Osko to B Smith. Ref RENT-AUG.",
                receivedAt = "2026-08-22T05:00:00.000Z",
                rulePack = AustraliaSmsRulePack,
            )

        val parsed = result.parsed
        assertThat(parsed).isNotNull()
        assertThat(parsed?.amount).isWithin(1e-9).of(250.0)
        assertThat(parsed?.currency).isEqualTo("AUD")
        assertThat(parsed?.paymentMethodSuggestion?.type).isEqualTo("Net Banking")
        assertThat(parsed?.categorySuggestion).isEqualTo("Rent")
    }

    @Test
    fun `australia infers Transport for Opal and Utilities for Telstra`() {
        val transport = parseAustralia("\$40.00 spent at OPAL TOP UP using debit card.").parsed ?: error("expected parse")

        val utilities =
            SmsMessageParser
                .parseRawMessageWithReason(
                    sender = "ComBank",
                    body = "\$89.00 paid to TELSTRA for mobile bill.",
                    receivedAt = "2026-08-22T07:00:00.000Z",
                    rulePack = AustraliaSmsRulePack,
                ).parsed ?: error("expected parse")

        assertThat(transport.categorySuggestion).isEqualTo("Transport")
        assertThat(utilities.categorySuggestion).isEqualTo("Utilities")
    }

    @Test
    fun `australia skips balance alerts OTP declined and credit-only messages`() {
        val balance =
            SmsMessageParser.parseRawMessageWithReason(
                "CBAud",
                "Your available balance is \$2,451.10 as of 22 Aug.",
                "2026-08-22T08:00:00.000Z",
                AustraliaSmsRulePack,
            )
        val otp =
            SmsMessageParser.parseRawMessageWithReason(
                "CBAud",
                "NetBank security code 991822. Do not share this code.",
                "2026-08-22T08:05:00.000Z",
                AustraliaSmsRulePack,
            )
        val declined =
            SmsMessageParser.parseRawMessageWithReason(
                "CBAud",
                "CommBank: Your \$63.95 purchase at WOOLWORTHS was declined due to insufficient funds.",
                "2026-08-22T08:10:00.000Z",
                AustraliaSmsRulePack,
            )
        val creditOnly =
            SmsMessageParser.parseRawMessageWithReason(
                "CBAud",
                "You received \$75.00 from alex@example.com via PayID.",
                "2026-08-22T08:15:00.000Z",
                AustraliaSmsRulePack,
            )

        assertThat(balance.skipReason).isEqualTo(SkipReason.NEGATIVE_ALERT)
        assertThat(otp.skipReason).isEqualTo(SkipReason.OTP_MATCH)
        assertThat(declined.skipReason).isEqualTo(SkipReason.NEGATIVE_ALERT)
        assertThat(creditOnly.skipReason).isEqualTo(SkipReason.NOT_DEBIT)
    }
}
