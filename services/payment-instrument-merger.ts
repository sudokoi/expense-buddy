import type { PaymentInstrument } from "../types/payment-instrument"

export interface MergePaymentInstrumentsResult {
  merged: PaymentInstrument[]
  addedFromRemote: PaymentInstrument[]
  updatedFromRemote: PaymentInstrument[]
  addedFromLocal: PaymentInstrument[]
  updatedFromLocal: PaymentInstrument[]
}

function isNewerIso(a: string | undefined, b: string | undefined): boolean {
  if (!a) return false
  if (!b) return true
  // ISO timestamps are lexicographically comparable.
  return a > b
}

/**
 * Merge payment instruments by id.
 *
 * Strategy:
 * - Union by `id`
 * - If an id exists in both, keep the entry with the newer `updatedAt`
 * - If `updatedAt` is missing, prefer the non-missing one; otherwise prefer remote
 */
export function mergePaymentInstruments(
  local: PaymentInstrument[] | undefined,
  remote: PaymentInstrument[] | undefined
): MergePaymentInstrumentsResult {
  const localList = local ?? []
  const remoteList = remote ?? []

  const localById = new Map(localList.map((i) => [i.id, i]))
  const remoteById = new Map(remoteList.map((i) => [i.id, i]))

  const ids = new Set<string>([...localById.keys(), ...remoteById.keys()])

  const merged: PaymentInstrument[] = []
  const addedFromRemote: PaymentInstrument[] = []
  const updatedFromRemote: PaymentInstrument[] = []
  const addedFromLocal: PaymentInstrument[] = []
  const updatedFromLocal: PaymentInstrument[] = []

  for (const id of ids) {
    const localInst = localById.get(id)
    const remoteInst = remoteById.get(id)

    if (!localInst && remoteInst) {
      merged.push(remoteInst)
      addedFromRemote.push(remoteInst)
      continue
    }

    if (localInst && !remoteInst) {
      merged.push(localInst)
      addedFromLocal.push(localInst)
      continue
    }

    if (!localInst || !remoteInst) continue

    // Prefer newer updatedAt; on ties (including both missing), prefer remote.
    const chooseRemote =
      isNewerIso(remoteInst.updatedAt, localInst.updatedAt) ||
      !isNewerIso(localInst.updatedAt, remoteInst.updatedAt)

    if (chooseRemote) {
      merged.push(remoteInst)
      if (remoteInst.updatedAt !== localInst.updatedAt) {
        updatedFromRemote.push(remoteInst)
      }
    } else {
      merged.push(localInst)
      if (localInst.updatedAt !== remoteInst.updatedAt) {
        updatedFromLocal.push(localInst)
      }
    }
  }

  // Stable order for hashing/debugging
  merged.sort((a, b) => a.id.localeCompare(b.id))

  return {
    merged,
    addedFromRemote,
    updatedFromRemote,
    addedFromLocal,
    updatedFromLocal,
  }
}
