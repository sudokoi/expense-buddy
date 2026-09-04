import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddyWidgetNativeModule } from "./ExpenseBuddyWidget.types"

export default requireOptionalNativeModule<ExpenseBuddyWidgetNativeModule>(
  "ExpenseBuddyWidget"
)
