package expo.modules.expensebuddybackgroundsms.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import expo.modules.expensebuddylogger.LoggerApi

@Database(
    entities = [ReviewQueueEntity::class, ImportJournalEntity::class],
    version = 2,
    exportSchema = true,
)
abstract class SmsReviewQueueDatabase : RoomDatabase() {
    abstract fun reviewQueueDao(): ReviewQueueDao

    abstract fun importJournalDao(): ImportJournalDao

    @Transaction
    open suspend fun upsertItem(
        entity: ReviewQueueEntity,
        source: String,
    ): Boolean {
        val dao = reviewQueueDao()
        val journalDao = importJournalDao()
        val existing = dao.getItemByFingerprint(entity.fingerprint)
        if (existing != null) {
            LoggerApi.d("SMS_QUEUE", "DEDUPED fingerprint=${entity.fingerprint} source=$source status=${existing.status}")
            journalDao.insert(
                ImportJournalEntity(
                    fingerprint = entity.fingerprint,
                    source = source,
                    action = "DEDUPED",
                    timestamp = System.currentTimeMillis(),
                    details = "existing_status=${existing.status}",
                ),
            )
            return false
        }
        val inserted = dao.insertIfNotExists(entity)
        if (inserted == -1L) {
            LoggerApi.d("SMS_QUEUE", "DEDUPED fingerprint=${entity.fingerprint} source=$source reason=race_condition_insert_failed")
            journalDao.insert(
                ImportJournalEntity(
                    fingerprint = entity.fingerprint,
                    source = source,
                    action = "DEDUPED",
                    timestamp = System.currentTimeMillis(),
                    details = "race_condition_insert_failed",
                ),
            )
            return false
        }
        LoggerApi.d("SMS_QUEUE", "INSERTED fingerprint=${entity.fingerprint} source=$source")
        journalDao.insert(
            ImportJournalEntity(
                fingerprint = entity.fingerprint,
                source = source,
                action = "INSERTED",
                timestamp = System.currentTimeMillis(),
                details = null,
            ),
        )
        return true
    }

    @Transaction
    open suspend fun approveItem(
        fingerprint: String,
        source: String,
        expenseId: String? = null,
    ) {
        val now = System.currentTimeMillis()
        reviewQueueDao().approveItem(fingerprint, "APPROVED", expenseId, now)
        LoggerApi.d("SMS_QUEUE", "APPROVED fingerprint=$fingerprint source=$source${expenseId?.let { " expense_id=$it" } ?: ""}")
        importJournalDao().insert(
            ImportJournalEntity(
                fingerprint = fingerprint,
                source = source,
                action = "APPROVED",
                timestamp = now,
                details = expenseId?.let { "expense_id=$it" },
            ),
        )
    }

    @Transaction
    open suspend fun rejectItem(
        fingerprint: String,
        source: String,
    ) {
        val now = System.currentTimeMillis()
        reviewQueueDao().updateStatus(fingerprint, "REJECTED", now)
        LoggerApi.d("SMS_QUEUE", "REJECTED fingerprint=$fingerprint source=$source")
        importJournalDao().insert(
            ImportJournalEntity(
                fingerprint = fingerprint,
                source = source,
                action = "REJECTED",
                timestamp = now,
                details = null,
            ),
        )
    }

    @Transaction
    open suspend fun dismissItem(
        fingerprint: String,
        source: String,
    ) {
        val now = System.currentTimeMillis()
        reviewQueueDao().updateStatus(fingerprint, "DISMISSED", now)
        LoggerApi.d("SMS_QUEUE", "DISMISSED fingerprint=$fingerprint source=$source")
        importJournalDao().insert(
            ImportJournalEntity(
                fingerprint = fingerprint,
                source = source,
                action = "DISMISSED",
                timestamp = now,
                details = null,
            ),
        )
    }

    companion object {
        private const val DATABASE_NAME = "expense_buddy_sms_queue.db"

        val MIGRATION_1_2: Migration =
            object : Migration(1, 2) {
                override fun migrate(db: SupportSQLiteDatabase) {
                    db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_review_queue_status ON sms_review_queue(status)")
                    db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_review_queue_fingerprint ON sms_review_queue(fingerprint)")
                    db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_review_queue_timestamp ON sms_review_queue(timestamp)")
                    db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_import_journal_fingerprint ON sms_import_journal(fingerprint)")
                    db.execSQL("CREATE INDEX IF NOT EXISTS idx_sms_import_journal_timestamp ON sms_import_journal(timestamp)")
                }
            }

        @Volatile
        private var instance: SmsReviewQueueDatabase? = null

        fun getInstance(context: Context): SmsReviewQueueDatabase =
            instance ?: synchronized(this) {
                instance ?: Room
                    .databaseBuilder(
                        context.applicationContext,
                        SmsReviewQueueDatabase::class.java,
                        DATABASE_NAME,
                    ).addMigrations(MIGRATION_1_2)
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { instance = it }
            }
    }
}
