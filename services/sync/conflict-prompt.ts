import { Alert } from "react-native"
import i18next from "i18next"
import type { TrueConflict } from "../merge-engine"
import type { ConflictResolution } from "../sync-machine"

/**
 * Present the true-conflict resolution dialog and resolve with the user's
 * choice (keep all local / keep all remote) or `undefined` if cancelled.
 *
 * This is a plain function (not a hook) so it can be injected into the
 * SyncOrchestrator's `conflictResolver` binding from the StoreProvider and
 * invoked from any orchestrator-driven run (manual or background).
 */
export function promptConflictResolution(
  conflicts: TrueConflict[]
): Promise<ConflictResolution[] | undefined> {
  return new Promise((resolve) => {
    const conflictCount = conflicts.length
    const summary = conflicts
      .slice(0, 3)
      .map((c) => {
        const localNote = c.localVersion.note || "Unnamed"
        const remoteNote = c.remoteVersion.note || "Unnamed"
        return `• Local: ${localNote} (${c.localVersion.amount})\n  Remote: ${remoteNote} (${c.remoteVersion.amount})`
      })
      .join("\n\n")
    const moreText = conflictCount > 3 ? `\n\n...and ${conflictCount - 3} more` : ""

    Alert.alert(
      i18next.t("settings.conflicts.title", {
        count: conflictCount,
        s: conflictCount > 1 ? "s" : "",
      }),
      i18next.t("settings.conflicts.message", {
        s: conflictCount > 1 ? "s" : "",
        summary: `${summary}${moreText}`,
      }),
      [
        {
          text: i18next.t("common.cancel"),
          style: "cancel",
          onPress: () => resolve(undefined),
        },
        {
          text: i18next.t("settings.conflicts.keepLocal"),
          onPress: () =>
            resolve(conflicts.map((c) => ({ expenseId: c.expenseId, choice: "local" }))),
        },
        {
          text: i18next.t("settings.conflicts.keepRemote"),
          onPress: () =>
            resolve(conflicts.map((c) => ({ expenseId: c.expenseId, choice: "remote" }))),
        },
      ]
    )
  })
}
