import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddyBackgroundSmsNativeModule } from "./ExpenseBuddyBackgroundSms.types"

export default requireOptionalNativeModule<ExpenseBuddyBackgroundSmsNativeModule>(
  "ExpenseBuddyBackgroundSms"
)
