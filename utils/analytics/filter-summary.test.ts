import type { TFunction } from "i18next"
import type { PaymentInstrument } from "../../types/payment-instrument"
import {
  methodShortLabel,
  formatListBreakdown,
  paymentMethodLabel,
  formatSelectedPaymentInstrumentLabel,
  formatSelectedPaymentInstrumentsSummary,
  showPaymentInstrumentFilter,
  prunePaymentInstrumentSelection,
} from "./filter-summary"

const t = ((key: string) => key) as TFunction

function makeInstrument(overrides: Partial<PaymentInstrument> = {}): PaymentInstrument {
  return {
    id: overrides.id ?? "inst-1",
    method: overrides.method ?? "Credit Card",
    nickname: overrides.nickname ?? "HDFC",
    lastDigits: overrides.lastDigits ?? "1234",
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00Z",
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00Z",
    deletedAt: overrides.deletedAt,
  }
}

describe("methodShortLabel", () => {
  it("shortens known instrument methods", () => {
    expect(methodShortLabel("Credit Card")).toBe("CC")
    expect(methodShortLabel("Debit Card")).toBe("DC")
    expect(methodShortLabel("UPI")).toBe("UPI")
  })

  it("passes unknown methods through", () => {
    expect(methodShortLabel("Cash")).toBe("Cash")
  })
})

describe("formatListBreakdown", () => {
  it("returns the all label for an empty list", () => {
    expect(formatListBreakdown([], "All")).toBe("All")
  })

  it("returns a single item verbatim", () => {
    expect(formatListBreakdown(["Food"], "All")).toBe("Food")
  })

  it("joins up to three items", () => {
    expect(formatListBreakdown(["B", "A", "C"], "All")).toBe("A, B, C")
  })

  it("caps at three and shows the remainder", () => {
    expect(formatListBreakdown(["A", "B", "C", "D", "E"], "All")).toBe("A, B, C, +2")
  })
})

describe("paymentMethodLabel", () => {
  it("maps the none key to the none label", () => {
    expect(paymentMethodLabel("__none__", t)).toBe("analytics.chart.none")
  })

  it("maps a payment method to its i18n key", () => {
    expect(paymentMethodLabel("Credit Card", t)).toBe("paymentMethods.creditCard")
  })
})

describe("formatSelectedPaymentInstrumentLabel", () => {
  it("shows others for the others key", () => {
    expect(formatSelectedPaymentInstrumentLabel("Credit Card::__others__", [], t)).toBe(
      "CC • analytics.chart.others"
    )
  })

  it("falls back to others for a missing or deleted instrument", () => {
    const deleted = makeInstrument({ id: "inst-9", deletedAt: "2026-02-01T00:00:00Z" })
    expect(
      formatSelectedPaymentInstrumentLabel("Credit Card::inst-9", [deleted], t)
    ).toBe("CC • analytics.chart.others")
  })

  it("renders a live instrument", () => {
    const inst = makeInstrument({ id: "inst-1", lastDigits: "1234" })
    expect(formatSelectedPaymentInstrumentLabel("Credit Card::inst-1", [inst], t)).toBe(
      "CC • HDFC • ****1234"
    )
  })
})

describe("formatSelectedPaymentInstrumentsSummary", () => {
  it("returns the all label for no selection", () => {
    expect(formatSelectedPaymentInstrumentsSummary([], t)).toBe(
      "analytics.timeWindow.all"
    )
  })

  it("returns a count of one", () => {
    expect(formatSelectedPaymentInstrumentsSummary(["Credit Card::inst-1"], t)).toBe("1")
  })

  it("groups counts by short method label", () => {
    const keys = ["Credit Card::inst-1", "Credit Card::inst-2", "UPI::inst-3"]
    expect(formatSelectedPaymentInstrumentsSummary(keys, t)).toBe("3 (CC 2, UPI 1)")
  })
})

describe("showPaymentInstrumentFilter", () => {
  it("is false when no instruments are configured", () => {
    expect(showPaymentInstrumentFilter([], [])).toBe(false)
  })

  it("is true when any instrument method is configured and unfiltered", () => {
    expect(showPaymentInstrumentFilter([makeInstrument()], [])).toBe(true)
  })

  it("is false when the selected method has no instruments", () => {
    const upi = makeInstrument({ method: "UPI" })
    expect(showPaymentInstrumentFilter([upi], ["Credit Card"])).toBe(false)
  })

  it("is true when the selected method has instruments", () => {
    const cc = makeInstrument({ method: "Credit Card" })
    expect(showPaymentInstrumentFilter([cc], ["Credit Card"])).toBe(true)
  })

  it("ignores deleted instruments", () => {
    const deleted = makeInstrument({ deletedAt: "2026-02-01T00:00:00Z" })
    expect(showPaymentInstrumentFilter([deleted], [])).toBe(false)
  })
})

describe("prunePaymentInstrumentSelection", () => {
  it("returns an empty selection unchanged", () => {
    expect(prunePaymentInstrumentSelection([], [], [])).toEqual([])
  })

  it("keeps selections whose method still has a configured instrument", () => {
    const cc = makeInstrument({ method: "Credit Card" })
    const selection = ["Credit Card::inst-1"]
    expect(prunePaymentInstrumentSelection(["Credit Card"], selection, [cc])).toEqual(
      selection
    )
  })

  it("drops selections whose method lost its instrument config", () => {
    const upi = makeInstrument({ id: "inst-3", method: "UPI" })
    const selection = ["Credit Card::inst-1", "UPI::inst-3"]
    expect(prunePaymentInstrumentSelection(["UPI"], selection, [upi])).toEqual([
      "UPI::inst-3",
    ])
  })

  it("keeps everything when methods reset to All", () => {
    const cc = makeInstrument({ method: "Credit Card" })
    const upi = makeInstrument({ id: "inst-3", method: "UPI" })
    const selection = ["Credit Card::inst-1", "UPI::inst-3"]
    expect(prunePaymentInstrumentSelection([], selection, [cc, upi])).toEqual(selection)
  })
})
