package expo.modules.expensebuddysmsmodule.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "sms_import_journal",
    indices = [
        Index(value = ["fingerprint"]),
        Index(value = ["timestamp"]),
    ],
)
data class ImportJournalEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val fingerprint: String,
    val source: String,
    val action: String,
    val timestamp: Long,
    val details: String?,
)
