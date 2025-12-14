import packageJson from "../package.json";

export const APP_CONFIG = {
  version: packageJson.version,
  github: {
    owner: "sudokoi",
    repo: "expense-buddy",
    url: "https://github.com/sudokoi/expense-buddy",
  },
} as const;
