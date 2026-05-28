package expo.modules.expensebuddybackgroundsms

import android.Manifest
import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.expensebuddysmsimport.SmsPaymentMethod
import expo.modules.expensebuddysmsimport.SmsRawMessage
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

private const val READ_SMS_PERMISSION = Manifest.permission.READ_SMS

class BackgroundSmsContextLostException :
    CodedException(
        code = "ERR_BACKGROUND_SMS_CONTEXT_LOST",
        message = "React context is not available.",
        cause = null,
    )

class ExpenseBuddyBackgroundSmsModule : Module() {
    private val moduleScope = CoroutineScope(Dispatchers.IO)
    private var observerStarted = false

    private fun startQueueObserver() {
        if (observerStarted) return
        observerStarted = true

        moduleScope.launch {
            try {
                val reactContext = appContext.reactContext ?: return@launch
                val repo = SmsReviewQueueRepository(reactContext)
                repo.observePendingItems().collect {
                    sendEvent("onReviewQueueUpdated")
                }
            } catch (_: Exception) {
                observerStarted = false
            }
        }
    }

    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyBackgroundSms")

            Events("onReviewQueueUpdated")

            AsyncFunction("getBackgroundSmsStateAsync") {
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                val state = BackgroundSmsPreferences.getState(reactContext)
                LoggerApi.d("SMS_MODULE", "getBackgroundSmsStateAsync: enabled=${state.enabled}")
                mapOf("enabled" to state.enabled)
            }

