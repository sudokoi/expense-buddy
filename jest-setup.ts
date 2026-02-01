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
