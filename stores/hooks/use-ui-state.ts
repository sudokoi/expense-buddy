import { useCallback } from "react"
import { useSelector } from "@xstate/store-react"
import { useStoreContext } from "../store-provider"

export const useUIState = () => {
  const { uiStateStore } = useStoreContext()

  const paymentMethodSectionExpanded = useSelector(
    uiStateStore,
    (state) => state.context.paymentMethodSectionExpanded
  )
  const paymentInstrumentsSectionExpanded = useSelector(
    uiStateStore,
    (state) => state.context.paymentInstrumentsSectionExpanded
  )

  const setPaymentMethodExpanded = useCallback(
    (expanded: boolean) => uiStateStore.trigger.setPaymentMethodExpanded({ expanded }),
    [uiStateStore]
  )

  const setPaymentInstrumentsExpanded = useCallback(
    (expanded: boolean) =>
      uiStateStore.trigger.setPaymentInstrumentsExpanded({ expanded }),
    [uiStateStore]
  )

  return {
    paymentMethodSectionExpanded,
    paymentInstrumentsSectionExpanded,
    setPaymentMethodExpanded,
    setPaymentInstrumentsExpanded,
  }
}
