import { defaultConfig } from "@tamagui/config/v4"
import { createTamagui, Variable } from "tamagui"

// Extend default config with custom semantic color tokens
export const config = createTamagui({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    color: {
      // Preserve any existing color tokens from default config
      ...(defaultConfig.tokens as { color?: Record<string, string> }).color,
      // Semantic expense colors
      expenseRed: "#ef4444",
      expenseRedLight: "#fecaca",
      incomeGreen: "#22c55e",
      incomeGreenLight: "#bbf7d0",
      // Status colors
      success: "#22c55e",
      error: "#ef4444",
      warning: "#f59e0b",
      info: "#3b82f6",
    },
  },
})

export default config

export type Conf = typeof config

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends Conf {}
}

/**
 * Extracts the raw color value from a Tamagui theme variable.
 * Returns a type that's compatible with Tamagui's color props.
 */
export function getColorValue(
  variable: Variable<string> | string | undefined
): `#${string}` {
  if (!variable) return "#000000"
  if (typeof variable === "string") return variable as `#${string}`
  return variable.val as `#${string}`
}
