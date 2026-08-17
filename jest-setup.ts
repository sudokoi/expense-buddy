// Mock Expo Localization
jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [
    { languageTag: "en-US", textDirection: "ltr", currencyCode: "USD" },
  ]),
  locale: "en-US",
  isRTL: false,
}))

// Mock MMKV for all tests
jest.mock("react-native-mmkv", () => {
  const mockStorage = new Map<string, string>()
  return {
    createMMKV: jest.fn(() => ({
      getString: jest.fn((key: string) => mockStorage.get(key) ?? null),
      set: jest.fn((key: string, value: string) => mockStorage.set(key, value)),
      remove: jest.fn((key: string) => mockStorage.delete(key)),
      getAllKeys: jest.fn(() => Array.from(mockStorage.keys())),
      clearAll: jest.fn(() => mockStorage.clear()),
      getBoolean: jest.fn((key: string) => {
        const v = mockStorage.get(key)
        return v === "true" ? true : v === "false" ? false : null
      }),
    })),
    MMKV: class {},
  }
})

// Mock the logger (its native module imports `expo`, which isn't transformed
// in this jest setup). logAsync is fire-and-forget, so a no-op is sufficient.
jest.mock("./services/logger", () => ({
  logAsync: jest.fn(() => Promise.resolve()),
  getLogsForBugReportAsync: jest.fn(() => Promise.resolve("")),
  clearLogsAsync: jest.fn(() => Promise.resolve()),
}))

// Mock Async Storage (kept for migration path)
jest.mock("@react-native-async-storage/async-storage", () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
  getAllKeys: jest.fn(() => Promise.resolve([])),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}))

// Mock expo-secure-store if used elsewhere
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}))

// Mock React Native
jest.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: jest.fn((obj) => obj.ios),
  },
  NativeModules: {},
  Touchable: {
    Mixin: {},
  },
  View: "View",
  Text: "Text",
}))

// Mock lucide-react-native icons. Returning a no-op component (instead of
// React.createElement) avoids the react-native-web css-interop babel plugin
// injecting out-of-scope variables into the jest.mock factory.
jest.mock("lucide-react-native", () => {
  const MockIcon = () => null
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "__esModule") return true
        return MockIcon
      },
    }
  )
})
