import { Option } from './option';
import { Result } from './result';

type MonadicType<T, E = never> = Result<T, E> | Option<T>;

type ResultBranches<T, E, U> = { Ok: (val: T) => U; Err: (err: E) => U };
type OptionBranches<T, U> = { Some: (val: T) => U; None: () => U };

type Branches<T, U> = T extends Result<unknown, unknown>
  ? ResultBranches<UnwrapResult<T>, UnwrapResultError<T>, U>
  : T extends Option<unknown>
  ? OptionBranches<UnwrapOption<T>, U>
  : never;

type UnwrapResult<T> = T extends Result<infer U, any> ? U : never;
type UnwrapResultError<T> = T extends Result<any, infer E> ? E : never;
type UnwrapOption<T> = T extends Option<infer U> ? U : never;

/**
 * Matches a monadic type (Result or Option) and executes the corresponding branch.
 * @param {Result<T, E> | Option<T>} r - The monadic value to match.
 * @param {Branches<typeof m, U>} branches - The branches to execute based on the monadic value.
 * @returns {U} The result of executing the matched branch.
 * @template U - The type of the return value.
 * 
 * @example
 * const result = Result.Ok(23);
 * 
 * const resultValue = match(result, {
 *   Ok: (val) => `Success: ${val}`, // this gets executed
 *   Err: (err) => `Error: ${err}`,
 * });
 * 
 */
export const match = <T extends MonadicType<unknown, unknown>, U>(
  m: T,
  branches: Branches<T, U>
): U => {
  if (m instanceof Result) {
    if (m.isOk()) {
      return (branches as ResultBranches<unknown, unknown, U>).Ok(m.unwrap());
    }
    return (branches as ResultBranches<unknown, unknown, U>).Err(m.unwrapErr());
  } else if (m instanceof Option) {
    if (m.isSome()) {
      return (branches as OptionBranches<unknown, U>).Some(m.unwrap());
    }
    return (branches as OptionBranches<unknown, U>).None();
  }
  throw new Error('Unsupported monad type');
};

export const matchRes = <T, E, U>(
  r: Result<T, E>,
  branches: { Ok: (val: T) => U; Err: (err: E) => U },
): U => {
  if (r.isOk()) {
    return branches.Ok(r.unwrap());
  } else {
    return branches.Err(r.unwrapErr());
  }
};

export const matchOpt = <T, U>(
  o: Option<T>,
  branches: { Some: (val: T) => U; None: () => U },
): U => {
  if (o.isSome()) {
    return branches.Some(o.unwrap());
  } else {
    return branches.None();
  }
};
