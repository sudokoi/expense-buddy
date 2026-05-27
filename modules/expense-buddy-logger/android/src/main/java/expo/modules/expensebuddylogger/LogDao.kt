package expo.modules.expensebuddylogger

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface LogDao {
    @Insert
    suspend fun insert(log: LogEntity)

    @Query("SELECT * FROM logs ORDER BY id DESC LIMIT :limit")
    suspend fun getLast(limit: Int): List<LogEntity>

    @Query("SELECT * FROM logs WHERE level = :level ORDER BY id DESC LIMIT :limit")
    suspend fun getLastByLevel(
        level: String,
        limit: Int,
    ): List<LogEntity>

    @Query("DELETE FROM logs WHERE id NOT IN (SELECT id FROM logs ORDER BY id DESC LIMIT :keepCount)")
    suspend fun prune(keepCount: Int)

    @Query("SELECT COUNT(*) FROM logs")
    suspend fun count(): Int

    @Query("DELETE FROM logs")
    suspend fun clearAll()
}
