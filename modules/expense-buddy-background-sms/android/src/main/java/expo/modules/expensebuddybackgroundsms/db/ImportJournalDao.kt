package expo.modules.expensebuddybackgroundsms.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface ImportJournalDao {

    @Insert
    suspend fun insert(entry: ImportJournalEntity)

    @Query("SELECT * FROM sms_import_journal ORDER BY timestamp DESC LIMIT :limit")
    suspend fun getRecentEntries(limit: Int = 100): List<ImportJournalEntity>

    @Query("SELECT * FROM sms_import_journal WHERE fingerprint = :fingerprint ORDER BY timestamp DESC")
    suspend fun getEntriesForFingerprint(fingerprint: String): List<ImportJournalEntity>
}
