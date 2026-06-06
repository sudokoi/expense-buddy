package expo.modules.expensebuddyplaycore

import android.app.Activity
import android.content.IntentSender.SendIntentException
import android.util.Log
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.review.ReviewManagerFactory
import expo.modules.kotlin.Promise
import expo.modules.kotlin.events.OnActivityResultPayload
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.android.play.core.install.model.ActivityResult as PlayActivityResult

private const val UPDATE_REQUEST_CODE = 31027
private const val UPDATE_STATUS_EVENT_NAME = "onUpdateStatus"

class PlayCoreContextLostException :
    CodedException(
        code = "ERR_PLAY_CORE_CONTEXT_LOST",
        message = "React context is not available.",
        cause = null,
    )

class PlayCoreCurrentActivityUnavailableException :
    CodedException(
        code = "ERR_PLAY_CORE_NO_ACTIVITY",
        message = "No foreground activity is available.",
        cause = null,
    )

class ExpenseBuddyPlayCoreModule : Module() {
    private val reactContext
        get() = appContext.reactContext ?: throw PlayCoreContextLostException()

    private val appUpdateManager: AppUpdateManager by lazy {
        AppUpdateManagerFactory.create(reactContext)
    }

    private var isInstallStateListenerRegistered = false

    private val installStateListener =
        InstallStateUpdatedListener { state ->
            val status = mapInstallStatus(state.installStatus())
            val bytes = state.bytesDownloaded()
            val total = state.totalBytesToDownload()
            Log.d("PLAY_CORE", "installStateUpdate status=$status bytesDownloaded=$bytes/$total")
            sendEvent(
                UPDATE_STATUS_EVENT_NAME,
                mapOf(
                    "bytesDownloaded" to bytes.toDouble(),
                    "status" to status,
                    "totalBytesToDownload" to total.toDouble(),
                ),
            )

            if (
                state.installStatus() == InstallStatus.DOWNLOADED ||
                state.installStatus() == InstallStatus.INSTALLED ||
                state.installStatus() == InstallStatus.CANCELED ||
                state.installStatus() == InstallStatus.FAILED
            ) {
                unregisterInstallStateListener()
            }
        }

    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyPlayCore")

            Events(UPDATE_STATUS_EVENT_NAME)

            AsyncFunction("getUpdateInfoAsync") { promise: Promise ->
                appUpdateManager.appUpdateInfo
                    .addOnSuccessListener { appUpdateInfo ->
                        val availability = appUpdateInfo.updateAvailability()
                        Log.d("PLAY_CORE", "getUpdateInfoAsync success availability=$availability")
                        promise.resolve(appUpdateInfoToMap(appUpdateInfo))
                    }.addOnFailureListener { error ->
                        Log.e("PLAY_CORE", "getUpdateInfoAsync failed: ${error.message}")
                        promise.reject("ERR_PLAY_STORE_UPDATE_INFO_FAILED", error.message, error)
                    }
            }

            AsyncFunction("startFlexibleUpdateAsync") { promise: Promise ->
                Log.d("PLAY_CORE", "startFlexibleUpdateAsync")
                startUpdate(promise, AppUpdateType.FLEXIBLE)
            }

            AsyncFunction("startImmediateUpdateAsync") { promise: Promise ->
                Log.d("PLAY_CORE", "startImmediateUpdateAsync")
                startUpdate(promise, AppUpdateType.IMMEDIATE)
            }

            AsyncFunction("completeUpdateAsync") { promise: Promise ->
                appUpdateManager
                    .completeUpdate()
                    .addOnSuccessListener {
                        Log.d("PLAY_CORE", "completeUpdateAsync success")
                        promise.resolve(null)
                    }.addOnFailureListener { error ->
                        Log.e("PLAY_CORE", "completeUpdateAsync failed: ${error.message}")
                        promise.reject("ERR_PLAY_STORE_UPDATE_COMPLETE_FAILED", error.message, error)
                    }
            }

