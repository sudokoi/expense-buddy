package expo.modules.expensebuddybackgroundsms

import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import org.json.JSONArray
import org.json.JSONObject

private const val PREFS_NAME = "expense_buddy_background_sms"
private const val ENABLED_KEY = "enabled"
private const val REVIEW_QUEUE_SNAPSHOT_KEY = "review_queue_snapshot_json"

object BackgroundSmsPreferences {
  fun getState(context: Context): BackgroundSmsState {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    return BackgroundSmsState(
      enabled =
        prefs.getBoolean(ENABLED_KEY, false) &&
          BackgroundSmsReceiverComponent.isEnabled(context)
    )
  }

  fun setEnabled(context: Context, enabled: Boolean) {
    BackgroundSmsReceiverComponent.setEnabled(context, enabled)
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(ENABLED_KEY, enabled)
      .apply()
  }
}

private object BackgroundSmsReceiverComponent {
  fun isEnabled(context: Context): Boolean {
    val componentState = context.packageManager.getComponentEnabledSetting(componentName(context))
    return componentState == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
  }

  fun setEnabled(context: Context, enabled: Boolean) {
    val targetState =
      if (enabled) {
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED
      } else {
        PackageManager.COMPONENT_ENABLED_STATE_DISABLED
      }

    context.packageManager.setComponentEnabledSetting(
      componentName(context),
      targetState,
      PackageManager.DONT_KILL_APP,
    )

    check(isEnabled(context) == enabled) {
      "Failed to sync the background SMS receiver component state."
    }
  }

  private fun componentName(context: Context): ComponentName {
    return ComponentName(context, ExpenseBuddyBackgroundSmsReceiver::class.java)
  }
}

object BackgroundSmsReviewQueueStore {
  private val mutex = Mutex()

  fun loadSnapshot(context: Context): BackgroundSmsReviewQueueSnapshot {
    val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    val stored = prefs.getString(REVIEW_QUEUE_SNAPSHOT_KEY, null)
    if (stored.isNullOrBlank()) {
      return BackgroundSmsReviewQueueSnapshot(itemsByFingerprint = emptyMap())
    }

    return try {
      parseSnapshot(JSONObject(stored))
    } catch (_: Throwable) {
      BackgroundSmsReviewQueueSnapshot(itemsByFingerprint = emptyMap())
    }
  }

  fun exportSnapshotJson(context: Context): String {
    return snapshotToJson(loadSnapshot(context)).toString()
  }

  fun replaceSnapshotJson(context: Context, snapshotJson: String) {
    runBlocking {
      mutex.withLock {
        val snapshot = try {
          parseSnapshot(JSONObject(snapshotJson))
        } catch (_: Throwable) {
          BackgroundSmsReviewQueueSnapshot(itemsByFingerprint = emptyMap())
        }

        saveSnapshot(context, snapshot)
      }
    }
  }

  fun upsertPendingItem(
    context: Context,
    item: BackgroundSmsReviewItem,
  ): BackgroundSmsUpsertResult {
    return runBlocking {
      mutex.withLock {
        val current = loadSnapshot(context)
        if (current.itemsByFingerprint.containsKey(item.fingerprint)) {
          return@withLock BackgroundSmsUpsertResult(snapshot = current, inserted = false)
        }

        val merged = normalizeSnapshot(
          current.copy(
            itemsByFingerprint = current.itemsByFingerprint + (item.fingerprint to item),
          )
        )
        saveSnapshot(context, merged)
        BackgroundSmsUpsertResult(snapshot = merged, inserted = true)
      }
    }
  }

  private fun saveSnapshot(context: Context, snapshot: BackgroundSmsReviewQueueSnapshot) {
    val normalized = normalizeSnapshot(snapshot)
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(REVIEW_QUEUE_SNAPSHOT_KEY, snapshotToJson(normalized).toString())
      .apply()
  }

  private fun normalizeSnapshot(snapshot: BackgroundSmsReviewQueueSnapshot): BackgroundSmsReviewQueueSnapshot {
    return snapshot
  }

