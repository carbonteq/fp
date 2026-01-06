export function isPromiseLike<T>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    (typeof value === "object" || typeof value === "function") &&
    // @ts-expect-error: we are checking for .then property existence
    typeof value.then === "function"
  );
}
