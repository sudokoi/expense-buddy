package expo.modules.expensebuddylogger

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking

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

            AsyncFunction("getLogsAsync") { count: Int ->
                runBlocking(Dispatchers.IO) { LoggerApi.getLast(count) }.map { entry ->
                    mapOf(
                        "timestamp" to entry.timestamp,
                        "level" to entry.level,
                        "tag" to entry.tag,
                        "message" to entry.message,
                        "stacktrace" to entry.stacktrace,
                    )
                }
            }

            AsyncFunction("getLogsAsStringAsync") { count: Int ->
                runBlocking(Dispatchers.IO) { LoggerApi.getLastAsString(count) }
            }

            AsyncFunction("clearLogsAsync") {
                runBlocking(Dispatchers.IO) { LoggerApi.clear() }
            }
        }
}
