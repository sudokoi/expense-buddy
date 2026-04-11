package expo.modules.expensebuddysmsimport

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import androidx.core.content.ContextCompat
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.time.Instant
import java.time.temporal.ChronoUnit

private const val READ_SMS_PERMISSION = Manifest.permission.READ_SMS

data class SmsImportScanOptionsRecord(
  @Field val since: String? = null,
  @Field val limit: Int? = null,
  @Field val lookbackDays: Int? = null,
) : Record

class SmsPermissionMissingException :
  CodedException(
    code = "ERR_SMS_PERMISSION_MISSING",
    message = "READ_SMS permission is required to scan SMS messages.",
    cause = null,
  )

class InvalidSmsScanOptionsException(message: String) :
  CodedException(
    code = "ERR_SMS_INVALID_SCAN_OPTIONS",
    message = message,
    cause = null,
  )

class SmsImportContextLostException :
  CodedException(
    code = "ERR_SMS_IMPORT_CONTEXT_LOST",
    message = "React context is not available.",
    cause = null,
  )

class ExpenseBuddySmsImportModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpenseBuddySmsImport")

    AsyncFunction("getPermissionStatusAsync") { promise: expo.modules.kotlin.Promise ->
      Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, READ_SMS_PERMISSION)
    }

    AsyncFunction("requestPermissionAsync") { promise: expo.modules.kotlin.Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, READ_SMS_PERMISSION)
    }

    AsyncFunction("scanMessagesAsync") { options: SmsImportScanOptionsRecord ->
      ensurePermissionGranted()
      queryRecentMessages(options)
    }
  }

  private fun ensurePermissionGranted() {
    val reactContext = appContext.reactContext ?: throw SmsImportContextLostException()
    val status = ContextCompat.checkSelfPermission(reactContext, READ_SMS_PERMISSION)
    if (status != PackageManager.PERMISSION_GRANTED) {
      throw SmsPermissionMissingException()
    }
  }

  private fun queryRecentMessages(options: SmsImportScanOptionsRecord): List<Map<String, String>> {
    val reactContext = appContext.reactContext ?: throw SmsImportContextLostException()
    val contentResolver = reactContext.contentResolver
    val lowerBound = resolveLowerBound(options)
    val resultLimit = resolveLimit(options.limit)
    val projection = arrayOf(
      Telephony.Sms._ID,
      Telephony.Sms.ADDRESS,
      Telephony.Sms.BODY,
      Telephony.Sms.DATE,
    )
    val sortOrder = "${Telephony.Sms.DATE} DESC, ${Telephony.Sms._ID} DESC"
    val messages = mutableListOf<Map<String, String>>()

    contentResolver.query(
      Telephony.Sms.Inbox.CONTENT_URI,
      projection,
      lowerBound.selection,
      arrayOf(lowerBound.timestampMillis.toString()),
      sortOrder,
    )?.use { cursor ->
      val idColumn = cursor.getColumnIndexOrThrow(Telephony.Sms._ID)
      val addressColumn = cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
      val bodyColumn = cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)
      val dateColumn = cursor.getColumnIndexOrThrow(Telephony.Sms.DATE)

      while (cursor.moveToNext()) {
        if (resultLimit != null && messages.size >= resultLimit) {
          break
        }

        val messageId = cursor.getLong(idColumn).toString()
        val sender = cursor.getString(addressColumn).orEmpty()
        val body = cursor.getString(bodyColumn).orEmpty()
        val receivedAt = Instant.ofEpochMilli(cursor.getLong(dateColumn)).toString()

        messages.add(
          mapOf(
            "messageId" to messageId,
            "sender" to sender,
            "body" to body,
            "receivedAt" to receivedAt,
          )
        )
      }
    }

    return messages
  }

  private fun resolveLowerBound(options: SmsImportScanOptionsRecord): SmsQueryLowerBound {
    val lookbackDays = options.lookbackDays ?: 7
    if (lookbackDays < 0) {
      throw InvalidSmsScanOptionsException("lookbackDays must be greater than or equal to 0.")
    }

    val lookbackBound = Instant.now().minus(lookbackDays.toLong(), ChronoUnit.DAYS).toEpochMilli()
    val sinceBound = options.since?.let(::parseIsoInstantToEpochMillis)

    return if (sinceBound == null) {
      SmsQueryLowerBound(
        selection = "${Telephony.Sms.DATE} >= ?",
        timestampMillis = lookbackBound,
      )
    } else {
      SmsQueryLowerBound(
        selection = "${Telephony.Sms.DATE} > ?",
        timestampMillis = maxOf(lookbackBound, sinceBound),
      )
    }
  }

  private fun resolveLimit(limit: Int?): Int? {
    if (limit == null) {
      return null
    }

    if (limit <= 0) {
      throw InvalidSmsScanOptionsException("limit must be greater than 0 when provided.")
    }

    return limit
  }

  private fun parseIsoInstantToEpochMillis(value: String): Long {
    return try {
      Instant.parse(value).toEpochMilli()
    } catch (_: Throwable) {
      throw InvalidSmsScanOptionsException("since must be a valid ISO-8601 timestamp.")
    }
  }
}

private data class SmsQueryLowerBound(
  val selection: String,
  val timestampMillis: Long,
)