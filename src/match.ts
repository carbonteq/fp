import type { Option } from "./option.ts";
import type { Result } from "./result.ts";

export const matchRes = <T, E, U>(
  r: Result<T, E>,
  branches: { Ok: (val: T) => U; Err: (err: E) => U },
): U => {
  return r.match(branches);
};

export const matchOpt = <T, U>(
  o: Option<T>,
  branches: { Some: (val: T) => U; None: () => U },
): U => {
  return o.match(branches);
};
