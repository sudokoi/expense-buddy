package expo.modules.expensebuddywidget

import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Test

@OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)
class WidgetUpdateQueueTest {
    private val summary = WidgetTarget(WidgetKind.SUMMARY, 1)
    private val trend = WidgetTarget(WidgetKind.TREND, 2)

    @Test
    fun `bursts across providers render once and cancellation of one waiter does not cancel others`() =
        runTest {
            val queue = WidgetUpdateQueue()
            val batches = mutableListOf<Set<WidgetTarget>>()
            backgroundScope.launch { queue.run { batches.add(it) } }
            val first = async { queue.refresh(setOf(summary)) }
            val second = async { queue.refresh(setOf(summary, trend)) }
            runCurrent()
            first.cancel()
            advanceTimeBy(25)
            runCurrent()
            second.await()
            assertThat(batches).containsExactly(setOf(summary, trend))
        }

    @Test
    fun `updates during rendering use a trailing batch with fresh state`() =
        runTest {
            val queue = WidgetUpdateQueue()
            val gate = CompletableDeferred<Unit>()
            val snapshots = mutableListOf<Int>()
            var liveVersion = 1
            backgroundScope.launch {
                queue.run {
                    snapshots.add(liveVersion)
                    if (snapshots.size == 1) gate.await()
                }
            }
            val first = async { queue.refresh(setOf(summary)) }
            runCurrent()
            advanceTimeBy(25)
            runCurrent()
            liveVersion = 2
            val trailing = async { queue.refresh(setOf(summary)) }
            runCurrent()
            gate.complete(Unit)
            first.await()
            assertThat(trailing.isCompleted).isFalse()
            advanceTimeBy(25)
            runCurrent()
            trailing.await()
            assertThat(snapshots).containsExactly(1, 2).inOrder()
        }

    @Test
    fun `failed render reports failure and does not strand the next batch`() =
        runTest {
            val queue = WidgetUpdateQueue()
            var renders = 0
            backgroundScope.launch { queue.run { if (++renders == 1) error("unavailable") } }
            val first = async { runCatching { queue.refresh(setOf(summary)) } }
            runCurrent()
            advanceTimeBy(25)
            runCurrent()
            assertThat(first.await().exceptionOrNull()!!.message).isEqualTo("unavailable")
            val next = async { queue.refresh(setOf(trend)) }
            runCurrent()
            advanceTimeBy(25)
            runCurrent()
            next.await()
            assertThat(renders).isEqualTo(2)
        }

    @Test
    fun `stopping the owner releases both active and queued broadcast waiters`() =
        runTest {
            val queue = WidgetUpdateQueue()
            val owner = backgroundScope.launch { queue.run { awaitCancellation() } }
            val active = async { queue.refresh(setOf(summary)) }
            runCurrent()
            advanceTimeBy(25)
            runCurrent()
            val pending = async { queue.refresh(setOf(trend)) }
            runCurrent()
            owner.cancel()
            runCurrent()
            assertThat(active.isCancelled).isTrue()
            assertThat(pending.isCancelled).isTrue()
        }
}
