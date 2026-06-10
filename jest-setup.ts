// Mock expo (native module host)
jest.mock("expo", () => ({
  requireOptionalNativeModule: jest.fn(() => null),
}))

// Mock Expo Localization
jest.mock("expo-localization", () => ({
  getLocales: jest.fn(() => [
    { languageTag: "en-US", textDirection: "ltr", currencyCode: "USD" },
  ]),
  locale: "en-US",
  isRTL: false,
}))

// Mock MMKV (native module can't run in Jest)
jest.mock("react-native-mmkv", () => {
  const store = new Map<string, string>()
  const mockMMKV = {
    getString: jest.fn((key: string) => store.get(key) ?? undefined),
    set: jest.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    getBoolean: jest.fn((key: string) => {
      const v = store.get(key)
      if (v === "true") return true
      if (v === "false") return false
      return undefined
    }),
    getNumber: jest.fn((key: string) => {
      const v = store.get(key)
      return v !== undefined ? Number(v) : undefined
    }),
    remove: jest.fn((key: string) => store.delete(key)),
    getAllKeys: jest.fn(() => Array.from(store.keys())),
    clearAll: jest.fn(() => store.clear()),
    contains: jest.fn((key: string) => store.has(key)),
    id: "expense-buddy",
    length: 0,
    size: 0,
    byteSize: 0,
    isReadOnly: false,
    isEncrypted: false,
  }
  return {
    createMMKV: jest.fn(() => mockMMKV),
    createMockMMKV: jest.fn(() => mockMMKV),
  }
})

// Keep AsyncStorage mocked for the one-time migration path in storage.ts
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

// Mock @tamagui/lucide-icons-2
jest.mock("@tamagui/lucide-icons-2", () => {
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
