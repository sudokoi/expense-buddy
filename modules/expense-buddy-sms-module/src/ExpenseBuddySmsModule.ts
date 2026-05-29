import { requireOptionalNativeModule } from "expo"

import { ExpenseBuddySmsNativeModule } from "./ExpenseBuddySms.types"

export default requireOptionalNativeModule<ExpenseBuddySmsNativeModule>("ExpenseBuddySms")
