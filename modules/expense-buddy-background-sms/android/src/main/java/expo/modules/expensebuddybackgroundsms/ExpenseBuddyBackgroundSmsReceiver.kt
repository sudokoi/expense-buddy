package expo.modules.expensebuddybackgroundsms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

class ExpenseBuddyBackgroundSmsReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
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
    val upsertResult = BackgroundSmsReviewQueueStore.upsertPendingItem(context, reviewItem)
    if (!upsertResult.inserted || BackgroundSmsAppState.isAppForeground()) {
      return
    }

    BackgroundSmsNotificationManager.showPendingItemsNotification(
      context = context,
      snapshot = upsertResult.snapshot,
      insertedItemId = reviewItem.id,
    )
  }
}
