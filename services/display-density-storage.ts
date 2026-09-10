import { getItem, getItemSync, setItem } from "./storage"
import {
  normalizeDisplayDensity,
  type DisplayDensity,
} from "../constants/display-density"

const KEY = "display_density_v1"
let pendingWrite = Promise.resolve()

export function loadDisplayDensitySync(): DisplayDensity {
  return normalizeDisplayDensity(getItemSync(KEY))
}

export async function loadDisplayDensity(): Promise<DisplayDensity> {
  return normalizeDisplayDensity(await getItem(KEY))
}

/** Serialize fallback writes too, so the last selection wins after rapid taps. */
export function saveDisplayDensity(value: DisplayDensity): Promise<void> {
  const write = pendingWrite.then(() => setItem(KEY, value))
  pendingWrite = write.catch(() => undefined)
  return write
}
