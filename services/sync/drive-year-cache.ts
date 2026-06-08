import type { DriveYearRevision } from "./provider-types"
import type { DriveYearCache } from "./google-drive-provider"
import { providerStateStore } from "./provider-state-store"
import { logAsync } from "../logger"

/**
 * Provider-scoped {@link DriveYearCache} backed by `providerStateStore`.
 *
 * All cached sync metadata lives under provider-scoped keys
 * (`sync.providers.<providerId>.*`, Requirement 11.1):
 *
 * - The per-year revision index (`Record<year, DriveYearRevision>`) is stored
 *   under `sync.providers.<providerId>.remoteIndex`. This is the per-year
 *   `RemoteRevision` snapshot the steady-state version preflight compares
 *   against so prior-year files are not re-downloaded when their Drive
 *   `version` is unchanged.
 * - The parsed `path -> content` body for each year is stored under
 *   `sync.providers.<providerId>.remoteYear.<year>` so a version match can be
 *   satisfied from cache without a download (Requirement 7.3). When this is
 *   missing the provider downloads even on a version match (Requirement 7.6).
 *
 * Scoping the cache per provider means switching providers never lets one
 * provider's cached revisions/content leak into another provider's read path
 * (Requirement 8.4).
 */
const REMOTE_INDEX_FIELD = "remoteIndex"

function yearContentField(year: string): string {
  return `remoteYear.${year}`
}

export function createDriveYearCache(providerId: string): DriveYearCache {
  return {
    async loadIndex(): Promise<Record<string, DriveYearRevision>> {
      const index = await providerStateStore.get<Record<string, DriveYearRevision>>(
        providerId,
        REMOTE_INDEX_FIELD
      )
      return index ?? {}
    },

    async readYear(year: string): Promise<Record<string, string> | null> {
      return providerStateStore.get<Record<string, string>>(
        providerId,
        yearContentField(year)
      )
    },

    async saveYear(
      year: string,
      files: Record<string, string>,
      revision: DriveYearRevision
    ): Promise<void> {
      // Persist the parsed body for the year first, then fold the new revision
      // into the per-year index. Both writes are provider-scoped.
      await providerStateStore.set(providerId, yearContentField(year), files)

      const index =
        (await providerStateStore.get<Record<string, DriveYearRevision>>(
          providerId,
          REMOTE_INDEX_FIELD
        )) ?? {}
      index[year] = revision
      await providerStateStore.set(providerId, REMOTE_INDEX_FIELD, index)

      logAsync(
        "INFO",
        "DRIVE_PROVIDER",
        `CACHE_SAVE_YEAR providerId=${providerId} year=${year} version=${revision.version}`
      )
    },
  }
}
