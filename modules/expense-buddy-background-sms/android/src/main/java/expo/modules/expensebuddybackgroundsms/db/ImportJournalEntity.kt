package expo.modules.expensebuddybackgroundsms.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "sms_import_journal")
data class ImportJournalEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    val fingerprint: String,
    val source: String,
    val action: String,
    val timestamp: Long,
    val details: String?,
)
