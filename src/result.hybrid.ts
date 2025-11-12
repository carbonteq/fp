import { isPromise } from "node:util/types";
import { UNIT } from "./unit.js";

// Error classes
export class UnwrappedErrWithOk extends Error {
  constructor(result: string) {
    super(`Attempted to call unwrapErr on an Ok result: ${result}`);
    this.name = "UnwrappedErrWithOk";
  }
}

export class UnwrappedOkWithErr extends Error {
  constructor(result: string) {
    super(`Attempted to call unwrap on an Err result: ${result}`);
    this.name = "UnwrappedOkWithErr";
  }
}

// Core types for hybrid Result implementation
type SyncResult<T, E> = { ok: true; value: T } | { ok: false; error: E };

type Mode = "sync" | "async";
type MaybePromise<T> = T | Promise<T>;

type ResultState<T, E, M extends Mode> = M extends "async"
  ? Promise<SyncResult<T, E>>
  : SyncResult<T, E>;

type Promote<M extends Mode, R> = M extends "async"
  ? "async"
  : R extends Promise<unknown>
    ? "async"
    : "sync";

const isPromiseLike = <T>(value: MaybePromise<T>): value is Promise<T> =>
  typeof (value as Promise<T>)?.then === "function";

// Type guards for discriminated union
const isOkResult = <T, E>(
  result: SyncResult<T, E>,
): result is { ok: true; value: T } => result.ok;

const isErrResult = <T, E>(
  result: SyncResult<T, E>,
): result is { ok: false; error: E } => !result.ok;

// Error mapper type and state
type ErrorMapper = (unknown: unknown) => unknown;
let globalErrorMapper: ErrorMapper = (err) => err;

export type UnitResult<E = never> = HybridResult<UNIT, E>;

// Type helpers for Result.all
type UnwrapResult<R> = R extends HybridResult<infer T, infer E>
  ? { ok: T; err: E }
  : never;

type CombinedResultOk<T extends HybridResult<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["ok"];
};

type CombinedResultErr<T extends HybridResult<unknown, unknown>[]> = {
  [K in keyof T]: UnwrapResult<T[K]>["err"];
}[number];

export class HybridResult<T, E = unknown> {
  private constructor(
    private readonly state: SyncResult<T, E> | Promise<SyncResult<T, E>>,
  ) {}

  // Static constructors
  static Ok<T, E = never>(value: MaybePromise<T>): HybridResult<T, E> {
    if (isPromiseLike(value)) {
      return new HybridResult(
        Promise.resolve(value).then((v) => ({ ok: true as const, value: v })),
      );
    }

    return new HybridResult({ ok: true as const, value });
  }

  static Err<E, T = never>(error: MaybePromise<E>): HybridResult<T, E> {
    if (isPromiseLike(error)) {
      return new HybridResult(
        Promise.resolve(error).then((e) => ({
          ok: false as const,
          error: globalErrorMapper(e) as E,
        })),
      );
    }

    return new HybridResult({
      ok: false as const,
      error: globalErrorMapper(error) as E,
    });
  }

  static readonly UNIT_RESULT = HybridResult.Ok(UNIT) as UnitResult;

  // Error mapper configuration
  static setErrorMapper(mapper: ErrorMapper): void {
    globalErrorMapper = mapper;
  }

  static resetErrorMapper(): void {
    globalErrorMapper = (err) => err;
  }

  // Private helper methods
  private static fromState<T, E>(
    state: SyncResult<T, E> | Promise<SyncResult<T, E>>,
  ): HybridResult<T, E> {
    return new HybridResult(state);
  }

  private static tryInvoke<T, E, U>(
    fn: (value: T) => MaybePromise<U>,
    value: T,
  ): SyncResult<U, E | unknown> | Promise<SyncResult<U, E | unknown>> {
    try {
      const out = fn(value);
      if (isPromiseLike(out)) {
        return Promise.resolve(out)
          .then((v) => ({ ok: true as const, value: v }))
          .catch((err) => ({
            ok: false as const,
            error: globalErrorMapper(err),
          }));
      }
      return { ok: true as const, value: out };
    } catch (err) {
      return { ok: false as const, error: globalErrorMapper(err) };
    }
  }

  // Guards
  isOk(): this is HybridResult<T, never> {
    if (isPromiseLike(this.state)) {
      // Can't determine synchronously for async results
      return false;
    }
    const syncState = this.state as SyncResult<T, E>;
    return syncState.ok;
  }

