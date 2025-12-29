import packageJson from "../package.json"

export const APP_CONFIG = {
  version: packageJson.version,
  github: {
    owner: "sudokoi",
    repo: "expense-buddy",
    url: "https://github.com/sudokoi/expense-buddy",
  },
  playStore: {
    url: "https://play.google.com/store/apps/details?id=com.sudokoi.expensebuddy",
  },
} as const
