package expo.modules.expensebuddysmsmodule.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** Persistence/schema owner. Transactions belong to the repository, not annotations here. */
@Database(entities = [ReviewQueueEntity::class, ImportJournalEntity::class], version = 3, exportSchema = true)
abstract class SmsReviewQueueDatabase : RoomDatabase() {
    abstract fun reviewQueueDao(): ReviewQueueDao

    abstract fun importJournalDao(): ImportJournalDao

    companion object {
        private const val DATABASE_NAME = "expense_buddy_sms_queue.db"
        val MIGRATION_1_2: Migration =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    for (column in listOf("status", "fingerprint", "timestamp")) {
                        db.execSQL("CREATE INDEX IF NOT EXISTS index_sms_review_queue_$column ON sms_review_queue($column)")
                    }
                    for (column in listOf("fingerprint", "timestamp")) {
                        db.execSQL("CREATE INDEX IF NOT EXISTS index_sms_import_journal_$column ON sms_import_journal($column)")
                    }
                }
            }
        val MIGRATION_2_3: Migration =
            object : Migration(2, 3) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    // Both naming styles existed in earlier migrations. No rows are removed.
                    for (prefix in listOf("index", "idx")) {
                        for (column in listOf("status", "fingerprint", "timestamp")) {
                            db.execSQL("DROP INDEX IF EXISTS ${prefix}_sms_review_queue_$column")
                        }
                    }
                    db.execSQL("CREATE INDEX index_sms_review_queue_status_timestamp ON sms_review_queue(status, timestamp)")
                    // Repair legacy 1->2 index names to match Room's exported schema.
                    for (column in listOf("fingerprint", "timestamp")) {
                        db.execSQL("DROP INDEX IF EXISTS idx_sms_import_journal_$column")
                        db.execSQL("CREATE INDEX IF NOT EXISTS index_sms_import_journal_$column ON sms_import_journal($column)")
                    }
                }
            }

        @Volatile private var instance: SmsReviewQueueDatabase? = null

        fun getInstance(context: Context): SmsReviewQueueDatabase =
            instance ?: synchronized(this) {
                instance ?: Room
                    .databaseBuilder(context.applicationContext, SmsReviewQueueDatabase::class.java, DATABASE_NAME)
                    .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                    .build()
                    .also { instance = it }
            }
    }
}
