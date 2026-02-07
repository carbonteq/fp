const TUPLE_KEY = Symbol.for("TUPLE")

/** Branded array marker used to preserve tuple intent in type guards. */
export interface Tuple<Inner> extends Array<Inner> {
  [TUPLE_KEY]: boolean
}

/** Marks an array instance as a Tuple at runtime. */
export const setAsTuple = <Inner, T extends Array<Inner>>(
  arr: T,
): Tuple<Inner> => {
  //@ts-expect-error
  const res = arr as Tuple<Inner>

  res[TUPLE_KEY] = true

  return res
}

/** Type guard that checks whether a value is a branded Tuple. */
export const isTuple = <Inner>(t: unknown): t is Tuple<Inner> =>
  //@ts-expect-error
  Object.hasOwn(t, TUPLE_KEY)

/** Appends a type to the end of an existing tuple type. */
export type AppendToTuple<T, U> = T extends [...infer Rest, infer L]
  ? [...Rest, L, U]
  : [T, U]
