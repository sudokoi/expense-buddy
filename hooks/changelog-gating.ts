export interface ShouldOpenChangelogModalParams {
  isDev: boolean
  updateAvailable: boolean
  updateCheckCompleted: boolean
  currentVersion: string
  lastSeenVersion: string | null
  releaseNotes: string
}

export function shouldOpenChangelogModal({
  isDev,
  updateAvailable,
  updateCheckCompleted,
  currentVersion,
  lastSeenVersion,
  releaseNotes,
}: ShouldOpenChangelogModalParams): boolean {
  if (isDev) return false
  if (!updateCheckCompleted) return false
  if (updateAvailable) return false
  if (lastSeenVersion === currentVersion) return false
  if (!releaseNotes.trim()) return false
  return true
}
