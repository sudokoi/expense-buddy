package expo.modules.expensebuddybackgroundsms

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BackgroundSmsContextLostException :
  CodedException(
    code = "ERR_BACKGROUND_SMS_CONTEXT_LOST",
    message = "React context is not available.",
    cause = null,
  )

class ExpenseBuddyBackgroundSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpenseBuddyBackgroundSms")

    AsyncFunction("getBackgroundSmsStateAsync") {
      val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
      mapOf("enabled" to BackgroundSmsPreferences.getState(reactContext).enabled)
    }

    AsyncFunction("setBackgroundSmsEnabledAsync") { enabled: Boolean ->
      val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
      BackgroundSmsPreferences.setEnabled(reactContext, enabled)
    }

    AsyncFunction("getReviewQueueSnapshotJsonAsync") {
      val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
      BackgroundSmsReviewQueueStore.exportSnapshotJson(reactContext)
    }

    AsyncFunction("replaceReviewQueueSnapshotJsonAsync") { snapshotJson: String ->
      val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
      BackgroundSmsReviewQueueStore.replaceSnapshotJson(reactContext, snapshotJson)
    }
  }
}
