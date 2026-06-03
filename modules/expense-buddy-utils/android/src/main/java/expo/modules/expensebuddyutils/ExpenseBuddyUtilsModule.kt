package expo.modules.expensebuddyutils

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpenseBuddyUtilsModule : Module() {
    override fun definition() =
        ModuleDefinition {
            Name("ExpenseBuddyUtils")

            AsyncFunction("zipTextEntriesAsync") { entries: List<Map<String, Any?>> ->
                ArchiveUtils.zipTextEntries(
                    entries.map { entry ->
                        ArchiveTextEntry(
                            path =
                                entry["path"] as? String
                                    ?: throw IllegalArgumentException("Archive entry is missing 'path'"),
                            content =
                                entry["content"] as? String
                                    ?: throw IllegalArgumentException("Archive entry is missing 'content'"),
                        )
                    },
                )
            }

            AsyncFunction("unzipTextEntriesAsync") { archiveBase64: String ->
                ArchiveUtils.unzipTextEntries(archiveBase64).map { entry ->
                    mapOf(
                        "path" to entry.path,
                        "content" to entry.content,
                    )
                }
            }
        }
}
