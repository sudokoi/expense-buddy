/**
 * Syncs the version from package.json to app.json
 * Run after changeset version to keep Expo app version in sync
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");

const pkg = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8"));
const app = JSON.parse(readFileSync(join(rootDir, "app.json"), "utf8"));

const oldVersion = app.expo.version;
app.expo.version = pkg.version;

writeFileSync(join(rootDir, "app.json"), JSON.stringify(app, null, 2) + "\n");

console.log(`✅ Synced app.json version: ${oldVersion} → ${pkg.version}`);
