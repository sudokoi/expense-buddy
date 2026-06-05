import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddyGoogleAuthNativeModule } from "./ExpenseBuddyGoogleAuth.types"

export default requireOptionalNativeModule<ExpenseBuddyGoogleAuthNativeModule>(
  "ExpenseBuddyGoogleAuth"
)
