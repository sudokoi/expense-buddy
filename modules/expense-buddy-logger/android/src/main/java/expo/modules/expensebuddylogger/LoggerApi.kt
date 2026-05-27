package expo.modules.expensebuddylogger

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object LoggerApi {
    private var dao: LogDao? = null
    private var scope: CoroutineScope? = null
    private var capacity: Int = 1000

    fun initialize(
        context: android.content.Context,
        capacity: Int = 1000,
    ) {
        this.capacity = capacity
        this.scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        val db = LoggerDatabase.getInstance(context)
        dao = db.logDao()
    }

    fun d(
        tag: String,
        message: String,
    ) = append("DEBUG", tag, message, null)

    fun i(
        tag: String,
        message: String,
    ) = append("INFO", tag, message, null)

    fun w(
        tag: String,
        message: String,
    ) = append("WARN", tag, message, null)

    fun e(
        tag: String,
        message: String,
        throwable: Throwable? = null,
    ) = append("ERROR", tag, message, throwable?.stackTraceToString())

    fun append(
        level: String,
        tag: String,
        message: String,
        stacktrace: String?,
    ) {
        scope?.launch {
            dao?.insert(
                LogEntity(
                    timestamp = System.currentTimeMillis(),
                    level = level,
                    tag = tag,
                    message = message,
                    stacktrace = stacktrace,
                ),
            )
            val count = dao?.count() ?: 0
            if (count > capacity) {
                dao?.prune(capacity)
            }
        }
    }

    suspend fun getLast(limit: Int): List<LogEntity> = dao?.getLast(limit) ?: emptyList()

    suspend fun getLastAsString(limit: Int): String {
        val entries = dao?.getLast(limit) ?: return ""
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.ROOT)
        return entries.reversed().joinToString("\n") { entry ->
            val time = formatter.format(Date(entry.timestamp))
            val stack = entry.stacktrace?.let { "\n$it" } ?: ""
            "[$time] [${entry.level}] [${entry.tag}] ${entry.message}$stack"
        }
    }

    suspend fun clear() {
        dao?.clearAll()
    }

    suspend fun count(): Int = dao?.count() ?: 0
}
