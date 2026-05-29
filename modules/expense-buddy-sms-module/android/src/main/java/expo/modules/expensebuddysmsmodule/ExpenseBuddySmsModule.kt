package expo.modules.expensebuddysmsmodule

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.expensebuddysmsparser.SmsCategoryLiteRtClassifier
import expo.modules.expensebuddysmsparser.SmsPaymentMethod
import expo.modules.expensebuddysmsparser.SmsRawMessage
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.concurrent.atomic.AtomicBoolean

private const val READ_SMS_PERMISSION = Manifest.permission.READ_SMS

class BackgroundSmsContextLostException :
    CodedException(
        code = "ERR_BACKGROUND_SMS_CONTEXT_LOST",
        message = "React context is not available.",
        cause = null,
    )

class SmsPermissionMissingException :
    CodedException(
        code = "ERR_SMS_PERMISSION_MISSING",
        message = "READ_SMS permission is required to scan SMS messages.",
        cause = null,
    )

class ExpenseBuddySmsModule : Module() {
    private val moduleScope = CoroutineScope(Dispatchers.IO)
    private var observerStarted = false
    private val isSyncing = AtomicBoolean(false)

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
            Name("ExpenseBuddySms")

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

            AsyncFunction("syncInboxAsync") { useMlOnly: Boolean ->
                startQueueObserver()
                if (!isSyncing.compareAndSet(false, true)) {
                    LoggerApi.d("SMS_MODULE", "syncInboxAsync: already syncing, skipping")
                    return@AsyncFunction 0
                }
                try {
                    val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                    ensureSmsPermissionGranted(reactContext)

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

                    // 2. Scan the inbox natively without crossing the JS bridge
                    val scanner = SmsInboxScanner(reactContext)

                    val classifier =
                        try {
                            SmsCategoryLiteRtClassifier
                                .getInstance(reactContext)
                        } catch (e: Exception) {
                            LoggerApi.w("SMS_MODULE", "ML classifier unavailable, falling back to regex-only: ${e.message}")
                            null
                        }
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
                } finally {
                    isSyncing.set(false)
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

    private fun ensureSmsPermissionGranted(context: android.content.Context) {
        val status = ContextCompat.checkSelfPermission(context, READ_SMS_PERMISSION)
        if (status != PackageManager.PERMISSION_GRANTED) {
            throw SmsPermissionMissingException()
        }
    }
}
