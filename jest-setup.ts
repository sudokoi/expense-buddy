// Mock Expo Localization
jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [
    { languageTag: "en-US", textDirection: "ltr", currencyCode: "USD" },
  ]),
  locale: "en-US",
  isRTL: false,
}))

// Mock Async Storage
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

// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  digestStringAsync: jest.fn((algorithm: string, data: string) => {
    // Simple deterministic hex hash for testing
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    const hex = Math.abs(hash).toString(16).padStart(64, "0")
    return Promise.resolve(hex)
  }),
  CryptoDigestAlgorithm: {
    SHA256: "SHA-256",
  },
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

// Mock @tamagui/lucide-icons
jest.mock("@tamagui/lucide-icons", () => {
  const React = require("react")
  const MockIcon = (props: any) => React.createElement("View", props)
  return {
    Banknote: MockIcon,
    Smartphone: MockIcon,
    CreditCard: MockIcon,
    Building: MockIcon,
    Circle: MockIcon,
  }
})