  isErr(): this is HybridResult<never, E> {
    if (isPromiseLike(this.state)) {
      // Can't determine synchronously for async results
      return false;
    }
    const syncState = this.state as SyncResult<T, E>;
    return !syncState.ok;
  }

  toString(): string {
    if (isPromiseLike(this.state)) {
      return "Result::Promise<...>";
    }

    const syncState = this.state as SyncResult<T, E>;
    return this.formatSyncResult(syncState);
  }

  private formatSyncResult(state: SyncResult<T, E>): string {
    if (isOkResult(state)) {
      return `Result::Ok<${String(state.value)}>`;
    }
    return `Result::Err<${String(state.error)}>`;
  }

  // Safe unwrap - returns null for Err results or promises
  safeUnwrap(): T | null {
    if (isPromiseLike(this.state)) {
      return null;
    }

    const syncState = this.state as SyncResult<T, E>;
    return syncState.ok ? syncState.value : null;
  }

  // Unwrap methods - detect if async
  unwrap(): T | Promise<T> {
    if (isPromiseLike(this.state)) {
      return this.state.then((res) => this.unwrapSyncResult(res));
    }

    const syncState = this.state as SyncResult<T, E>;
    return this.unwrapSyncResult(syncState);
  }

  private unwrapSyncResult(state: SyncResult<T, E>): T {
    if (isOkResult(state)) {
      return state.value;
    }
    throw state.error instanceof Error
      ? state.error
      : new UnwrappedOkWithErr(String(state.error));
  }

  unwrapErr(): E | Promise<E> {
    if (isPromiseLike(this.state)) {
      return this.state.then((res) => this.unwrapErrSyncResult(res));
    }

    const syncState = this.state as SyncResult<T, E>;
    return this.unwrapErrSyncResult(syncState);
  }

  private unwrapErrSyncResult(state: SyncResult<T, E>): E {
    if (isOkResult(state)) {
      throw new UnwrappedErrWithOk(String(state.value));
    }
    return state.error;
  }

  // Convert to Promise<Result>
  async toPromise(): Promise<HybridResult<T, E>> {
    if (isPromiseLike(this.state)) {
      const resolved = await this.state;
      return HybridResult.fromState(resolved);
    }

    return HybridResult.fromState(this.state);
  }

  // Flip Ok <-> Err
  flip(): HybridResult<E, T> {
    if (isPromiseLike(this.state)) {
      return HybridResult.fromState(
        this.state.then((res) => this.flipSyncResult(res)),
      );
    }

    const syncState = this.state as SyncResult<T, E>;
    return HybridResult.fromState(this.flipSyncResult(syncState));
  }

  private flipSyncResult(state: SyncResult<T, E>): SyncResult<E, T> {
    if (isOkResult(state)) {
      return { ok: false as const, error: state.value };
    }
    return { ok: true as const, value: state.error };
  }

  // Helper to create result from settled promise
  static async fromPromise<T, E>(
    promise: Promise<T>,
    errorMapper?: (error: unknown) => E,
  ): Promise<HybridResult<T, E>> {
    try {
      const value = await promise;
      return HybridResult.Ok(value);
    } catch (err) {
      const mappedError = errorMapper
        ? errorMapper(err)
        : globalErrorMapper(err);
      return HybridResult.Err(mappedError as E);
    }
  }

  // Helper to safely execute functions and catch errors
  static try<T, E = unknown>(
    fn: () => MaybePromise<T>,
    errorMapper?: (error: unknown) => E,
  ): HybridResult<T, E> {
    try {
      const result = fn();
      if (isPromiseLike(result)) {
        return HybridResult.fromState(
          result
            .then((value) => ({ ok: true as const, value }))
            .catch((err) => ({
              ok: false as const,
              error: (errorMapper
                ? errorMapper(err)
                : globalErrorMapper(err)) as E,
            })),
        );
      }
      return HybridResult.Ok(result);
    } catch (err) {
      return HybridResult.Err(
        (errorMapper ? errorMapper(err) : globalErrorMapper(err)) as E,
      );
    }
  }

  // Phase 2: Combinators & Aggregation

