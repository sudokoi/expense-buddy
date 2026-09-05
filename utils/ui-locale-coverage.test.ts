import fs from "node:fs"
import path from "node:path"
import { createInstance } from "i18next"
import { methodShortLabel } from "./analytics/filter-summary"

it.each(["en-US", "en-GB", "en-IN", "hi", "ja"])(
  "resolves audited UI copy and interpolation in %s",
  async (language) => {
    const translation = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "locales", language, "translation.json"),
        "utf8"
      )
    )
    const i18n = createInstance()
    await i18n.init({
      lng: language,
      resources: { [language]: { translation } },
      interpolation: { escapeValue: false },
    })
    expect(methodShortLabel("Credit Card", i18n.t)).toBe(
      translation.ui.paymentShort.creditCard
    )
    expect(i18n.t("ui.selectIcon", { icon: "Coffee" })).toContain("Coffee")
    expect(i18n.t("ui.selectColor", { color: "#123456" })).toContain("#123456")
    const summary = i18n.t("ui.conflictEntry", {
      localNote: "Local note",
      remoteNote: "Remote note",
      localAmount: "$12",
      remoteAmount: "$13",
    })
    expect(summary).toContain("$12")
    expect(summary).toContain("$13")
    expect(summary).not.toContain("{{")
    expect(i18n.t("ui.conflictTitle", { count: 2 })).not.toContain("{{")
    expect(i18n.t("ui.syncDetails.complete", { summary })).toContain(summary)
    const value = i18n.t("analytics.charts.common.amountWithPercentage", {
      amount: "$1,234.50",
      percentage: "96.5%",
    })
    expect(value).toContain("$1,234.50")
    expect(value).toContain("96.5%")
    expect(value).not.toContain("{{")
    for (const key of [
      "syncing",
      "syncSuccess",
      "syncError",
      "pendingChanges",
      "actionFailed",
    ]) {
      expect(i18n.t(`ui.${key}`)).toBe(translation.ui[key])
    }
  }
)
