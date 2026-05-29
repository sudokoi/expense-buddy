package expo.modules.expensebuddysmsmodule.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface ReviewQueueDao {
    @Query("SELECT * FROM sms_review_queue WHERE status = 'PENDING' ORDER BY timestamp DESC")
    suspend fun getPendingItems(): List<ReviewQueueEntity>

    @Query("SELECT * FROM sms_review_queue WHERE status = 'PENDING' ORDER BY timestamp DESC")
    fun observePendingItems(): Flow<List<ReviewQueueEntity>>

    @Query("SELECT * FROM sms_review_queue WHERE fingerprint = :fingerprint")
    suspend fun getItemByFingerprint(fingerprint: String): ReviewQueueEntity?

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIfNotExists(entity: ReviewQueueEntity): Long

    @Query("UPDATE sms_review_queue SET status = :status, updatedAt = :now WHERE fingerprint = :fingerprint")
    suspend fun updateStatus(
        fingerprint: String,
        status: String,
        now: Long,
    )

    @Query(
        "UPDATE sms_review_queue SET status = :status, acceptedExpenseId = :expenseId, updatedAt = :now WHERE fingerprint = :fingerprint",
    )
    suspend fun approveItem(
        fingerprint: String,
        status: String,
        expenseId: String?,
        now: Long,
    )

    @Query("SELECT COUNT(*) FROM sms_review_queue WHERE status = 'PENDING'")
    suspend fun countPending(): Int

    @Query("DELETE FROM sms_review_queue")
    suspend fun clearAll()
}
