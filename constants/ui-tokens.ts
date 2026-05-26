import { getVariableValue, type Variable } from "tamagui"
import config from "../tamagui.config"

type NumericTokenValue = number | string | { val: number | string }

function parseNumericTokenValue(value: NumericTokenValue): number {
  if (typeof value === "object" && value !== null && "val" in value) {
    return parseNumericTokenValue(value.val)
  }

  if (typeof value === "number") {
    return value
  }

  const parsedValue = Number.parseFloat(value)
  if (Number.isFinite(parsedValue)) {
    return parsedValue
  }

  throw new Error(`Expected numeric Tamagui token value, received: ${value}`)
}

function resolveNumericTokenValue(
  token: number | string | Variable<number | string | { val: number | string }>
): number {
  const resolvedValue = getVariableValue(token)
  return parseNumericTokenValue(resolvedValue as NumericTokenValue)
}

export const UI_SPACE = {
  micro: resolveNumericTokenValue(config.tokens.space.micro),
  control: resolveNumericTokenValue(config.tokens.space.control),
  section: resolveNumericTokenValue(config.tokens.space.section),
  gutter: resolveNumericTokenValue(config.tokens.space.gutter),
  block: resolveNumericTokenValue(config.tokens.space.block),
  empty: resolveNumericTokenValue(config.tokens.space.empty),
} as const

export const UI_RADIUS = {
  control: resolveNumericTokenValue(config.tokens.radius.control),
  chip: resolveNumericTokenValue(config.tokens.radius.chip),
  surface: resolveNumericTokenValue(config.tokens.radius.surface),
  round: resolveNumericTokenValue(config.tokens.radius.round),
} as const

export const UI_Z_INDEX = {
  banner: resolveNumericTokenValue(config.tokens.zIndex.banner),
  toast: resolveNumericTokenValue(config.tokens.zIndex.toast),
  floating: resolveNumericTokenValue(config.tokens.zIndex.floating),
} as const

export const UI_OPACITY = {
  strong: 0.8,
  medium: 0.7,
  subtle: 0.6,
  faint: 0.5,
  ghost: 0.4,
  minimal: 0.2,
  hidden: 0,
} as const

export const UI_FONT_WEIGHT = {
  bold: "700",
  semiBold: "600",
  medium: "500",
  normal: "400",
} as const

export const UI_BORDER_WIDTH = {
  thin: 1,
  normal: 2,
  thick: 3,
} as const

export const UI_ICON_SIZE = {
  micro: 12,
  small: 16,
  regular: 18,
  medium: 20,
  large: 24,
  xlarge: 32,
  xxlarge: 40,
  xxxlarge: 48,
  huge: 56,
} as const
