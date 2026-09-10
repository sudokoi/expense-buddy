import profiles from "./display-density.json"

export type DisplayDensity = keyof typeof profiles
export type DensityTokens = typeof profiles.standard
export const DISPLAY_DENSITY = profiles

export function normalizeDisplayDensity(value: unknown): DisplayDensity {
  return value === "compact" ? "compact" : "standard"
}

/** Numbers are native logical units; Android still applies its text scaling. */
export function densityVariables(density: DisplayDensity): Record<string, number> {
  return Object.fromEntries(
    Object.entries(profiles[density]).flatMap(([group, values]) =>
      Object.entries(values).map(([name, value]) => [`--${group}-${name}`, value])
    )
  )
}

export function densityTabHeight(
  density: DisplayDensity,
  fontScale: number,
  bottom: number
) {
  return profiles[density].layout.tab + Math.max(0, fontScale - 1) * 24 + bottom
}
