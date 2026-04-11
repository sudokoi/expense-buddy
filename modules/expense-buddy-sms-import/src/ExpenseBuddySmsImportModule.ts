import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddySmsImportNativeModule } from "./ExpenseBuddySmsImport.types"

export default requireOptionalNativeModule<ExpenseBuddySmsImportNativeModule>(
  "ExpenseBuddySmsImport"
)