  /**
   * Maps the Ok value using the provided mapper function.
   * Promotes to async if the mapper returns a promise.
   *
   * @param fn Function to map the Ok value
   * @returns New Result with mapped value
   */
  map<U>(fn: (value: T) => U): HybridResult<U, E>;
  map<U>(fn: (value: T) => Promise<U>): HybridResult<U, E>;
  map<U>(fn: (value: T) => MaybePromise<U>): HybridResult<U, E> {
    if (isPromiseLike(this.state)) {
      return HybridResult.fromState(
        this.state.then((res) => {
          if (isOkResult(res)) {
            return HybridResult.tryInvoke<T, E, U>(fn, res.value) as
              | SyncResult<U, E>
              | Promise<SyncResult<U, E>>;
          }
          return res as SyncResult<U, E>; // Propagate Err
        }),
      );
    }

    const syncState = this.state as SyncResult<T, E>;
    if (isOkResult(syncState)) {
      const nextState = HybridResult.tryInvoke<T, E, U>(fn, syncState.value);
      return HybridResult.fromState(
        nextState as SyncResult<U, E> | Promise<SyncResult<U, E>>,
      );
    }

    // Propagate Err
    return HybridResult.fromState(syncState as SyncResult<U, E>);
  }

  /**
   * FlatMaps the Ok value using the provided mapper function that returns a Result.
   * Promotes to async if the mapper returns a promise or the current state is async.
   *
   * @param fn Function that maps the Ok value to another Result
   * @returns New flattened Result
   */
  flatMap<U, E2>(
    fn: (value: T) => HybridResult<U, E2>,
  ): HybridResult<U, E | E2>;
  flatMap<U, E2>(
    fn: (value: T) => Promise<HybridResult<U, E2>>,
  ): HybridResult<U, E | E2>;
  flatMap<U, E2>(
    fn: (value: T) => MaybePromise<HybridResult<U, E2>>,
  ): HybridResult<U, E | E2> {
    if (isPromiseLike(this.state)) {
      return HybridResult.fromState(
        this.state.then((res) => {
          if (isOkResult(res)) {
            try {
              const mappedResult = fn(res.value);
              if (isPromiseLike(mappedResult)) {
                return mappedResult.then(
                  (result) => result.state as Promise<SyncResult<U, E2>>,
                );
              }
              return mappedResult.state as SyncResult<U, E2>;
            } catch (err) {
              return {
                ok: false as const,
                error: globalErrorMapper(err) as E | E2,
              };
            }
          }
          return res as SyncResult<U, E | E2>; // Propagate Err
        }),
      );
    }

    const syncState = this.state as SyncResult<T, E>;
    if (isOkResult(syncState)) {
      try {
        const mappedResult = fn(syncState.value);
        if (isPromiseLike(mappedResult)) {
          return HybridResult.fromState(
            mappedResult.then(
              (result) => result.state as Promise<SyncResult<U, E2>>,
            ),
          );
        }
        return HybridResult.fromState(mappedResult.state as SyncResult<U, E2>);
      } catch (err) {
        return HybridResult.fromState({
          ok: false as const,
          error: globalErrorMapper(err) as E | E2,
        });
      }
    }

    // Propagate Err
    return HybridResult.fromState(syncState as SyncResult<U, E | E2>);
  }

  /**
   * Zips the Ok value with the result of applying the mapper function.
   * Returns a tuple [originalValue, mappedValue].
   *
   * @param fn Function to map the Ok value
   * @returns New Result with tuple value
   */
  zip<U>(fn: (value: T) => U): HybridResult<[T, U], E>;
  zip<U>(fn: (value: T) => Promise<U>): HybridResult<[T, U], E>;
  zip<U>(fn: (value: T) => MaybePromise<U>): HybridResult<[T, U], E> {
    if (isPromiseLike(this.state)) {
      return HybridResult.fromState(
        this.state.then((res) => {
          if (isOkResult(res)) {
            const mapped = HybridResult.tryInvoke<T, E, U>(fn, res.value);
            if (isPromiseLike(mapped)) {
              return mapped.then((mappedRes) => {
                if (isOkResult(mappedRes)) {
                  return {
                    ok: true as const,
                    value: [res.value, mappedRes.value],
                  };
                }
                return mappedRes as SyncResult<[T, U], E>;
              });
            }
            if (isOkResult(mapped)) {
              return { ok: true as const, value: [res.value, mapped.value] };
            }
            return mapped as SyncResult<[T, U], E>;
          }
          return res as SyncResult<[T, U], E>; // Propagate Err
        }),
      );
    }

    const syncState = this.state as SyncResult<T, E>;
    if (isOkResult(syncState)) {
      const mapped = HybridResult.tryInvoke<T, E, U>(fn, syncState.value);
      if (isPromiseLike(mapped)) {
        return HybridResult.fromState(
          mapped.then((mappedRes) => {
            if (isOkResult(mappedRes)) {
              return {
                ok: true as const,
                value: [syncState.value, mappedRes.value],
              };
            }
            return mappedRes as SyncResult<[T, U], E>;
          }),
        );
      }
      if (isOkResult(mapped)) {
        return HybridResult.fromState({
          ok: true as const,
          value: [syncState.value, mapped.value],
        });
      }
      return HybridResult.fromState(mapped as SyncResult<[T, U], E>);
    }

    // Propagate Err
    return HybridResult.fromState(syncState as SyncResult<[T, U], E>);
  }

