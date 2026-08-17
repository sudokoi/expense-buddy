/**
 * Numeric UI tokens used in inline `style` objects and non-className contexts.
 *
 * These values must stay in sync with `tailwind.config.js` (borderRadius scale)
 * and the spacing scale assumed by NativeWind (1 unit = 4px, inlineRem = 16).
 */

export const UI_SPACE = {
  micro: 4,
  control: 8,
  section: 12,
  gutter: 20,
  block: 24,
  empty: 40,
} as const

export const UI_RADIUS = {
  control: 12,
  chip: 14,
  surface: 20,
  round: 999,
} as const

export const UI_Z_INDEX = {
  banner: 9998,
  toast: 9999,
  floating: 10000,
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
