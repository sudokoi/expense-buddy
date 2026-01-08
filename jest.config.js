module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/utils/**/*.test.ts",
    "**/services/**/*.test.ts",
    "**/stores/**/*.test.ts",
    "**/hooks/**/*.test.ts",
  ],
  transform: {
    "^.+\\.tsx?$": ["babel-jest", { presets: ["@babel/preset-typescript"] }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
}
