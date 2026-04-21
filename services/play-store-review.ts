import { Platform } from "react-native"
import ExpenseBuddyPlayCoreModule, {
  type ExpenseBuddyPlayCoreNativeModule,
} from "../modules/expense-buddy-play-core"

let moduleOverride: ExpenseBuddyPlayCoreNativeModule | null = null

export function setPlayStoreReviewModuleForTesting(
  nextModule: ExpenseBuddyPlayCoreNativeModule | null
): void {
  moduleOverride = nextModule
}

function getModule(): ExpenseBuddyPlayCoreNativeModule {
  if (Platform.OS !== "android") {
    throw new Error("Play Store in-app reviews are unavailable in this build")
  }

  const installedModule = moduleOverride ?? ExpenseBuddyPlayCoreModule
  if (!installedModule) {
    throw new Error("Play Store core module is not registered yet")
  }

  return installedModule
}

export async function requestPlayStoreReview(): Promise<void> {
  await getModule().requestReviewAsync()
}
