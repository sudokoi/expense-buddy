package expo.modules.expensebuddylogger

import android.annotation.SuppressLint
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object LoggerApi {
    private var dao: LogDao? = null
    private var scope: CoroutineScope? = null

    @Volatile private var writer: LogWriter? = null

    @Synchronized
    fun initialize(
        context: android.content.Context,
        capacity: Int = 1000,
    ) {
        if (writer != null) return
        val db = LoggerDatabase.getInstance(context)
        dao = db.logDao()
        startWriter(db.logDao(), capacity)
    }

    @SuppressLint("VisibleForTests")
    internal fun initializeForTesting(
        dao: LogDao,
        capacity: Int = 1000,
    ) {
        resetForTesting()
        this.dao = dao
        startWriter(dao, capacity)
    }

    internal fun resetForTesting() {
        scope?.cancel()
        dao = null
        scope = null
        writer = null
    }

    private fun startWriter(
        dao: LogDao,
        capacity: Int,
    ) {
        val next = LogWriter(dao, capacity)
        writer = next
        scope =
            CoroutineScope(SupervisorJob() + Dispatchers.IO).also { owner ->
                owner.launch {
                    try {
                        next.run()
                    } catch (
                        error: CancellationException,
                    ) {
                        throw error
                    } catch (error: Exception) {
                        android.util.Log.e("LOGGER", "Log writer failed", error)
                    }
                }
            }
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
        writer?.enqueue(
            LogEntity(
                timestamp = System.currentTimeMillis(),
                level = level,
                tag = tag,
                message = message,
                stacktrace = stacktrace,
            ),
        )
    }

    suspend fun getLast(limit: Int): List<LogEntity> {
        writer?.flush()
        return dao?.getLast(limit) ?: emptyList()
    }

    suspend fun getLastAsString(limit: Int): String {
        val entries = getLast(limit)
        val formatter = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.ROOT)
        return entries.reversed().joinToString("\n") { entry ->
            val time = formatter.format(Date(entry.timestamp))
            val stack = entry.stacktrace?.let { "\n$it" } ?: ""
            "[$time] [${entry.level}] [${entry.tag}] ${entry.message}$stack"
        }
    }

    suspend fun clear() {
        writer?.clear()
    }

    suspend fun count(): Int {
        writer?.flush()
        return dao?.count() ?: 0
    }
}
