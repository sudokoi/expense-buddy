import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddyUtilsNativeModule } from "./ExpenseBuddyUtils.types"

export default requireOptionalNativeModule<ExpenseBuddyUtilsNativeModule>(
  "ExpenseBuddyUtils"
)
