export interface AppDialogAction {
  text: string
  style?: "default" | "cancel" | "destructive"
  onPress?: () => unknown
}

export interface AppDialogRequest {
  id: number
  owner: symbol
  title: string
  message: string
  actions: AppDialogAction[]
}

/** One visible confirmation at a time; every request can settle at most once. */
export function createAppDialogQueue(onError: (error: unknown) => void) {
  let requests: AppDialogRequest[] = []
  let nextId = 0
  const listeners = new Set<() => void>()
  const publish = () => listeners.forEach((listener) => listener())
  const run = (action?: AppDialogAction) => {
    if (action?.onPress) void Promise.resolve().then(action.onPress).catch(onError)
  }
  const cancel = (request: AppDialogRequest) =>
    run(request.actions.find((action) => action.style === "cancel"))

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot: () => requests[0] ?? null,
    show(owner: symbol, title: string, message: string, actions: AppDialogAction[]) {
      const id = ++nextId
      requests = [...requests, { id, owner, title, message, actions }]
      publish()
      return id
    },
    choose(id: number, actionIndex: number) {
      const current = requests[0]
      if (current?.id !== id || !current.actions[actionIndex]) return
      requests = requests.slice(1)
      publish()
      run(current.actions[actionIndex])
    },
    dismiss(id: number) {
      const current = requests[0]
      if (current?.id !== id) return
      requests = requests.slice(1)
      publish()
      cancel(current)
    },
    cancelOwner(owner: symbol) {
      const cancelled = requests.filter((request) => request.owner === owner)
      requests = requests.filter((request) => request.owner !== owner)
      publish()
      cancelled.forEach(cancel)
    },
  }
}
