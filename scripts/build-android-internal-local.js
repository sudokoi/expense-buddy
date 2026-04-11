const { mkdirSync } = require("node:fs")
const { join, resolve } = require("node:path")
const { spawnSync } = require("node:child_process")

const rootDir = resolve(__dirname, "..")
const outputDir = join(rootDir, "build")
const outputPath =
  process.env.OUTPUT_PATH || join(outputDir, "expense-buddy-internal.apk")
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx"
const extraArgs = process.argv.slice(2)

mkdirSync(outputDir, { recursive: true })

const result = spawnSync(
  npxCommand,
  [
    "eas-cli",
    "build",
    "--platform",
    "android",
    "--profile",
    "internal",
    "--local",
    "--non-interactive",
    "--output",
    outputPath,
    ...extraArgs,
  ],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  }
)

if (result.error) {
  throw result.error
}

if (typeof result.status === "number") {
  process.exit(result.status)
}

process.exit(1)
