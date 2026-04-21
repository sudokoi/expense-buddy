package expo.modules.expensebuddyplaycore

import android.app.Activity
import android.content.IntentSender.SendIntentException
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.events.OnActivityResultPayload
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.ActivityResult as PlayActivityResult
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability
import com.google.android.play.core.review.ReviewManagerFactory

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

  private val installStateListener = InstallStateUpdatedListener { state ->
    sendEvent(
      UPDATE_STATUS_EVENT_NAME,
      mapOf(
        "bytesDownloaded" to state.bytesDownloaded().toDouble(),
        "status" to mapInstallStatus(state.installStatus()),
        "totalBytesToDownload" to state.totalBytesToDownload().toDouble(),
      )
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

  override fun definition() = ModuleDefinition {
    Name("ExpenseBuddyPlayCore")

    Events(UPDATE_STATUS_EVENT_NAME)

    AsyncFunction("getUpdateInfoAsync") { promise: Promise ->
      appUpdateManager.appUpdateInfo
        .addOnSuccessListener { appUpdateInfo ->
          promise.resolve(appUpdateInfoToMap(appUpdateInfo))
        }
        .addOnFailureListener { error ->
          promise.reject("ERR_PLAY_STORE_UPDATE_INFO_FAILED", error.message, error)
        }
    }

    AsyncFunction("startFlexibleUpdateAsync") { promise: Promise ->
      startFlexibleUpdate(promise)
    }

    AsyncFunction("completeUpdateAsync") { promise: Promise ->
      appUpdateManager.completeUpdate()
        .addOnSuccessListener {
          promise.resolve(null)
        }
        .addOnFailureListener { error ->
          promise.reject("ERR_PLAY_STORE_UPDATE_COMPLETE_FAILED", error.message, error)
        }
    }

    AsyncFunction("requestReviewAsync") { promise: Promise ->
      requestReview(promise)
    }

    OnActivityResult { _: Activity, payload: OnActivityResultPayload ->
      handleActivityResult(payload)
    }

    OnDestroy {
      unregisterInstallStateListener()
    }
  }

  private fun startFlexibleUpdate(promise: Promise) {
    val activity = appContext.currentActivity ?: run {
      promise.reject(PlayCoreCurrentActivityUnavailableException())
      return
    }

    appUpdateManager.appUpdateInfo
      .addOnSuccessListener { appUpdateInfo ->
        val availability = appUpdateInfo.updateAvailability()
        val isAvailable =
          availability == UpdateAvailability.UPDATE_AVAILABLE ||
            availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS

        if (!isAvailable || !appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
          promise.reject(
            CodedException(
              code = "ERR_PLAY_STORE_UPDATE_NOT_AVAILABLE",
              message = "No flexible Play Store update is currently available.",
              cause = null,
            )
          )
          return@addOnSuccessListener
        }

        registerInstallStateListener()

        try {
          val started =
            appUpdateManager.startUpdateFlowForResult(
              appUpdateInfo,
              activity,
              AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build(),
              UPDATE_REQUEST_CODE,
            )

          if (started) {
            promise.resolve(null)
          } else {
            unregisterInstallStateListener()
            promise.reject(
              CodedException(
                code = "ERR_PLAY_STORE_UPDATE_NOT_STARTED",
                message = "Play Store update flow did not start.",
                cause = null,
              )
            )
          }
        } catch (error: SendIntentException) {
          unregisterInstallStateListener()
          promise.reject("ERR_PLAY_STORE_UPDATE_INTENT_FAILED", error.message, error)
        } catch (error: Exception) {
          unregisterInstallStateListener()
          promise.reject("ERR_PLAY_STORE_UPDATE_START_FAILED", error.message, error)
        }
      }
      .addOnFailureListener { error ->
        unregisterInstallStateListener()
        promise.reject("ERR_PLAY_STORE_UPDATE_START_FAILED", error.message, error)
      }
  }

  private fun requestReview(promise: Promise) {
    val activity = appContext.currentActivity ?: run {
      promise.reject(PlayCoreCurrentActivityUnavailableException())
      return
    }

    val reviewManager = ReviewManagerFactory.create(reactContext)
    reviewManager.requestReviewFlow()
      .addOnSuccessListener { reviewInfo ->
        reviewManager.launchReviewFlow(activity, reviewInfo)
          .addOnCompleteListener {
            promise.resolve(null)
          }
          .addOnFailureListener { error ->
            promise.reject("ERR_PLAY_STORE_REVIEW_FLOW_FAILED", error.message, error)
          }
      }
      .addOnFailureListener { error ->
        promise.reject("ERR_PLAY_STORE_REVIEW_REQUEST_FAILED", error.message, error)
      }
  }

  private fun handleActivityResult(payload: OnActivityResultPayload) {
    if (payload.requestCode != UPDATE_REQUEST_CODE) {
      return
    }

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

    appUpdateManager.registerListener(installStateListener)
    isInstallStateListenerRegistered = true
  }

  private fun unregisterInstallStateListener() {
    if (!isInstallStateListenerRegistered) {
      return
    }

    appUpdateManager.unregisterListener(installStateListener)
    isInstallStateListenerRegistered = false
  }

  private fun appUpdateInfoToMap(appUpdateInfo: AppUpdateInfo): Map<String, Any?> {
    return mapOf(
      "availableVersionCode" to appUpdateInfo.availableVersionCode(),
      "clientVersionStalenessDays" to appUpdateInfo.clientVersionStalenessDays(),
      "installStatus" to mapInstallStatus(appUpdateInfo.installStatus()),
      "isFlexibleUpdateAllowed" to appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE),
      "isImmediateUpdateAllowed" to appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
      "updateAvailability" to mapUpdateAvailability(appUpdateInfo.updateAvailability()),
      "updatePriority" to appUpdateInfo.updatePriority(),
    )
  }

  private fun mapUpdateAvailability(availability: Int): String {
    return when (availability) {
      UpdateAvailability.UPDATE_AVAILABLE -> "available"
      UpdateAvailability.UPDATE_NOT_AVAILABLE -> "not_available"
      UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "in_progress"
      else -> "unknown"
    }
  }

  private fun mapInstallStatus(status: Int): String {
    return when (status) {
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
}