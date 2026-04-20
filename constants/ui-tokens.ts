import { getVariableValue, type Variable } from "tamagui"
import config from "../tamagui.config"

function resolveNumericTokenValue(token: number | string | Variable<number>): number {
  return Number(getVariableValue(token))
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