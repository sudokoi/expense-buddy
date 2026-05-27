package expo.modules.expensebuddybackgroundsms.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [ReviewQueueEntity::class, ImportJournalEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class SmsReviewQueueDatabase : RoomDatabase() {
    abstract fun reviewQueueDao(): ReviewQueueDao

    abstract fun importJournalDao(): ImportJournalDao

    companion object {
        private const val DATABASE_NAME = "expense_buddy_sms_queue.db"

        @Volatile
        private var instance: SmsReviewQueueDatabase? = null

        fun getInstance(context: Context): SmsReviewQueueDatabase =
            instance ?: synchronized(this) {
                instance ?: Room
                    .databaseBuilder(
                        context.applicationContext,
                        SmsReviewQueueDatabase::class.java,
                        DATABASE_NAME,
                    ).fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
