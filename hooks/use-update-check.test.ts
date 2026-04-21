const mockAddNotification = jest.fn()
const mockCanOpenUrl = jest.fn()
const mockOpenUrl = jest.fn()
const mockCompletePlayStoreUpdate = jest.fn()
const mockStartPlayStoreFlexibleUpdate = jest.fn()

jest.mock("react-native", () => ({
  Linking: {
    canOpenURL: (...args: unknown[]) => mockCanOpenUrl(...args),
    openURL: (...args: unknown[]) => mockOpenUrl(...args),
  },
}))

jest.mock("../services/play-store-update", () => ({
  completePlayStoreUpdate: (...args: unknown[]) => mockCompletePlayStoreUpdate(...args),
  startPlayStoreFlexibleUpdate: (...args: unknown[]) =>
    mockStartPlayStoreFlexibleUpdate(...args),
  subscribeToPlayStoreUpdateStatus: jest.fn(() => () => {}),
}))

jest.mock("../stores/notification-store", () => ({
  notificationStore: {
    trigger: {
      addNotification: (...args: unknown[]) => mockAddNotification(...args),
    },
  },
}))

import { APP_CONFIG } from "../constants/app-config"
import { performUpdateAction } from "./use-update-check"

describe("performUpdateAction regression routing", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanOpenUrl.mockResolvedValue(true)
    mockOpenUrl.mockResolvedValue(undefined)
    mockCompletePlayStoreUpdate.mockResolvedValue(undefined)
    mockStartPlayStoreFlexibleUpdate.mockResolvedValue(undefined)
  })

  it("opens the GitHub release page for non-Play updates", async () => {
    const releaseUrl = "https://github.com/sudokoi/expense-buddy/releases/tag/v9.9.9"

    await performUpdateAction({
      installStatus: "unknown",
      releaseUrl,
      updateSource: "github",
    })

    expect(mockCanOpenUrl).toHaveBeenCalledWith(releaseUrl)
    expect(mockOpenUrl).toHaveBeenCalledWith(releaseUrl)
    expect(mockStartPlayStoreFlexibleUpdate).not.toHaveBeenCalled()
    expect(mockCompletePlayStoreUpdate).not.toHaveBeenCalled()
  })

  it("falls back to the GitHub releases list when no specific release URL exists", async () => {
    await performUpdateAction({
      installStatus: "unknown",
      updateSource: "github",
    })

    expect(mockCanOpenUrl).toHaveBeenCalledWith(`${APP_CONFIG.github.url}/releases`)
    expect(mockOpenUrl).toHaveBeenCalledWith(`${APP_CONFIG.github.url}/releases`)
  })

  it("starts the Play flexible update flow for Play Store builds", async () => {
    await performUpdateAction({
      installStatus: "unknown",
      updateSource: "play-store",
    })

    expect(mockStartPlayStoreFlexibleUpdate).toHaveBeenCalledTimes(1)
    expect(mockOpenUrl).not.toHaveBeenCalled()
  })

  it("completes a downloaded Play Store update instead of opening GitHub", async () => {
    await performUpdateAction({
      installStatus: "downloaded",
      updateSource: "play-store",
    })

    expect(mockCompletePlayStoreUpdate).toHaveBeenCalledTimes(1)
    expect(mockStartPlayStoreFlexibleUpdate).not.toHaveBeenCalled()
    expect(mockOpenUrl).not.toHaveBeenCalled()
  })
})
