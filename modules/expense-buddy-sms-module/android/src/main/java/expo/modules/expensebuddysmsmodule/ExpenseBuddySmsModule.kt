package expo.modules.expensebuddysmsmodule

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.expensebuddysmsparser.SmsCategoryLiteRtClassifier
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean

class BackgroundSmsContextLostException : CodedException("ERR_BACKGROUND_SMS_CONTEXT_LOST", "React context is not available.", null)

class SmsPermissionMissingException :
    CodedException("ERR_SMS_PERMISSION_MISSING", "READ_SMS permission is required to scan SMS messages.", null)

class ExpenseBuddySmsModule : Module() {
    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var observer: Job? = null
    private val isSyncing = AtomicBoolean(false)
    private val context get() = appContext.reactContext?.applicationContext ?: throw BackgroundSmsContextLostException()

    private fun repository() = SmsReviewQueueRepository(context)

    @Synchronized
    private fun startQueueObserver() {
        if (observer?.isActive == true) return
        val repo = repository()
        observer =
            moduleScope.launch {
                try {
                    repo.observeChanges().collect { sendEvent("onReviewQueueUpdated") }
                } catch (error: CancellationException) {
                    throw error
                } catch (error: Exception) {
                    LoggerApi.e("SMS_MODULE", "Queue observation failed", error)
                }
            }
    }

    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddySms")
            Events("onReviewQueueUpdated")
            AsyncFunction("getPermissionStatusAsync") { promise: expo.modules.kotlin.Promise ->
                Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.READ_SMS)
            }
            AsyncFunction("requestPermissionAsync") { promise: expo.modules.kotlin.Promise ->
                Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.READ_SMS)
            }
            AsyncFunction("getBackgroundSmsStateAsync")
                .SuspendBody<Map<String, Boolean>> {
                    mapOf("enabled" to BackgroundSmsPreferences.getState(context).enabled)
                }.runOnQueue(moduleScope)
            (
                AsyncFunction("setBackgroundSmsEnabledAsync") Coroutine { enabled: Boolean ->
                    BackgroundSmsPreferences.setEnabled(context, enabled)
                }
            ).runOnQueue(moduleScope)
            (
                AsyncFunction("setSmsRegionAsync") Coroutine { region: String ->
                    BackgroundSmsPreferences.setSmsRegion(context, region)
                }
            ).runOnQueue(moduleScope)
            (AsyncFunction("syncInboxAsync") Coroutine { useMlOnly: Boolean -> syncInbox(useMlOnly) }).runOnQueue(moduleScope)
            AsyncFunction("getPendingReviewQueueAsync")
                .SuspendBody<List<Map<String, Any?>>> {
                    startQueueObserver()
                    repository().getPendingItems().map { it.toDto() }
                }.runOnQueue(moduleScope)
            (
                AsyncFunction("approveReviewItemAsync") Coroutine { fingerprint: String ->
                    repository().approveItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
            ).runOnQueue(moduleScope)
            (
                AsyncFunction("rejectReviewItemAsync") Coroutine { fingerprint: String ->
                    repository().rejectItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
            ).runOnQueue(moduleScope)
            (
                AsyncFunction("dismissReviewItemAsync") Coroutine { fingerprint: String ->
                    repository().dismissItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
            ).runOnQueue(moduleScope)
            (
                AsyncFunction("approveItemsAsync") Coroutine { fingerprints: List<String> ->
                    repository().approveItems(fingerprints, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
            ).runOnQueue(moduleScope)
            (
                AsyncFunction("rejectItemsAsync") Coroutine { fingerprints: List<String> ->
                    repository().rejectItems(fingerprints, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
            ).runOnQueue(moduleScope)
            (
                AsyncFunction("dismissItemsAsync") Coroutine { fingerprints: List<String> ->
                    repository().dismissItems(fingerprints, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
            ).runOnQueue(moduleScope)
            AsyncFunction("dismissNotificationAsync")
                .SuspendBody<Unit> {
                    BackgroundSmsNotificationManager.dismissNotification(context)
                }.runOnQueue(moduleScope)
            OnDestroy { moduleScope.cancel() }
        }

    private suspend fun syncInbox(useMlOnly: Boolean): Int {
        startQueueObserver()
        if (!isSyncing.compareAndSet(false, true)) return 0
        try {
            val app = context
            if (ContextCompat.checkSelfPermission(app, Manifest.permission.READ_SMS) !=
                PackageManager.PERMISSION_GRANTED
            ) {
                throw SmsPermissionMissingException()
            }
            val repo = SmsReviewQueueRepository(app)
            val scanner = SmsInboxScanner(app)
            val until = System.currentTimeMillis()
            val region = BackgroundSmsPreferences.getSmsRegion(app)
            var position = BackgroundSmsPreferences.getScanPosition(app, region)
            var inserted = 0
            // Drain a fixed seven-day window in bounded pages, not just its first 500 SMS.
            while (true) {
                val page =
                    scanner.scan(position, until, region, useMlOnly) {
                        try {
                            SmsCategoryLiteRtClassifier.getInstance(app)
                        } catch (error: Exception) {
                            LoggerApi.w("SMS_MODULE", "Classifier unavailable: ${error.javaClass.simpleName}")
                            null
                        }
                    }
                val next = page.position ?: break
                inserted +=
                    repo.upsertItems(
                        page.items.map { repo.toReviewQueueEntity(it, SmsReviewQueueRepository.SOURCE_JS_ACTION) },
                        SmsReviewQueueRepository.SOURCE_JS_ACTION,
                    )
                // A failed cursor write replays a page safely through deduplication.
                BackgroundSmsPreferences.setScanPosition(app, next, region)
                position = next
            }
            LoggerApi.i("SMS_MODULE", "Scan completed: inserted=$inserted")
            return inserted
        } finally {
            isSyncing.set(false)
        }
    }
}