            AsyncFunction("getPermissionStatusAsync") { promise: expo.modules.kotlin.Promise ->
                Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, READ_SMS_PERMISSION)
            }

            AsyncFunction("requestPermissionAsync") { promise: expo.modules.kotlin.Promise ->
                Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, READ_SMS_PERMISSION)
            }

            AsyncFunction("setBackgroundSmsEnabledAsync") { enabled: Boolean ->
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                LoggerApi.d("SMS_MODULE", "setBackgroundSmsEnabledAsync: enabled=$enabled")
                BackgroundSmsPreferences.setEnabled(reactContext, enabled)
            }

            AsyncFunction("getLastScanCursorAsync") {
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                BackgroundSmsPreferences.getLastScanCursor(reactContext)
            }

            AsyncFunction("setLastScanCursorAsync") { cursor: String? ->
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                BackgroundSmsPreferences.setLastScanCursor(reactContext, cursor)
            }

            AsyncFunction("syncInboxAsync") { useMlOnly: Boolean ->
                startQueueObserver()
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()

                // 1. Read the high-water mark cursor
                val cursor = BackgroundSmsPreferences.getLastScanCursor(reactContext)
                val lookbackBound =
                    java.time.Instant
                        .now()
                        .minus(7, java.time.temporal.ChronoUnit.DAYS)
                        .toEpochMilli()

                val sinceBoundMillis =
                    cursor?.let {
                        try {
                            java.time.Instant
                                .parse(it)
                                .toEpochMilli()
                        } catch (_: Exception) {
                            null
                        }
                    }

                val scanSinceMillis =
                    if (sinceBoundMillis != null) {
                        maxOf(lookbackBound, sinceBoundMillis)
                    } else {
                        lookbackBound
                    }

                LoggerApi.d("SMS_MODULE", "syncInboxAsync: started since=$scanSinceMillis")
                val startTimeMs = System.currentTimeMillis()

                try {
                    // 2. Scan the inbox natively without crossing the JS bridge
                    val scanner = SmsInboxScanner(reactContext)

                    val classifier =
                        expo.modules.expensebuddysmsimport.SmsCategoryLiteRtClassifier
                            .getInstance(reactContext)
                    val parsedResults =
                        scanner.scanAndParseMessages(
                            sinceTimestampMillis = scanSinceMillis,
                            limit = 500,
                            classifier = classifier,
                            useMlOnly = useMlOnly,
                        )

                    LoggerApi.d("SMS_MODULE", "syncInboxAsync: scanned ${parsedResults.size} messages since $cursor")

                    // 3. Insert parsed results into the queue database
                    val repo = SmsReviewQueueRepository(reactContext)
                    var latestReceivedAt: Long = -1

                    runBlocking(Dispatchers.IO) {
                        for (parsed in parsedResults) {
                            // Construct the queue item manually
                            val receivedAtStr = parsed["receivedAt"] as? String ?: continue
                            val receivedAtMillis =
                                java.time.Instant
                                    .parse(receivedAtStr)
                                    .toEpochMilli()
                            if (receivedAtMillis > latestReceivedAt) {
                                latestReceivedAt = receivedAtMillis
                            }

                            val item =
                                BackgroundSmsReviewItem(
                                    id = "${parsed["fingerprint"]}_${parsed["messageId"]}",
                                    fingerprint = parsed["fingerprint"] as String,
                                    sourceMessage =
                                        SmsRawMessage(
                                            messageId = parsed["messageId"] as String,
                                            sender = parsed["sender"] as String,
                                            body = parsed["body"] as String,
                                            receivedAt = receivedAtStr,
                                        ),
                                    amount = (parsed["amount"] as? Number)?.toDouble(),
                                    currency = parsed["currency"] as? String,
                                    merchantName = parsed["merchantName"] as? String,
                                    categorySuggestion = parsed["categorySuggestion"] as? String,
                                    paymentMethodSuggestion =
                                        (parsed["paymentMethodType"] as? String)?.let { type ->
                                            SmsPaymentMethod(
                                                type = type,
                                                identifier = parsed["paymentMethodIdentifier"] as? String,
                                                instrumentId = parsed["paymentMethodInstrumentId"] as? String,
                                            )
                                        },
                                    noteSuggestion = parsed["noteSuggestion"] as? String,
                                    transactionDate = parsed["transactionDate"] as? String,
                                    matchedLocale = parsed["matchedLocale"] as? String,
                                    matchedPatternKey = parsed["matchedPatternKey"] as? String,
                                    status = "pending",
                                    acceptedExpenseId = null,
                                    createdAt =
                                        java.time.Instant
                                            .now()
                                            .toString(),
                                    updatedAt =
                                        java.time.Instant
                                            .now()
                                            .toString(),
                                )

                            val entity = repo.toReviewQueueEntity(item, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                            repo.upsertItem(entity, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                        }
                    }

                    // 4. Update the high-water mark cursor
                    if (latestReceivedAt > 0) {
                        // We use Math.max(0, latestReceivedAt - 1) to match the JS behavior
                        val nextCursor =
                            java.time.Instant
                                .ofEpochMilli(kotlin.math.max(latestReceivedAt - 1, 0))
                                .toString()
                        BackgroundSmsPreferences.setLastScanCursor(reactContext, nextCursor)
                    }

                    val durationMs = System.currentTimeMillis() - startTimeMs
                    LoggerApi.d("SMS_MODULE", "syncInboxAsync: completed in ${durationMs}ms with ${parsedResults.size} parsed items")

                    parsedResults.size
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "syncInboxAsync: failed", e)
                    throw e
                }
            }

            AsyncFunction("getPendingReviewQueueAsync") {
                startQueueObserver()
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    val items = runBlocking(Dispatchers.IO) { repo.getPendingItems() }
                    LoggerApi.d("SMS_MODULE", "getPendingReviewQueueAsync: count=${items.size}")
                    items.map { it.toDto() }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "getPendingReviewQueueAsync: failed", e)
                    throw e
                }
            }

            AsyncFunction("approveReviewItemAsync") { fingerprint: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "approveReviewItemAsync: fingerprint=$fingerprint")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    runBlocking(Dispatchers.IO) { repo.approveItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION) }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "approveReviewItemAsync: failed for fingerprint=$fingerprint", e)
                    throw e
                }
            }

            AsyncFunction("rejectReviewItemAsync") { fingerprint: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "rejectReviewItemAsync: fingerprint=$fingerprint")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    runBlocking(Dispatchers.IO) { repo.rejectItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION) }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "rejectReviewItemAsync: failed for fingerprint=$fingerprint", e)
                    throw e
                }
            }

            AsyncFunction("dismissReviewItemAsync") { fingerprint: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "dismissReviewItemAsync: fingerprint=$fingerprint")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    runBlocking(Dispatchers.IO) { repo.dismissItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION) }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "dismissReviewItemAsync: failed for fingerprint=$fingerprint", e)
                    throw e
                }
            }

            AsyncFunction("insertPendingItemsAsync") { itemsJson: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "insertPendingItemsAsync: itemsJson.length=${itemsJson.length}")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    val items = parsePendingItemsJson(itemsJson)
                    runBlocking(Dispatchers.IO) {
                        for (item in items) {
                            val entity = repo.toReviewQueueEntity(item, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                            repo.upsertItem(entity, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                        }
                    }
                    LoggerApi.d("SMS_MODULE", "insertPendingItemsAsync: inserted=${items.size}")
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "insertPendingItemsAsync: failed", e)
                    throw e
                }
            }

            AsyncFunction("approveItemsAsync") { fingerprints: List<String> ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "approveItemsAsync: count=${fingerprints.size}")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    runBlocking(Dispatchers.IO) {
                        for (fp in fingerprints) {
                            repo.approveItem(fp, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                        }
                    }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "approveItemsAsync: failed", e)
                    throw e
                }
            }

            AsyncFunction("rejectItemsAsync") { fingerprints: List<String> ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "rejectItemsAsync: count=${fingerprints.size}")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    runBlocking(Dispatchers.IO) {
                        for (fp in fingerprints) {
                            repo.rejectItem(fp, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                        }
                    }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "rejectItemsAsync: failed", e)
                    throw e
                }
            }

            AsyncFunction("dismissItemsAsync") { fingerprints: List<String> ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "dismissItemsAsync: count=${fingerprints.size}")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                try {
                    val repo = SmsReviewQueueRepository(reactContext)
                    runBlocking(Dispatchers.IO) {
                        for (fp in fingerprints) {
                            repo.dismissItem(fp, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                        }
                    }
                } catch (e: Exception) {
                    LoggerApi.e("SMS_MODULE", "dismissItemsAsync: failed", e)
                    throw e
                }
            }

            OnDestroy {
                moduleScope.cancel()
            }
        }

    private fun parsePendingItemsJson(json: String): List<BackgroundSmsReviewItem> =
        try {
            val arr = org.json.JSONArray(json)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                BackgroundSmsReviewItem(
                    id = obj.optString("id"),
                    fingerprint = obj.optString("fingerprint"),
                    sourceMessage =
                        SmsRawMessage(
                            messageId = obj.getJSONObject("sourceMessage").optString("messageId"),
                            sender = obj.getJSONObject("sourceMessage").optString("sender"),
                            body = obj.getJSONObject("sourceMessage").optString("body"),
                            receivedAt = obj.getJSONObject("sourceMessage").optString("receivedAt"),
                        ),
                    amount = if (obj.has("amount") && !obj.isNull("amount")) obj.getDouble("amount") else null,
                    currency = obj.optNullableString("currency"),
                    merchantName = obj.optNullableString("merchantName"),
                    categorySuggestion = obj.optNullableString("categorySuggestion"),
                    paymentMethodSuggestion =
                        obj.optJSONObject("paymentMethodSuggestion")?.let {
                            SmsPaymentMethod(
                                type = it.optString("type"),
                                identifier = it.optNullableString("identifier"),
                                instrumentId = it.optNullableString("instrumentId"),
                            )
                        },
                    noteSuggestion = obj.optNullableString("noteSuggestion"),
                    transactionDate = obj.optNullableString("transactionDate"),
                    matchedLocale = obj.optNullableString("matchedLocale"),
                    matchedPatternKey = obj.optNullableString("matchedPatternKey"),
                    status = obj.optString("status", "pending"),
                    acceptedExpenseId = obj.optNullableString("acceptedExpenseId"),
                    createdAt = obj.optString("createdAt"),
                    updatedAt = obj.optString("updatedAt"),
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
}
