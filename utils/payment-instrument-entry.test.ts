import {
  getAvailableInstruments,
  resolveInstrumentChoice,
} from "./payment-instrument-entry"
import type { InstrumentEntry } from "./payment-instrument-entry"
import type { PaymentInstrument } from "../types/payment-instrument"

const instrument = (
  id: string,
  nickname: string,
  method: PaymentInstrument["method"] = "Credit Card"
): PaymentInstrument => ({
  id,
  nickname,
  method,
  lastDigits: method === "UPI" ? "123" : "1234",
  createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
})
const saved: InstrumentEntry = {
  kind: "saved",
  selectedInstrumentId: "card",
  manualDigits: "1234",
}

describe("instrument entry choices", () => {
  const records = [
    instrument("card", "Travel"),
    instrument("none", "Daily"),
    instrument("bank", "UPI", "UPI"),
    { ...instrument("old", "Archived"), deletedAt: "2026-09-06" },
  ]
  it("sorts active choices for the selected method without mutating settings", () => {
    const original = structuredClone(records)
    expect(
      getAvailableInstruments(records, "Credit Card").map((item) => item.id)
    ).toEqual(["none", "card"])
    expect(getAvailableInstruments(records, "UPI").map((item) => item.id)).toEqual([
      "bank",
    ])
    expect(records).toEqual(original)
  })
  it("clears both saved ID and digits when choosing no identifier", () => {
    expect(resolveInstrumentChoice("none", records, saved)).toEqual({
      kind: "none",
      selectedInstrumentId: undefined,
      manualDigits: "",
    })
  })
  it("keeps one-off digits only when already in manual mode", () => {
    expect(resolveInstrumentChoice("manual", records, saved)?.manualDigits).toBe("")
    expect(
      resolveInstrumentChoice("manual", records, { kind: "manual", manualDigits: "456" })
    ).toEqual({ kind: "manual", selectedInstrumentId: undefined, manualDigits: "456" })
  })
  it("copies the selected instrument snapshot and avoids sentinel ID collisions", () => {
    expect(resolveInstrumentChoice("saved:none", records, saved)).toEqual({
      kind: "saved",
      selectedInstrumentId: "none",
      manualDigits: "1234",
    })
  })
  it.each(["saved:old", "saved:bank", "saved:missing", "unknown"])(
    "rejects unavailable choice %s without altering the current entry",
    (choice) => {
      expect(
        resolveInstrumentChoice(
          choice,
          getAvailableInstruments(records, "Credit Card"),
          saved
        )
      ).toBeNull()
      expect(saved.selectedInstrumentId).toBe("card")
    }
  )
})
