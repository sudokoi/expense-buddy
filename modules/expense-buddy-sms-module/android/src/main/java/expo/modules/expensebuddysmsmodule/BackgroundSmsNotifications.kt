package expo.modules.expensebuddysmsmodule

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.expensebuddysmsmodule.db.ReviewQueueEntity

private const val TRANSACTION_IMPORT_NOTIFICATION_ID = 44021
private const val TRANSACTION_IMPORT_CHANNEL_ID = "transaction_imports"
private const val APP_SCHEME = "myapp"

object BackgroundSmsAppState {
    fun isAppForeground(): Boolean =
        ProcessLifecycleOwner
            .get()
            .lifecycle.currentState
            .isAtLeast(Lifecycle.State.STARTED)
}

object BackgroundSmsNotificationManager {
    fun showPendingItemsNotification(
        context: Context,
        pendingItems: List<ReviewQueueEntity>,
        insertedItemFingerprint: String,
    ) {
        if (pendingItems.isEmpty() || !hasNotificationPermission(context)) {
            return
        }

        ensureChannel(context)

        val itemId = if (pendingItems.size == 1) insertedItemFingerprint else null
        val uri = buildReviewUri(itemId)
        val pendingIntent =
            PendingIntent.getActivity(
                context,
                0,
                Intent(Intent.ACTION_VIEW, uri).apply {
                    `package` = context.packageName
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

        val notificationText =
            if (pendingItems.size == 1) {
                val item = pendingItems.first()
                item.merchantName ?: item.sender.ifBlank { "New SMS transaction ready to review" }
            } else {
                "${pendingItems.size} SMS transactions are ready to review."
            }

        val notificationTitle =
            if (pendingItems.size == 1) {
                "Transaction ready to import"
            } else {
                "Review pending SMS transactions"
            }

        val builder =
            NotificationCompat
                .Builder(context, TRANSACTION_IMPORT_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(notificationTitle)
                .setContentText(notificationText)
                .setStyle(NotificationCompat.BigTextStyle().bigText(notificationText))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setContentIntent(pendingIntent)
                .setNumber(pendingItems.size)

        NotificationManagerCompat.from(context).notify(TRANSACTION_IMPORT_NOTIFICATION_ID, builder.build())
        LoggerApi.d("SMS_NOTIF", "Notification shown: pendingCount=${pendingItems.size} itemId=${itemId ?: "none"}")
    }

    private fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val existing = manager.getNotificationChannel(TRANSACTION_IMPORT_CHANNEL_ID)
        if (existing != null) {
            return
        }

        manager.createNotificationChannel(
            NotificationChannel(
                TRANSACTION_IMPORT_CHANNEL_ID,
                "Transaction alerts",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "Background SMS transaction alerts"
            },
        )
    }

    private fun buildReviewUri(itemId: String?): Uri =
        if (itemId.isNullOrBlank()) {
            Uri
                .Builder()
                .scheme(APP_SCHEME)
                .authority("sms")
                .path("review")
                .appendQueryParameter("source", "notification")
                .build()
        } else {
            Uri
                .Builder()
                .scheme(APP_SCHEME)
                .authority("sms")
                .path("review")
                .appendQueryParameter("source", "notification")
                .appendQueryParameter("itemId", itemId)
                .build()
        }

    private fun hasNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return true
        }

        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }
}
