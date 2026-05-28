package expo.modules.expensebuddysmsimport

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class InvalidSmsScanOptionsException(
    message: String,
) : CodedException(
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
    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddySmsImport")
        }
}
