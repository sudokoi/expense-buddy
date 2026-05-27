import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddyLoggerNativeModule } from "./ExpenseBuddyLogger.types"

export default requireOptionalNativeModule<ExpenseBuddyLoggerNativeModule>(
  "ExpenseBuddyLogger"
)
