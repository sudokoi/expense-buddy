module.exports = {
  testEnvironment: "node",
  testMatch: ["**/utils/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": ["babel-jest", { presets: ["@babel/preset-typescript"] }],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
