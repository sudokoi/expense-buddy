package expo.modules.expensebuddylogger

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [LogEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class LoggerDatabase : RoomDatabase() {
    abstract fun logDao(): LogDao

    companion object {
        private const val DATABASE_NAME = "expense_buddy_logs.db"

        @Volatile
        private var instance: LoggerDatabase? = null

        fun getInstance(context: Context): LoggerDatabase =
            instance ?: synchronized(this) {
                instance ?: Room
                    .databaseBuilder(
                        context.applicationContext,
                        LoggerDatabase::class.java,
                        DATABASE_NAME,
                    ).fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