  /**
   * FlatZips the Ok value with the result of applying the mapper function that returns a Result.
   * Returns a tuple [originalValue, mappedValue] only if both results are Ok.
   *
   * @param fn Function that maps the Ok value to another Result
   * @returns New Result with tuple value
   */
  flatZip<U, E2>(
    fn: (value: T) => HybridResult<U, E2>,
  ): HybridResult<[T, U], E | E2>;
  flatZip<U, E2>(
    fn: (value: T) => Promise<HybridResult<U, E2>>,
  ): HybridResult<[T, U], E | E2>;
  flatZip<U, E2>(
    fn: (value: T) => MaybePromise<HybridResult<U, E2>>,
  ): HybridResult<[T, U], E | E2> {
    return this.flatMap((value) => {
      const mappedResult = fn(value);

      // Handle promise-returning mapper
      if (isPromiseLike(mappedResult)) {
        return HybridResult.fromState(
          mappedResult.then((result) => {
            // Convert the second result to a promise to extract its value
            return result.toPromise().then((resolvedResult) => {
              if (resolvedResult.isOk()) {
                return {
                  ok: true as const,
                  value: [value, resolvedResult.safeUnwrap()!] as [T, U],
                };
              }
              return {
                ok: false as const,
                error: resolvedResult.unwrapErr(),
              } as SyncResult<[T, U], E | E2>;
            });
          }),
        ) as HybridResult<[T, U], E | E2>;
      }

      // Handle sync mapper
      return mappedResult.map((mappedValue) => [value, mappedValue] as [T, U]);
    });
  }

  /**
   * Combines multiple Results into a single Result containing all values or all errors.
   * Promotes to async if any of the input results are async.
   *
   * @param results Array of Results to combine
   * @returns Result containing array of all values or array of all errors
   */
  static all<T extends HybridResult<unknown, unknown>[]>(
    ...results: T
  ): HybridResult<CombinedResultOk<T>, CombinedResultErr<T>[]> {
    // Check if any result is async
    const hasAsync = results.some((r) => isPromiseLike(r["state"]));

    if (hasAsync) {
      return HybridResult.fromState(
        Promise.all(results.map((r) => r.toPromise())).then(
          (resolvedResults) => {
            // Check if any resolved result is an error
            const errors = resolvedResults.filter((r) => r.isErr());
            if (errors.length > 0) {
              return {
                ok: false as const,
                error: errors.map((r) =>
                  r.unwrapErr(),
                ) as CombinedResultErr<T>[],
              };
            }

            // All results are Ok, extract values
            return {
              ok: true as const,
              value: resolvedResults.map(
                (r) => r.safeUnwrap()!,
              ) as CombinedResultOk<T>,
            };
          },
        ),
      ) as HybridResult<CombinedResultOk<T>, CombinedResultErr<T>[]>;
    }

    // All results are sync
    const errors = results.filter((r) => r.isErr());
    if (errors.length > 0) {
      return HybridResult.Err(
        errors.map((r) => r.unwrapErr()) as CombinedResultErr<T>[],
      );
    }

    // All results are Ok, extract values
    return HybridResult.Ok(
      results.map((r) => r.safeUnwrap()!) as CombinedResultOk<T>,
    );
  }

