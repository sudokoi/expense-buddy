package expo.modules.expensebuddywidget

import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.ensureActive

internal enum class WidgetKind(
    val providerName: String,
) {
    SUMMARY("expo.modules.expensebuddywidget.SummaryWidgetProvider"),
    TREND("expo.modules.expensebuddywidget.TrendWidgetProvider"),
    RECENT("expo.modules.expensebuddywidget.RecentWidgetProvider"),
}

internal data class WidgetTarget(
    val kind: WidgetKind,
    val id: Int,
)

/** One consumer, one pending set. Requests during a render form a fresh trailing batch. */
internal class WidgetUpdateQueue {
    private class Batch {
        val targets = mutableSetOf<WidgetTarget>()
        val completion = CompletableDeferred<Unit>()
    }

    private val lock = Any()
    private val wakeup = Channel<Unit>(Channel.CONFLATED)
    private var pending: Batch? = null
    private var closed = false

    suspend fun refresh(targets: Set<WidgetTarget>) {
        if (targets.isEmpty()) return
        val completion =
            synchronized(lock) {
                if (closed) throw CancellationException("Widget refresh owner stopped")
                val batch = pending ?: Batch().also { pending = it }
                batch.targets.addAll(targets)
                wakeup.trySend(Unit)
                batch.completion
            }
        completion.await()
    }

    suspend fun run(render: suspend (Set<WidgetTarget>) -> Unit) {
        try {
            for (signal in wakeup) {
                // Fixed window, not a resetting debounce that can starve updates.
                delay(25)
                val batch = synchronized(lock) { pending.also { pending = null } } ?: continue
                try {
                    render(batch.targets)
                    batch.completion.complete(Unit)
                } catch (error: Exception) {
                    batch.completion.completeExceptionally(error)
                    currentCoroutineContext().ensureActive()
                }
            }
        } finally {
            synchronized(lock) {
                closed = true
                pending?.completion?.cancel()
                pending = null
                wakeup.close()
            }
        }
    }
}
