module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/plugins/**/*.test.js",
    "**/utils/**/*.test.ts",
    "**/services/**/*.test.ts",
    "**/stores/**/*.test.ts",
    "**/hooks/**/*.test.ts",
    "**/components/**/*.test.ts",
    "**/components/**/*.test.tsx",
    "**/*.property.test.ts",
  ],
  transform: {
    "^.+\\.tsx?$": ["babel-jest", { presets: ["@babel/preset-typescript"] }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFiles: ["./jest-setup.ts"],
}
