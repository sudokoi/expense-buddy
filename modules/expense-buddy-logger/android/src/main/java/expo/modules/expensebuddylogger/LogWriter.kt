package expo.modules.expensebuddylogger

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/** Bounded mailbox; the application owner runs one consumer, never one job per log. */
internal class LogWriter(
    private val dao: LogDao,
    private val capacity: Int,
    private val queueCapacity: Int = 256,
) {
    private val queue = ArrayDeque<LogEntity>()
    private val signal = Channel<Unit>(Channel.CONFLATED)
    private val writes = Mutex()
    private var dropped = 0

    init {
        require(capacity > 0 && queueCapacity > 0)
    }

    fun enqueue(entry: LogEntity) {
        synchronized(queue) {
            if (queue.size == queueCapacity) {
                val disposable = queue.indexOfFirst { it.level != "WARN" && it.level != "ERROR" }
                dropped++
                if (disposable >= 0) {
                    queue.removeAt(disposable)
                } else if (entry.level == "WARN" || entry.level == "ERROR") {
                    queue.removeFirst()
                } else {
                    return
                }
            }
            queue.addLast(entry)
        }
        signal.trySend(Unit)
    }

    suspend fun run() {
        for (ignored in signal) {
            try {
                flush()
            } catch (
                error: CancellationException,
            ) {
                throw error
            } catch (error: Exception) {
                android.util.Log.e("LOGGER", "Log batch failed", error)
            }
        }
    }

    suspend fun flush() =
        writes.withLock {
            var remaining = queueCapacity
            while (remaining > 0) {
                val batch =
                    synchronized(queue) {
                        buildList {
                            repeat(minOf(queue.size, 64, remaining)) { add(queue.removeFirst()) }
                            if (dropped > 0) {
                                add(
                                    LogEntity(
                                        timestamp = System.currentTimeMillis(),
                                        level = "WARN",
                                        tag = "LOGGER",
                                        message = "Dropped $dropped queued entries under load",
                                        stacktrace = null,
                                    ),
                                )
                                dropped = 0
                            }
                        }
                    }
                if (batch.isEmpty()) break
                dao.insertAndPrune(batch, capacity)
                // The overflow diagnostic is not a queued entry and must not
                // consume this pass's drain budget (or one entry can be stranded).
                remaining -= minOf(remaining, 64)
            }
        }

    suspend fun clear() =
        writes.withLock {
            synchronized(queue) {
                queue.clear()
                dropped = 0
            }
            dao.clearAll()
        }
}