  private fun parseSnapshot(json: JSONObject): BackgroundSmsReviewQueueSnapshot {
    val itemsJson = json.optJSONArray("items") ?: JSONArray()
    val itemsByFingerprint = mutableMapOf<String, BackgroundSmsReviewItem>()
    for (index in 0 until itemsJson.length()) {
      val itemJson = itemsJson.optJSONObject(index) ?: continue
      val item = parseReviewItem(itemJson)
      itemsByFingerprint[item.fingerprint] = item
    }

    return BackgroundSmsReviewQueueSnapshot(
      itemsByFingerprint = itemsByFingerprint,
      lastScanCursor = json.optNullableString("lastScanCursor"),
      bootstrapCompletedAt = json.optNullableString("bootstrapCompletedAt"),
    )
  }

  private fun parseReviewItem(json: JSONObject): BackgroundSmsReviewItem {
    val sourceMessageJson = json.optJSONObject("sourceMessage") ?: JSONObject()
    val paymentJson = json.optJSONObject("paymentMethodSuggestion")

    return BackgroundSmsReviewItem(
      id = json.optString("id"),
      fingerprint = json.optString("fingerprint"),
      sourceMessage = BackgroundSmsRawMessage(
        messageId = sourceMessageJson.optString("messageId"),
        sender = sourceMessageJson.optString("sender"),
        body = sourceMessageJson.optString("body"),
        receivedAt = sourceMessageJson.optString("receivedAt"),
      ),
      amount = json.optNullableDouble("amount"),
      currency = json.optNullableString("currency"),
      merchantName = json.optNullableString("merchantName"),
      categorySuggestion = json.optNullableString("categorySuggestion"),
      paymentMethodSuggestion = paymentJson?.let {
        BackgroundSmsPaymentMethod(
          type = it.optString("type"),
          identifier = it.optNullableString("identifier"),
          instrumentId = it.optNullableString("instrumentId"),
        )
      },
      noteSuggestion = json.optNullableString("noteSuggestion"),
      transactionDate = json.optNullableString("transactionDate"),
      matchedLocale = json.optNullableString("matchedLocale"),
      matchedPatternKey = json.optNullableString("matchedPatternKey"),
      status = json.optString("status", "pending"),
      acceptedExpenseId = json.optNullableString("acceptedExpenseId"),
      createdAt = json.optString("createdAt"),
      updatedAt = json.optString("updatedAt"),
    )
  }

  private fun snapshotToJson(snapshot: BackgroundSmsReviewQueueSnapshot): JSONObject {
    return JSONObject().apply {
      put("items", JSONArray().apply {
        snapshot.items.forEach { item -> put(reviewItemToJson(item)) }
      })
      put("lastScanCursor", snapshot.lastScanCursor)
      put("bootstrapCompletedAt", snapshot.bootstrapCompletedAt)
    }
  }

  private fun reviewItemToJson(item: BackgroundSmsReviewItem): JSONObject {
    return JSONObject().apply {
      put("id", item.id)
      put("fingerprint", item.fingerprint)
      put(
        "sourceMessage",
        JSONObject().apply {
          put("messageId", item.sourceMessage.messageId)
          put("sender", item.sourceMessage.sender)
          put("body", item.sourceMessage.body)
          put("receivedAt", item.sourceMessage.receivedAt)
        }
      )
      put("amount", item.amount)
      put("currency", item.currency)
      put("merchantName", item.merchantName)
      put("categorySuggestion", item.categorySuggestion)
      put(
        "paymentMethodSuggestion",
        item.paymentMethodSuggestion?.let { payment ->
          JSONObject().apply {
            put("type", payment.type)
            put("identifier", payment.identifier)
            put("instrumentId", payment.instrumentId)
          }
        }
      )
      put("noteSuggestion", item.noteSuggestion)
      put("transactionDate", item.transactionDate)
      put("matchedLocale", item.matchedLocale)
      put("matchedPatternKey", item.matchedPatternKey)
      put("status", item.status)
      put("acceptedExpenseId", item.acceptedExpenseId)
      put("createdAt", item.createdAt)
      put("updatedAt", item.updatedAt)
    }
  }
}

private fun JSONObject.optNullableString(key: String): String? {
  return if (isNull(key)) null else optString(key, null)
}

private fun JSONObject.optNullableDouble(key: String): Double? {
  return if (isNull(key) || !has(key)) null else optDouble(key)
}