  /**
   * Validates the current Ok value against multiple validator functions.
   * Returns the original value if all validators pass, otherwise returns all validation errors.
   * Promotes to async if any validator returns a promise or the current result is async.
   *
   * @param validators Array of validator functions that return Results
   * @returns Original Result if valid, or Result with array of errors
   */
  validate<VE extends unknown[]>(
    validators: { [K in keyof VE]: (val: T) => HybridResult<unknown, VE[K]> },
  ): HybridResult<T, E | VE[number][]> {
    // If current result is Err, return it
    if (this.isErr()) {
      return this as HybridResult<T, VE[number][]>;
    }

    const currentValue = this.safeUnwrap()!;

    // Check if any validator will produce async results
    const hasAsyncValidator = validators.some((v) => {
      try {
        const result = v(currentValue);
        return isPromiseLike(result["state"]);
      } catch {
        return false;
      }
    });

    const hasAsyncCurrent = isPromiseLike(this.state);

    if (hasAsyncCurrent || hasAsyncValidator) {
      return HybridResult.fromState(
        (async () => {
          // Wait for current result if it's async
          const resolvedCurrent = await this.toPromise();

          if (resolvedCurrent.isErr()) {
            return { ok: false as const, error: resolvedCurrent.unwrapErr() };
          }

          const currentValue = resolvedCurrent.safeUnwrap()!;

          // Run all validators
          const validatorResults = await Promise.all(
            validators.map(async (v) => {
              try {
                const result = v(currentValue);
                if (isPromiseLike(result)) {
                  const resolvedResult = await result;
                  return resolvedResult.toPromise();
                }
                return result.toPromise();
              } catch (err) {
                return HybridResult.Err(err);
              }
            }),
          );

          // Check for validation errors
          const errors = validatorResults.filter((r) => r.isErr());
          if (errors.length > 0) {
            return {
              ok: false as const,
              error: errors.map((r) => r.unwrapErr()) as VE[number][],
            };
          }

          // All validations passed, return original value
          return {
            ok: true as const,
            value: currentValue,
          };
        })(),
      ) as HybridResult<T, E | VE[number][]>;
    }

    // All sync case
    try {
      const validatorResults = validators.map((v) => {
        try {
          return v(currentValue);
        } catch (err) {
          return HybridResult.Err(err);
        }
      });

      const errors = validatorResults.filter((r) => r.isErr());
      if (errors.length > 0) {
        return HybridResult.Err(
          errors.map((r) => r.unwrapErr()) as VE[number][],
        );
      }

      // All validations passed
      return this as HybridResult<T, never>;
    } catch (err) {
      return HybridResult.Err([err] as VE[number][]);
    }
  }

  /**
   * Maps the Err value using the provided mapper function.
   * Promotes to async if the mapper returns a promise or the current state is async.
   *
   * @param fn Function to map the Err value
   * @returns New Result with mapped error
   */
  mapErr<E2>(fn: (error: E) => E2): HybridResult<T, E2>;
  mapErr<E2>(fn: (error: E) => Promise<E2>): HybridResult<T, E2>;
  mapErr<E2>(fn: (error: E) => MaybePromise<E2>): HybridResult<T, E2> {
    if (isPromiseLike(this.state)) {
      return HybridResult.fromState(
        this.state.then((res) => {
          if (isOkResult(res)) {
            return { ok: true as const, value: res.value }; // Propagate Ok
          }
          // Map the error
          const mappedErrorResult = HybridResult.tryInvoke<E, never, E2>(
            fn,
            res.error,
          );
          if (isPromiseLike(mappedErrorResult)) {
            return mappedErrorResult.then((mappedRes) => {
              if (isOkResult(mappedRes)) {
                return { ok: false as const, error: mappedRes.value };
              }
              return mappedRes; // Should be an error
            });
          }
          if (isOkResult(mappedErrorResult)) {
            return { ok: false as const, error: mappedErrorResult.value };
          }
          return mappedErrorResult; // Should be an error
        }),
      );
    }

    const syncState = this.state as SyncResult<T, E>;
    if (isOkResult(syncState)) {
      // Propagate Ok
      return HybridResult.fromState({
        ok: true as const,
        value: syncState.value,
      });
    }

    // Map the error
    const mappedErrorResult = HybridResult.tryInvoke<E, never, E2>(
      fn,
      syncState.error,
    );
    if (isPromiseLike(mappedErrorResult)) {
      return HybridResult.fromState(
        mappedErrorResult.then((mappedRes) => {
          if (isOkResult(mappedRes)) {
            return { ok: false as const, error: mappedRes.value };
          }
          return mappedRes; // Should be an error
        }),
      );
    }
    if (isOkResult(mappedErrorResult)) {
      return HybridResult.fromState({
        ok: false as const,
        error: mappedErrorResult.value,
      });
    }
    return HybridResult.fromState(mappedErrorResult); // Should be an error
  }

