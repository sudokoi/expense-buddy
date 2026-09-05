import type {
  PaymentInstrument,
  PaymentInstrumentMethod,
} from "../types/payment-instrument"

export type InstrumentEntryKind = "none" | "manual" | "saved"
export interface InstrumentEntry {
  kind: InstrumentEntryKind
  selectedInstrumentId?: string
  manualDigits: string
}

export function getAvailableInstruments(
  instruments: PaymentInstrument[],
  method: PaymentInstrumentMethod
) {
  return instruments
    .filter((instrument) => !instrument.deletedAt && instrument.method === method)
    .sort((a, b) => a.nickname.localeCompare(b.nickname))
}

/** Resolve explicit user choices only; never silently repair a historical expense. */
export function resolveInstrumentChoice(
  value: string,
  available: PaymentInstrument[],
  current: InstrumentEntry
): InstrumentEntry | null {
  if (value === "none")
    return { kind: "none", selectedInstrumentId: undefined, manualDigits: "" }
  if (value === "manual")
    return {
      kind: "manual",
      selectedInstrumentId: undefined,
      manualDigits: current.kind === "manual" ? current.manualDigits : "",
    }
  const instrument = available.find(
    (item) => value === `saved:${item.id}` && !item.deletedAt
  )
  return instrument
    ? {
        kind: "saved",
        selectedInstrumentId: instrument.id,
        manualDigits: instrument.lastDigits,
      }
    : null
}
