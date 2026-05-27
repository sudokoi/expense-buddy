package expo.modules.expensebuddybackgroundsms

import expo.modules.expensebuddylogger.LoggerApi
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

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

            AsyncFunction("setBackgroundSmsEnabledAsync") { enabled: Boolean ->
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                LoggerApi.d("SMS_MODULE", "setBackgroundSmsEnabledAsync: enabled=$enabled")
                BackgroundSmsPreferences.setEnabled(reactContext, enabled)
            }

            AsyncFunction("getPendingReviewQueueAsync") {
                startQueueObserver()
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                val repo = SmsReviewQueueRepository(reactContext)
                val items = repo.getPendingItems()
                LoggerApi.d("SMS_MODULE", "getPendingReviewQueueAsync: count=${items.size}")
                items.map { it.toDto() }
            }

            AsyncFunction("approveReviewItemAsync") { fingerprint: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "approveReviewItemAsync: fingerprint=$fingerprint")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                val repo = SmsReviewQueueRepository(reactContext)
                repo.approveItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION)
            }

            AsyncFunction("rejectReviewItemAsync") { fingerprint: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "rejectReviewItemAsync: fingerprint=$fingerprint")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                val repo = SmsReviewQueueRepository(reactContext)
                repo.rejectItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION)
            }

            AsyncFunction("dismissReviewItemAsync") { fingerprint: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "dismissReviewItemAsync: fingerprint=$fingerprint")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                val repo = SmsReviewQueueRepository(reactContext)
                repo.dismissItem(fingerprint, SmsReviewQueueRepository.SOURCE_JS_ACTION)
            }

            AsyncFunction("insertPendingItemsAsync") { itemsJson: String ->
                startQueueObserver()
                LoggerApi.d("SMS_MODULE", "insertPendingItemsAsync: itemsJson.length=${itemsJson.length}")
                val reactContext = appContext.reactContext ?: throw BackgroundSmsContextLostException()
                val repo = SmsReviewQueueRepository(reactContext)
                val items = parsePendingItemsJson(itemsJson)
                for (item in items) {
                    val entity = repo.toReviewQueueEntity(item, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                    repo.upsertItem(entity, SmsReviewQueueRepository.SOURCE_JS_ACTION)
                }
                LoggerApi.d("SMS_MODULE", "insertPendingItemsAsync: inserted=${items.size}")
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
                        BackgroundSmsRawMessage(
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
                            BackgroundSmsPaymentMethod(
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