  /**
   * Maps both Ok and Err values using the provided mapper functions.
   * Promotes to async if any mapper returns a promise or the current state is async.
   *
   * @param fnOk Function to map the Ok value
   * @param fnErr Function to map the Err value
   * @returns New Result with mapped values
   */
  mapBoth<T2, E2>(
    fnOk: (value: T) => T2,
    fnErr: (error: E) => E2,
  ): HybridResult<T2, E2>;
  mapBoth<T2, E2>(
    fnOk: (value: T) => Promise<T2>,
    fnErr: (error: E) => E2,
  ): HybridResult<T2, E2>;
  mapBoth<T2, E2>(
    fnOk: (value: T) => T2,
    fnErr: (error: E) => Promise<E2>,
  ): HybridResult<T2, E2>;
  mapBoth<T2, E2>(
    fnOk: (value: T) => MaybePromise<T2>,
    fnErr: (error: E) => MaybePromise<E2>,
  ): HybridResult<T2, E2> {
    if (isPromiseLike(this.state)) {
      return HybridResult.fromState(
        this.state.then((res) => {
          if (isOkResult(res)) {
            return HybridResult.tryInvoke<T, never, T2>(fnOk, res.value);
          }
          const mappedErrorResult = HybridResult.tryInvoke<E, never, E2>(
            fnErr,
            res.error,
          );
          if (isPromiseLike(mappedErrorResult)) {
            return mappedErrorResult.then((mappedRes) => {
              if (isOkResult(mappedRes)) {
                return { ok: false as const, error: mappedRes.value };
              }
              return mappedRes; // Should be an error
            });
          }
          if (isOkResult(mappedErrorResult)) {
            return { ok: false as const, error: mappedErrorResult.value };
          }
          return mappedErrorResult; // Should be an error
        }),
      );
    }

    const syncState = this.state as SyncResult<T, E>;
    if (isOkResult(syncState)) {
      const mappedValueResult = HybridResult.tryInvoke<T, never, T2>(
        fnOk,
        syncState.value,
      );
      if (isPromiseLike(mappedValueResult)) {
        return HybridResult.fromState(mappedValueResult);
      }
      if (isOkResult(mappedValueResult)) {
        return HybridResult.fromState({
          ok: true as const,
          value: mappedValueResult.value,
        });
      }
      return HybridResult.fromState(mappedValueResult); // Should be an error
    }

    // Map the error
    const mappedErrorResult = HybridResult.tryInvoke<E, never, E2>(
      fnErr,
      syncState.error,
    );
    if (isPromiseLike(mappedErrorResult)) {
      return HybridResult.fromState(
        mappedErrorResult.then((mappedRes) => {
          if (isOkResult(mappedRes)) {
            return { ok: false as const, error: mappedRes.value };
          }
          return mappedRes; // Should be an error
        }),
      );
    }
    if (isOkResult(mappedErrorResult)) {
      return HybridResult.fromState({
        ok: false as const,
        error: mappedErrorResult.value,
      });
    }
    return HybridResult.fromState(mappedErrorResult); // Should be an error
  }

  /**
   * Returns the provided default value if this Result is Err, otherwise returns the Ok value.
   * Does not change the async/sync mode of the Result.
   *
   * @param defaultValue Default value to return if Err
   * @returns Ok value or default value
   */
  orElse<U>(defaultValue: U): T | U;
  orElse<U>(defaultValue: Promise<U>): T | Promise<U> | Promise<T> {
    if (isPromiseLike(this.state)) {
      // For async results, we need to handle the promise
      if (isPromiseLike(defaultValue)) {
        return Promise.race([this.unwrap(), defaultValue]);
      }
      return this.unwrap();
    }

    const syncState = this.state as SyncResult<T, E>;
    if (isOkResult(syncState)) {
      return syncState.value;
    }

    return defaultValue;
  }

  /**
   * Alias for flatMap method.
   * Provides compatibility with common Result API naming conventions.
   */
  andThen<U, E2>(
    fn: (value: T) => HybridResult<U, E2>,
  ): HybridResult<U, E | E2> {
    return this.flatMap(fn);
  }

  // Export alias for backward compatibility
  static Result = HybridResult;
}
