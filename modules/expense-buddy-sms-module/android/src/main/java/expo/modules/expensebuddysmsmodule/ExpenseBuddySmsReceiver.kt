package expo.modules.expensebuddysmsmodule

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import expo.modules.expensebuddylogger.LoggerApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeout

class ExpenseBuddySmsReceiver : BroadcastReceiver() {
    companion object {
        private val receiverScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    }

    override fun onReceive(
        context: Context,
        intent: Intent,
    ) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        if (!BackgroundSmsPreferences.getState(context).enabled) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) {
            LoggerApi.d("SMS_RECEIVER", "SMS received but no messages parsed from intent")
            return
        }

        val reviewItem = BackgroundSmsParser.parseIncomingMessage(messages)
        if (reviewItem == null) {
            LoggerApi.d("SMS_RECEIVER", "SMS received but did not match any transaction pattern")
            return
        }

        LoggerApi.d("SMS_RECEIVER", "SMS matched: sender=${reviewItem.sourceMessage.sender} fingerprint=${reviewItem.fingerprint}")

        val pendingResult = goAsync()
        receiverScope.launch {
            try {
                withTimeout(8000L) {
                    val repo = SmsReviewQueueRepository(context)
                    val entity =
                        repo.toReviewQueueEntity(
                            reviewItem,
                            SmsReviewQueueRepository.SOURCE_SMS_RECEIVED,
                        )
                    val inserted = repo.upsertItem(entity, SmsReviewQueueRepository.SOURCE_SMS_RECEIVED)
                    LoggerApi.d("SMS_RECEIVER", "Upsert result: inserted=$inserted fingerprint=${reviewItem.fingerprint}")

                    if (inserted && !BackgroundSmsAppState.isAppForeground()) {
                        val pendingItems = repo.getPendingItems()
                        BackgroundSmsNotificationManager.showPendingItemsNotification(
                            context = context,
                            pendingItems = pendingItems,
                            insertedItemFingerprint = reviewItem.fingerprint,
                        )
                        LoggerApi.d(
                            "SMS_RECEIVER",
                            "Notification shown for fingerprint=${reviewItem.fingerprint} pendingCount=${pendingItems.size}",
                        )
                    }
                }
            } catch (e: Exception) {
                LoggerApi.e("SMS_RECEIVER", "Failed to process incoming SMS", e)
            } finally {
                pendingResult.finish()
            }
        }
    }
}
