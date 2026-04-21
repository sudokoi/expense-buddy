const mockGetPlayStoreUpdateInfo = jest.fn()

jest.mock("./play-store-update", () => ({
  getPlayStoreUpdateInfo: (...args: unknown[]) => mockGetPlayStoreUpdateInfo(...args),
}))

jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}))

import {
  checkForGitHubUpdates,
  checkForPlayStoreUpdates,
  resolveUpdateSource,
} from "./update-checker"

describe("checkForUpdates regression routing", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it("routes Play-installed Android builds to the Play Store update path", () => {
    expect(
      resolveUpdateSource({
        installerPackageName: "com.android.vending",
        isExpoGo: false,
        platformOs: "android",
      })
    ).toBe("play-store")
  })

  it("routes non-Play builds to the GitHub release path", () => {
    expect(
      resolveUpdateSource({
        installerPackageName: "adb",
        isExpoGo: false,
        platformOs: "android",
      })
    ).toBe("github")
  })

  it("uses Play Core update info for the Play Store branch", async () => {
    mockGetPlayStoreUpdateInfo.mockResolvedValue({
      availableVersionCode: 30200999,
      clientVersionStalenessDays: 2,
      installStatus: "pending",
      isFlexibleUpdateAllowed: true,
      isImmediateUpdateAllowed: true,
      updateAvailability: "available",
      updatePriority: 3,
    })

    const result = await checkForPlayStoreUpdates("3.2.0")

    expect(mockGetPlayStoreUpdateInfo).toHaveBeenCalledTimes(1)
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.source).toBe("play-store")
    expect(result.hasUpdate).toBe(true)
    expect(result.latestVersion).toBe("3.2.0")
  })

  it("uses GitHub releases for the non-Play branch", async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        body: "Release notes",
        html_url: "https://github.com/sudokoi/expense-buddy/releases/tag/v9.9.9",
        published_at: "2026-04-20T00:00:00Z",
        tag_name: "v9.9.9",
      }),
      status: 200,
    })

    const result = await checkForGitHubUpdates("3.2.0")

    expect(mockGetPlayStoreUpdateInfo).not.toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(result.source).toBe("github")
    expect(result.hasUpdate).toBe(true)
    expect(result.latestVersion).toBe("9.9.9")
    expect(result.releaseUrl).toBe(
      "https://github.com/sudokoi/expense-buddy/releases/tag/v9.9.9"
    )
  })
})
