import { useCallback } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../stores/store-provider"
import { DISPLAY_DENSITY, type DisplayDensity } from "../constants/display-density"

export function useDisplayDensity() {
  const { uiStateStore } = useStoreContext()
  const density = useSelector(uiStateStore, (state) => state.context.displayDensity)
  const setDensity = useCallback(
    (value: DisplayDensity) => uiStateStore.trigger.setDisplayDensity({ density: value }),
    [uiStateStore]
  )
  return { density, setDensity, ...DISPLAY_DENSITY[density] }
}
