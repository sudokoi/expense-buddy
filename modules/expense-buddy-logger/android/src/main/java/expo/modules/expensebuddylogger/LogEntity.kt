package expo.modules.expensebuddylogger

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "logs")
data class LogEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val timestamp: Long,
    val level: String,
    val tag: String,
    val message: String,
    val stacktrace: String? = null,
)