            AsyncFunction("requestReviewAsync") { promise: Promise ->
                Log.d("PLAY_CORE", "requestReviewAsync")
                requestReview(promise)
            }

            OnActivityResult { _: Activity, payload: OnActivityResultPayload ->
                handleActivityResult(payload)
            }

            OnDestroy {
                unregisterInstallStateListener()
            }
        }

    private fun startUpdate(
        promise: Promise,
        updateType: Int,
    ) {
        val activity =
            appContext.currentActivity ?: run {
                Log.w("PLAY_CORE", "startUpdate failed: no foreground activity")
                promise.reject(PlayCoreCurrentActivityUnavailableException())
                return
            }

        appUpdateManager.appUpdateInfo
            .addOnSuccessListener { appUpdateInfo ->
                val availability = appUpdateInfo.updateAvailability()
                val isAvailable =
                    availability == UpdateAvailability.UPDATE_AVAILABLE ||
                        availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS

                val updateTypeLabel =
                    if (updateType == AppUpdateType.IMMEDIATE) "immediate" else "flexible"

                val allowedFlexible = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
                val allowedImmediate = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)
                Log.d(
                    "PLAY_CORE",
                    "startUpdate type=$updateTypeLabel availability=$availability isAvailable=$isAvailable allowedFlexible=$allowedFlexible allowedImmediate=$allowedImmediate",
                )

                if (!isAvailable || !appUpdateInfo.isUpdateTypeAllowed(updateType)) {
                    Log.w("PLAY_CORE", "startUpdate: update not available for type=$updateTypeLabel")
                    promise.reject(
                        CodedException(
                            code = "ERR_PLAY_STORE_UPDATE_NOT_AVAILABLE",
                            message = "No $updateTypeLabel Play Store update is currently available.",
                            cause = null,
                        ),
                    )
                    return@addOnSuccessListener
                }

                registerInstallStateListener()

                try {
                    val started =
                        appUpdateManager.startUpdateFlowForResult(
                            appUpdateInfo,
                            activity,
                            AppUpdateOptions.newBuilder(updateType).build(),
                            UPDATE_REQUEST_CODE,
                        )

                    Log.d("PLAY_CORE", "startUpdateFlowForResult started=$started")
                    if (started) {
                        promise.resolve(null)
                    } else {
                        unregisterInstallStateListener()
                        Log.w("PLAY_CORE", "startUpdateFlowForResult returned false")
                        promise.reject(
                            CodedException(
                                code = "ERR_PLAY_STORE_UPDATE_NOT_STARTED",
                                message = "Play Store update flow did not start.",
                                cause = null,
                            ),
                        )
                    }
                } catch (error: SendIntentException) {
                    unregisterInstallStateListener()
                    Log.e("PLAY_CORE", "startUpdateFlowForResult SendIntentException: ${error.message}")
                    promise.reject("ERR_PLAY_STORE_UPDATE_INTENT_FAILED", error.message, error)
                } catch (error: Exception) {
                    unregisterInstallStateListener()
                    Log.e("PLAY_CORE", "startUpdateFlowForResult failed: ${error.message}")
                    promise.reject("ERR_PLAY_STORE_UPDATE_START_FAILED", error.message, error)
                }
            }.addOnFailureListener { error ->
                unregisterInstallStateListener()
                Log.e("PLAY_CORE", "startUpdate appUpdateInfo failed: ${error.message}")
                promise.reject("ERR_PLAY_STORE_UPDATE_START_FAILED", error.message, error)
            }
    }

    private fun requestReview(promise: Promise) {
        val activity =
            appContext.currentActivity ?: run {
                Log.w("PLAY_CORE", "requestReview failed: no foreground activity")
                promise.reject(PlayCoreCurrentActivityUnavailableException())
                return
            }

        val reviewManager = ReviewManagerFactory.create(reactContext)
        reviewManager
            .requestReviewFlow()
            .addOnSuccessListener { reviewInfo ->
                Log.d("PLAY_CORE", "requestReviewFlow success, launching review flow")
                reviewManager
                    .launchReviewFlow(activity, reviewInfo)
                    .addOnCompleteListener {
                        Log.d("PLAY_CORE", "launchReviewFlow completed")
                        promise.resolve(null)
                    }.addOnFailureListener { error ->
                        Log.e("PLAY_CORE", "launchReviewFlow failed: ${error.message}")
                        promise.reject("ERR_PLAY_STORE_REVIEW_FLOW_FAILED", error.message, error)
                    }
            }.addOnFailureListener { error ->
                Log.e("PLAY_CORE", "requestReviewFlow failed: ${error.message}")
                promise.reject("ERR_PLAY_STORE_REVIEW_REQUEST_FAILED", error.message, error)
            }
    }

    private fun handleActivityResult(payload: OnActivityResultPayload) {
        if (payload.requestCode != UPDATE_REQUEST_CODE) {
            return
        }

        Log.d("PLAY_CORE", "handleActivityResult resultCode=${payload.resultCode}")
        when (payload.resultCode) {
            Activity.RESULT_OK -> sendEvent(UPDATE_STATUS_EVENT_NAME, mapOf("status" to "accepted"))
            Activity.RESULT_CANCELED -> {
                sendEvent(UPDATE_STATUS_EVENT_NAME, mapOf("status" to "canceled"))
                unregisterInstallStateListener()
            }
            PlayActivityResult.RESULT_IN_APP_UPDATE_FAILED -> {
                sendEvent(UPDATE_STATUS_EVENT_NAME, mapOf("status" to "failed"))
                unregisterInstallStateListener()
            }
            else -> sendEvent(UPDATE_STATUS_EVENT_NAME, mapOf("status" to "unknown"))
        }
    }

    private fun registerInstallStateListener() {
        if (isInstallStateListenerRegistered) {
            return
        }

        Log.d("PLAY_CORE", "registerInstallStateListener")
        appUpdateManager.registerListener(installStateListener)
        isInstallStateListenerRegistered = true
    }

    private fun unregisterInstallStateListener() {
        if (!isInstallStateListenerRegistered) {
            return
        }

        Log.d("PLAY_CORE", "unregisterInstallStateListener")
        appUpdateManager.unregisterListener(installStateListener)
        isInstallStateListenerRegistered = false
    }

    private fun appUpdateInfoToMap(appUpdateInfo: AppUpdateInfo): Map<String, Any?> =
        mapOf(
            "availableVersionCode" to appUpdateInfo.availableVersionCode(),
            "clientVersionStalenessDays" to appUpdateInfo.clientVersionStalenessDays(),
            "installStatus" to mapInstallStatus(appUpdateInfo.installStatus()),
            "isFlexibleUpdateAllowed" to appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
            "isImmediateUpdateAllowed" to appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
            "updateAvailability" to mapUpdateAvailability(appUpdateInfo.updateAvailability()),
            "updatePriority" to appUpdateInfo.updatePriority(),
        )

    private fun mapUpdateAvailability(availability: Int): String =
        when (availability) {
            UpdateAvailability.UPDATE_AVAILABLE -> "available"
            UpdateAvailability.UPDATE_NOT_AVAILABLE -> "not_available"
            UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "in_progress"
            else -> "unknown"
        }

    private fun mapInstallStatus(status: Int): String =
        when (status) {
            InstallStatus.PENDING -> "pending"
            InstallStatus.DOWNLOADING -> "downloading"
            InstallStatus.DOWNLOADED -> "downloaded"
            InstallStatus.INSTALLING -> "installing"
            InstallStatus.INSTALLED -> "installed"
            InstallStatus.FAILED -> "failed"
            InstallStatus.CANCELED -> "canceled"
            InstallStatus.REQUIRES_UI_INTENT -> "requires_ui_intent"
            else -> "unknown"
        }
}
