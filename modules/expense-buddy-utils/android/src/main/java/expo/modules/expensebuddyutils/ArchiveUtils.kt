package expo.modules.expensebuddyutils

import android.util.Base64
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

data class ArchiveTextEntry(
    val path: String,
    val content: String,
)

object ArchiveUtils {
    fun zipTextEntries(entries: List<ArchiveTextEntry>): String {
        val output = ByteArrayOutputStream()

        ZipOutputStream(output).use { zip ->
            entries.forEach { entry ->
                val normalizedPath = normalizeEntryPath(entry.path)
                zip.putNextEntry(ZipEntry(normalizedPath))
                zip.write(entry.content.toByteArray(Charsets.UTF_8))
                zip.closeEntry()
            }
        }

        return Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)
    }

    fun unzipTextEntries(archiveBase64: String): List<ArchiveTextEntry> {
        val archiveBytes =
            try {
                Base64.decode(archiveBase64, Base64.DEFAULT)
            } catch (error: IllegalArgumentException) {
                throw IllegalArgumentException("Archive payload is not valid base64", error)
            }

        val entries = mutableListOf<ArchiveTextEntry>()

        ZipInputStream(ByteArrayInputStream(archiveBytes)).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                val normalizedPath = normalizeEntryPath(entry.name)
                if (!entry.isDirectory) {
                    val content = zip.readBytes().toString(Charsets.UTF_8)
                    entries.add(ArchiveTextEntry(path = normalizedPath, content = content))
                }
                zip.closeEntry()
                entry = zip.nextEntry
            }
        }

        return entries
    }

    private fun normalizeEntryPath(path: String): String {
        val normalized = path.replace('\\', '/').trim().trimStart('/')
        require(normalized.isNotEmpty()) { "Archive entry path cannot be empty" }
        require(!normalized.contains("..")) { "Archive entry path cannot contain '..'" }
        require(!normalized.startsWith("/")) { "Archive entry path cannot be absolute" }
        return normalized
    }
}
