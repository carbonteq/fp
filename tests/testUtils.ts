export const expectSyncValue = <T>(value: T | Promise<T>): T => {
  if (value instanceof Promise) {
    throw new Error("Expected synchronous value but received a Promise")
  }

  return value
}
