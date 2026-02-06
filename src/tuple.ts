const TUPLE_KEY = Symbol.for("TUPLE")

export interface Tuple<Inner> extends Array<Inner> {
  [TUPLE_KEY]: boolean
}

export const setAsTuple = <Inner, T extends Array<Inner>>(
  arr: T,
): Tuple<Inner> => {
  //@ts-expect-error
  const res = arr as Tuple<Inner>

  res[TUPLE_KEY] = true

  return res
}

export const isTuple = <Inner>(t: unknown): t is Tuple<Inner> =>
  //@ts-expect-error
  Object.hasOwn(t, TUPLE_KEY)

export type AppendToTuple<T, U> = T extends [...infer Rest, infer L]
  ? [...Rest, L, U]
  : [T, U]
