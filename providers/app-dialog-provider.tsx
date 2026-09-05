import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"
import { Keyboard } from "react-native"
import { AppDialog } from "../components/ui/AppDialog"
import { createAppDialogQueue, type AppDialogAction } from "../utils/app-dialog-queue"
import { useNotifications } from "../stores/hooks"
import i18next from "i18next"

const AppDialogContext = createContext<ReturnType<typeof createAppDialogQueue> | null>(
  null
)

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const { addNotification } = useNotifications()
  const [queue] = useState(() =>
    createAppDialogQueue((error) => {
      console.warn("Dialog action failed:", error)
      addNotification(i18next.t("ui.actionFailed"), "error")
    })
  )
  const dialog = useSyncExternalStore(queue.subscribe, queue.getSnapshot)

  return (
    <AppDialogContext.Provider value={queue}>
      {children}
      {dialog ? (
        <AppDialog
          key={dialog.id}
          title={dialog.title}
          message={dialog.message}
          actions={dialog.actions}
          onAction={(index) => queue.choose(dialog.id, index)}
          onDismiss={() => queue.dismiss(dialog.id)}
        />
      ) : null}
    </AppDialogContext.Provider>
  )
}

/** Cancels pending prompts when their initiating component leaves the tree. */
export function useAppDialog() {
  const queue = useContext(AppDialogContext)
  if (!queue) throw new Error("useAppDialog requires AppDialogProvider")
  const owner = useRef(Symbol("dialog-owner")).current
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      queue.cancelOwner(owner)
    }
  }, [owner, queue])

  const showDialog = useCallback(
    (title: string, message: string, actions: AppDialogAction[]) => {
      if (mounted.current) Keyboard.dismiss()
      queue.show(owner, title, message, actions)
      // Async work may finish after navigation. Settle its cancellation, never show it.
      if (!mounted.current) queue.cancelOwner(owner)
    },
    [owner, queue]
  )
  return { showDialog }
}
