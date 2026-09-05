package expo.modules.expensebuddysmsmodule.db

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.google.common.truth.Truth.assertThat
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SmsQueueMigrationTest {
    @Test
    fun `upgrade preserves rows and validates both historical index naming styles`() =
        runTest {
            val context = ApplicationProvider.getApplicationContext<Context>()
            for (version in listOf(1, 2)) {
                for (legacyNames in listOf(false, true)) {
                    val name = "migration-$version-$legacyNames.db"
                    context.deleteDatabase(name)
                    val schema =
                        javaClass.classLoader!!
                            .getResourceAsStream(
                                "expo.modules.expensebuddysmsmodule.db.SmsReviewQueueDatabase/$version.json",
                            )!!
                            .bufferedReader()
                            .use { JSONObject(it.readText()).getJSONObject("database") }
                    SQLiteDatabase.openOrCreateDatabase(context.getDatabasePath(name), null).use { old ->
                        val entities = schema.getJSONArray("entities")
                        for (i in 0 until entities.length()) {
                            val entity = entities.getJSONObject(i)
                            val table = entity.getString("tableName")
                            old.execSQL(entity.getString("createSql").replace("${'$'}{TABLE_NAME}", table))
                            val indices = entity.optJSONArray("indices") ?: org.json.JSONArray()
                            for (j in 0 until indices.length()) {
                                var sql = indices.getJSONObject(j).getString("createSql").replace("${'$'}{TABLE_NAME}", table)
                                if (legacyNames) sql = sql.replace("index_sms_", "idx_sms_")
                                old.execSQL(sql)
                            }
                        }
                        old.execSQL(
                            "INSERT INTO sms_import_journal (fingerprint, source, action, timestamp) VALUES ('saved', 'TEST', 'INSERTED', 1)",
                        )
                        old.execSQL(
                            "INSERT INTO sms_review_queue " +
                                "(fingerprint, sender, body, amountNormalized, timestamp, sourceMessageId, sourceReceivedAt, " +
                                "status, importSource, createdAt, updatedAt) " +
                                "VALUES ('saved', 'BANK', 'Original SMS', '10.00', 1, '7', '2026-01-01', 'PENDING', 'TEST', 1, 1)",
                        )
                        old.version = version
                    }
                    val migrated =
                        Room
                            .databaseBuilder(context, SmsReviewQueueDatabase::class.java, name)
                            .addMigrations(SmsReviewQueueDatabase.MIGRATION_1_2, SmsReviewQueueDatabase.MIGRATION_2_3)
                            .build()
                    try {
                        assertThat(
                            migrated
                                .importJournalDao()
                                .getRecentEntries(10)
                                .single()
                                .fingerprint,
                        ).isEqualTo("saved")
                        assertThat(
                            migrated
                                .reviewQueueDao()
                                .getPendingItems()
                                .single()
                                .body,
                        ).isEqualTo("Original SMS")
                        migrated.openHelper.readableDatabase
                            .query(
                                "EXPLAIN QUERY PLAN SELECT * FROM sms_review_queue WHERE status = 'PENDING' ORDER BY timestamp DESC",
                            ).use { cursor ->
                                while (cursor.moveToNext()) assertThat(cursor.getString(3)).doesNotContain("TEMP B-TREE")
                            }
                    } finally {
                        migrated.close()
                        context.deleteDatabase(name)
                    }
                }
            }
        }
}
