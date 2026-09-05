package expo.modules.expensebuddylogger

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class ExpenseBuddyLoggerModule : Module() {
    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyLogger")

            OnCreate {
                val context = appContext.reactContext?.applicationContext
                if (context != null) {
                    LoggerApi.initialize(context)
                }
            }

            AsyncFunction("logAsync") { level: String, tag: String, message: String, stacktrace: String? ->
                val normalized = level.uppercase()
                if (normalized !in setOf("DEBUG", "INFO", "WARN", "ERROR")) {
                    return@AsyncFunction
                }
                LoggerApi.append(normalized, tag, message, stacktrace)
            }

            AsyncFunction("getLogsAsync") Coroutine { count: Int ->
                withContext(Dispatchers.IO) {
                    LoggerApi.getLast(count).map { entry ->
                        mapOf(
                            "timestamp" to entry.timestamp,
                            "level" to entry.level,
                            "tag" to entry.tag,
                            "message" to entry.message,
                            "stacktrace" to entry.stacktrace,
                        )
                    }
                }
            }

            AsyncFunction("getLogsAsStringAsync") Coroutine { count: Int ->
                withContext(Dispatchers.IO) { LoggerApi.getLastAsString(count) }
            }

            AsyncFunction("clearLogsAsync").SuspendBody<Unit> {
                withContext(Dispatchers.IO) { LoggerApi.clear() }
            }
        }
}
