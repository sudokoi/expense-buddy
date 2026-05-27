package expo.modules.expensebuddybackgroundsms

import android.telephony.SmsMessage
import com.google.common.truth.Truth.assertThat
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.shadows.ShadowSmsMessage

@RunWith(RobolectricTestRunner::class)
class BackgroundSmsParserTest {
    @Test
    fun `parse valid debit SMS`() {
        val msg = smsMessage("BANK", "Your account has been debited with INR 1,500.00 at MERCHANT on 01-Jan-25")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNotNull()
        assertThat(result!!.amount).isEqualTo(1500.00)
        assertThat(result.merchantName).isEqualTo("MERCHANT")
        assertThat(result.currency).isEqualTo("INR")
        assertThat(result.sourceMessage.sender).isEqualTo("BANK")
    }

    @Test
    fun `parse UPI debit SMS`() {
        val msg = smsMessage("UPIBANK", "Rs.250.00 debited from a/c XX1234 via UPI at STORE on 05-Feb-25")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNotNull()
        assertThat(result!!.amount).isEqualTo(250.00)
        assertThat(result.paymentMethodSuggestion?.type).isEqualTo("UPI")
    }

    @Test
    fun `skip OTP SMS`() {
        val msg = smsMessage("BANK", "Your OTP for transaction is 123456. Do not share this code.")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNull()
    }

    @Test
    fun `skip credit-only SMS`() {
        val msg = smsMessage("BANK", "Your account has been credited with INR 5,000.00")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNull()
    }

    @Test
    fun `skip non-expense info SMS`() {
        val msg = smsMessage("BANK", "Your available balance is INR 10,000.00")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNull()
    }

    @Test
    fun `skip failed transaction SMS`() {
        val msg = smsMessage("BANK", "Your transaction of INR 500.00 was declined due to insufficient funds")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNull()
    }

    @Test
    fun `return null for empty messages`() {
        val result = BackgroundSmsParser.parseIncomingMessage(emptyArray())

        assertThat(result).isNull()
    }

    @Test
    fun `infer category from merchant`() {
        val msg = smsMessage("SWIGGY", "INR 349.00 debited from a/c XX1234 at SWIGGY on 01-Mar-25")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNotNull()
        assertThat(result!!.categorySuggestion).isEqualTo("Food")
    }

    @Test
    fun `infer category from body`() {
        val msg = smsMessage("BANK", "Rs.500.00 spent at PETROL PUMP via debit card")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNotNull()
        assertThat(result!!.categorySuggestion).isEqualTo("Transport")
    }

    @Test
    fun `fallback to Other when no category matches`() {
        val msg = smsMessage("BANK", "INR 1,000.00 debited at UNKNOWN_MERCHANT_XYZ")

        val result = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg))

        assertThat(result).isNotNull()
        assertThat(result!!.categorySuggestion).isEqualTo("Other")
    }

    @Test
    fun `create deterministic fingerprint`() {
        val msg1 = smsMessage("BANK", "INR 500.00 debited at STORE on 01-Jan-25")
        val msg2 = smsMessage("BANK", "INR 500.00 debited at STORE on 01-Jan-25")

        val result1 = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg1))
        val result2 = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg2))

        assertThat(result1).isNotNull()
        assertThat(result2).isNotNull()
        assertThat(result1!!.fingerprint).isEqualTo(result2!!.fingerprint)
    }

    @Test
    fun `different amounts produce different fingerprints`() {
        val msg1 = smsMessage("BANK", "INR 500.00 debited at STORE on 01-Jan-25")
        val msg2 = smsMessage("BANK", "INR 501.00 debited at STORE on 01-Jan-25")

        val result1 = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg1))
        val result2 = BackgroundSmsParser.parseIncomingMessage(arrayOf(msg2))

        assertThat(result1).isNotNull()
        assertThat(result2).isNotNull()
        assertThat(result1!!.fingerprint).isNotEqualTo(result2!!.fingerprint)
    }

    private fun smsMessage(
        sender: String,
        body: String,
    ): SmsMessage {
        val msg =
            ShadowSmsMessage.newSmsMessage(
                originatingAddress = sender,
                messageBody = body,
            )
        return msg
    }
}
