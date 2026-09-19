// Same-tab pub/sub for "something arrived" signals between hooks and screens
// that don't share a React tree (e.g. the notification bell in the shell and
// the Inquiry Management page). Not a data store — subscribers refetch.

export type AppEventName = "notification-arrived"

const target = new EventTarget()

export function emitAppEvent(name: AppEventName) {
  target.dispatchEvent(new Event(name))
}

export function onAppEvent(name: AppEventName, cb: () => void): () => void {
  target.addEventListener(name, cb)
  return () => target.removeEventListener(name, cb)
}
