package expo.modules.expensebuddybackgroundsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ExpenseBuddyBackgroundSmsReceiver : BroadcastReceiver() {
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
            return
        }

        val reviewItem = BackgroundSmsParser.parseIncomingMessage(messages) ?: return

        val pendingResult = goAsync()
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val repo = SmsReviewQueueRepository(context)
                val entity =
                    repo.toReviewQueueEntity(
                        reviewItem,
                        SmsReviewQueueRepository.SOURCE_SMS_RECEIVED,
                    )
                val inserted = repo.upsertItem(entity, SmsReviewQueueRepository.SOURCE_SMS_RECEIVED)

                if (inserted && !BackgroundSmsAppState.isAppForeground()) {
                    val pendingItems = repo.getPendingItems()
                    BackgroundSmsNotificationManager.showPendingItemsNotification(
                        context = context,
                        pendingItems = pendingItems,
                        insertedItemFingerprint = reviewItem.fingerprint,
                    )
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
