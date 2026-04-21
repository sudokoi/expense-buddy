import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddyPlayCoreNativeModule } from "./ExpenseBuddyPlayCore.types"

export default requireOptionalNativeModule<ExpenseBuddyPlayCoreNativeModule>(
  "ExpenseBuddyPlayCore"
)
