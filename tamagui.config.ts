import { defaultConfig } from "@tamagui/config/v4"
import { createTamagui } from "tamagui"

export const config = createTamagui(defaultConfig)

export default config

export type Conf = typeof config

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends Conf {}
}
