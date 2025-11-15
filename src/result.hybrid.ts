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

/**
 * Internal state matches the design outlined in docs/hybrid-result-redesign.md:
 * synchronous results stay in-memory while asynchronous cases defer to a
 * promise that eventually resolves to a `SyncResult`.
 */
type HybridState<T, E> =
  | { kind: "sync"; value: SyncResult<T, E> }
  | { kind: "async"; promise: Promise<SyncResult<T, E>> };

type MaybeAsync<T> = T | Promise<T>;

const isPromiseLike = <T>(value: MaybeAsync<T>): value is Promise<T> =>
  typeof (value as Promise<T>)?.then === "function";

// Error mapper type and state
type ErrorMapper = (unknown: unknown) => unknown;
let globalErrorMapper: ErrorMapper = (err) => err;

export type UnitResult<E = never> = HybridResult<UNIT, E>;

// Type helpers for Result.all (Phase 4)
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
  private constructor(private readonly state: HybridState<T, E>) {}

  /**
   * Utility: lift a successful synchronous value into the internal state shape.
   * Documented here so future phases can reuse the same helper without
   * duplicating the `SyncResult` literal.
   */
  private static syncOk<T, E>(value: T): SyncResult<T, E> {
    return { ok: true as const, value };
  }

  /**
   * Utility: lift a synchronous error into the internal state shape.
   */
  private static syncErr<T, E>(error: E): SyncResult<T, E> {
    return { ok: false as const, error };
  }

  /**
   * Helper to safely access the error from a SyncResult.
   */
  private static getError<T, E>(result: SyncResult<T, E>): E {
    return (result as { ok: false; error: E }).error;
  }

  /**
   * Helper to consistently apply the global error mapper before an optional
   * operation-specific mapper.
   */
  private static mapError<Err>(
    error: unknown,
    mapper?: (error: unknown) => Err,
  ): Err {
    const mapped = globalErrorMapper(error);
    return mapper ? mapper(mapped) : (mapped as Err);
  }

  /**
   * Safely executes a user provided callback, capturing thrown errors and
   * promise rejections. The callback result is re-shaped into a SyncResult so
   * callers can keep behaviour synchronous when possible.
   */
  private static invokeSafely<In, Out, Err>(
    fn: (value: In) => MaybeAsync<Out>,
    value: In,
    mapError?: (error: unknown) => Err,
  ): SyncResult<Out, Err> | Promise<SyncResult<Out, Err>> {
    const handleError = (error: unknown): Err =>
      HybridResult.mapError<Err>(error, mapError);

    try {
      const result = fn(value);
      if (isPromiseLike(result)) {
        return Promise.resolve(result)
          .then((value) => HybridResult.syncOk<Out, Err>(value))
          .catch((error) => HybridResult.syncErr<Out, Err>(handleError(error)));
      }
      return HybridResult.syncOk<Out, Err>(result);
    } catch (error) {
      return HybridResult.syncErr<Out, Err>(handleError(error));
    }
  }

  /**
   * Flattens nested HybridResult/promise combinations returned from user
   * callbacks. This keeps synchronous results synchronous while ensuring any
   * asynchronous errors still go through the global error mapper.
   */
  private static flattenHybridResult<T, InnerErr, ExtraErr = never>(
    result: HybridResult<T, InnerErr> | Promise<HybridResult<T, InnerErr>>,
    mapError?: (error: unknown) => InnerErr | ExtraErr,
  ):
    | SyncResult<T, InnerErr | ExtraErr>
    | Promise<SyncResult<T, InnerErr | ExtraErr>> {
    const handleError = (error: unknown): InnerErr | ExtraErr =>
      HybridResult.mapError<InnerErr | ExtraErr>(error, mapError);

    const widenState = (
      state: SyncResult<T, InnerErr>,
    ): SyncResult<T, InnerErr | ExtraErr> =>
      state.ok
        ? HybridResult.syncOk<T, InnerErr | ExtraErr>(state.value)
        : HybridResult.syncErr<T, InnerErr | ExtraErr>(
            HybridResult.getError(state),
          );

    const resolveState = (
      state: HybridState<T, InnerErr>,
    ):
      | SyncResult<T, InnerErr | ExtraErr>
      | Promise<SyncResult<T, InnerErr | ExtraErr>> => {
      if (state.kind === "async") {
        return state.promise
          .then(widenState)
          .catch((error) =>
            HybridResult.syncErr<T, InnerErr | ExtraErr>(handleError(error)),
          );
      }
      return widenState(state.value);
    };

    if (result instanceof HybridResult) {
      return resolveState(result.state);
    }

    return Promise.resolve(result)
      .then((inner) => HybridResult.flattenHybridResult(inner, mapError))
      .catch((error) =>
        HybridResult.syncErr<T, InnerErr | ExtraErr>(handleError(error)),
      );
  }

  // Core internal factories

  private static fromSync<T, E>(state: SyncResult<T, E>): HybridResult<T, E> {
    return new HybridResult({ kind: "sync", value: state });
  }

  private static fromAsync<T, E>(
    state: Promise<SyncResult<T, E>>,
  ): HybridResult<T, E> {
    return new HybridResult({ kind: "async", promise: state });
  }

  private isAsyncState(): boolean {
    return this.state.kind === "async";
  }

  toStatePromise(): Promise<SyncResult<T, E>> {
    return this.state.kind === "async"
      ? this.state.promise
      : Promise.resolve(this.state.value);
  }

  // Formatting

  private static formatSyncResult<T, E>(result: SyncResult<T, E>): string {
    if (result.ok) {
      return `Result::Ok<${String(result.value)}>`;
    }
    return `Result::Err<${String(HybridResult.getError(result))}>`;
  }

  toString(): string {
    if (!this.isAsyncState()) {
      return HybridResult.formatSyncResult(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
    }
    return "Result::Promise<...>";
  }

  // Core instance API (Phase 1)

  isOk(): this is HybridResult<T, never> {
    if (this.isAsyncState()) return false;
    return (this.state as { kind: "sync"; value: SyncResult<T, E> }).value.ok;
  }

  isErr(): this is HybridResult<never, E> {
    if (this.isAsyncState()) return false;
    return !(this.state as { kind: "sync"; value: SyncResult<T, E> }).value.ok;
  }

  safeUnwrap(): T | null {
    if (!this.isAsyncState()) {
      const result = (this.state as { kind: "sync"; value: SyncResult<T, E> })
        .value;
      return result.ok ? result.value : null;
    }
    return null;
  }

  unwrap(): T | Promise<T> {
    if (!this.isAsyncState()) {
      const result = (this.state as { kind: "sync"; value: SyncResult<T, E> })
        .value;
      if (result.ok) return result.value;
      throw new UnwrappedOkWithErr(HybridResult.formatSyncResult(result));
    }

    return this.toStatePromise()
      .then((result) => {
        if (result.ok) {
          return result.value;
        }
        throw new UnwrappedOkWithErr(HybridResult.formatSyncResult(result));
      })
      .catch((err) => {
        throw globalErrorMapper(err);
      });
  }

  unwrapErr(): E | Promise<E> {
    if (!this.isAsyncState()) {
      const result = (this.state as { kind: "sync"; value: SyncResult<T, E> })
        .value;
      if (!result.ok) return HybridResult.getError(result);
      throw new UnwrappedErrWithOk(HybridResult.formatSyncResult(result));
    }

    return this.toStatePromise()
      .then((result) => {
        if (!result.ok) {
          return HybridResult.getError(result);
        }
        throw new UnwrappedErrWithOk(HybridResult.formatSyncResult(result));
      })
      .catch((err) => {
        throw globalErrorMapper(err);
      });
  }

  flip(): HybridResult<E, T> {
    if (!this.isAsyncState()) {
      const result = (this.state as { kind: "sync"; value: SyncResult<T, E> })
        .value;
      if (result.ok) {
        return HybridResult.fromSync<E, T>({
          ok: false as const,
          error: result.value as unknown as E,
        } as unknown as SyncResult<E, T>);
      }
      return HybridResult.fromSync<E, T>({
        ok: true as const,
        value: HybridResult.getError(result) as unknown as T,
      } as unknown as SyncResult<E, T>);
    }

    const flipped = this.toStatePromise().then((result) => {
      if (result.ok) {
        return {
          ok: false as const,
          error: result.value as unknown as E,
        } as unknown as SyncResult<E, T>;
      }
      return {
        ok: true as const,
        value: HybridResult.getError(result) as unknown as T,
      } as unknown as SyncResult<E, T>;
    });

    return HybridResult.fromAsync(flipped);
  }

  toPromise(): Promise<HybridResult<T, E>> {
    return this.toStatePromise().then((state) =>
      HybridResult.fromSync<T, E>(state),
    );
  }

  // Static constructors

  static Ok<T, E = never>(value: MaybeAsync<T>): HybridResult<T, E> {
    if (isPromiseLike(value)) {
      const asyncState = Promise.resolve(value).then<SyncResult<T, E>>((v) => ({
        ok: true as const,
        value: v,
      }));
      return HybridResult.fromAsync(asyncState);
    }

    return HybridResult.fromSync<T, E>({ ok: true as const, value });
  }

  static Err<E, T = never>(error: MaybeAsync<E>): HybridResult<T, E> {
    if (isPromiseLike(error)) {
      const asyncState = Promise.resolve(error).then<SyncResult<T, E>>((e) => ({
        ok: false as const,
        error: globalErrorMapper(e) as E,
      }));
      return HybridResult.fromAsync(asyncState);
    }

    return HybridResult.fromSync<T, E>({
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

  // Static helpers (Phase 1)

  static try<T, E = unknown>(
    fn: () => MaybeAsync<T>,
    errorMapper?: (err: unknown) => E,
  ): HybridResult<T, E> {
    try {
      const result = fn();

      if (isPromiseLike(result)) {
        const asyncState = Promise.resolve(result)
          .then<SyncResult<T, E>>((value) => ({
            ok: true as const,
            value,
          }))
          .catch<SyncResult<T, E>>((err) => ({
            ok: false as const,
            error: (errorMapper ?? ((e) => globalErrorMapper(e)))(err) as E,
          }));
        return HybridResult.fromAsync(asyncState);
      }

      return HybridResult.fromSync<T, E>({
        ok: true as const,
        value: result,
      });
    } catch (err) {
      return HybridResult.fromSync<T, E>({
        ok: false as const,
        error: (errorMapper ?? ((e) => globalErrorMapper(e)))(err) as E,
      });
    }
  }

  static async fromPromise<T, E = unknown>(
    promise: Promise<T>,
    errorMapper?: (err: unknown) => E,
  ): Promise<HybridResult<T, E>> {
    try {
      const value = await promise;
      return HybridResult.fromSync<T, E>({
        ok: true as const,
        value,
      });
    } catch (err) {
      const mapped = (errorMapper ?? ((e: unknown) => globalErrorMapper(e)))(
        err,
      ) as E;
      return HybridResult.fromSync<T, E>({
        ok: false as const,
        error: mapped,
      });
    }
  }

  // Phase 2+ (map, flatMap, zip, etc.) will be added below using
  // fromSync/fromAsync/toStatePromise/tryInvoke.

  map<U>(fn: (value: T) => Promise<U>): HybridResult<U, E>;
  map<U>(fn: (value: T) => U): HybridResult<U, E>;
  map<U>(fn: (value: T) => MaybeAsync<U>): HybridResult<U, E> {
    const applyMapper = (
      state: SyncResult<T, E>,
    ): SyncResult<U, E> | Promise<SyncResult<U, E>> => {
      if (!state.ok) {
        return HybridResult.syncErr<U, E>(HybridResult.getError(state));
      }

      return HybridResult.invokeSafely<T, U, E>(fn, state.value);
    };

    if (!this.isAsyncState()) {
      const next = applyMapper(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(next as Promise<SyncResult<U, E>>);
      }
      return HybridResult.fromSync(next as SyncResult<U, E>);
    }

    const asyncState = this.toStatePromise()
      .then(applyMapper)
      .catch((error) =>
        HybridResult.syncErr<U, E>(HybridResult.mapError<E>(error)),
      );

    return HybridResult.fromAsync(asyncState as Promise<SyncResult<U, E>>);
  }

  mapErr<E2>(fn: (error: E) => Promise<E2>): HybridResult<T, E2>;
  mapErr<E2>(fn: (error: E) => E2): HybridResult<T, E2>;
  mapErr<E2>(fn: (error: E) => MaybeAsync<E2>): HybridResult<T, E2> {
    const mapError = (
      state: SyncResult<T, E>,
    ): SyncResult<T, E2> | Promise<SyncResult<T, E2>> => {
      if (state.ok) {
        return HybridResult.syncOk<T, E2>(state.value);
      }

      const mapped = HybridResult.invokeSafely<E, E2, E2>(
        fn,
        HybridResult.getError(state),
      );
      const toErrState = (result: SyncResult<E2, E2>): SyncResult<T, E2> =>
        HybridResult.syncErr<T, E2>(
          result.ok ? result.value : HybridResult.getError(result),
        );

      if (isPromiseLike(mapped)) {
        return (mapped as Promise<SyncResult<E2, E2>>).then(toErrState);
      }

      return toErrState(mapped as SyncResult<E2, E2>);
    };

    if (!this.isAsyncState()) {
      const next = mapError(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(next as Promise<SyncResult<T, E2>>);
      }
      return HybridResult.fromSync(next as SyncResult<T, E2>);
    }

    const asyncState = this.toStatePromise()
      .then(mapError)
      .catch((error) =>
        HybridResult.syncErr<T, E2>(HybridResult.mapError<E2>(error)),
      );

    return HybridResult.fromAsync(asyncState as Promise<SyncResult<T, E2>>);
  }

  mapBoth<T2, E2>(
    fnOk: (value: T) => Promise<T2>,
    fnErr: (error: E) => Promise<E2>,
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
    fnOk: (value: T) => T2,
    fnErr: (error: E) => E2,
  ): HybridResult<T2, E2>;
  mapBoth<T2, E2>(
    fnOk: (value: T) => MaybeAsync<T2>,
    fnErr: (error: E) => MaybeAsync<E2>,
  ): HybridResult<T2, E2> {
    const onOk = (value: T): SyncResult<T2, E2> | Promise<SyncResult<T2, E2>> =>
      HybridResult.invokeSafely<T, T2, E2>(fnOk, value);

    const onErr = (
      error: E,
    ): SyncResult<T2, E2> | Promise<SyncResult<T2, E2>> => {
      const mapped = HybridResult.invokeSafely<E, E2, E2>(fnErr, error);
      const toErrState = (result: SyncResult<E2, E2>): SyncResult<T2, E2> =>
        HybridResult.syncErr<T2, E2>(
          result.ok ? result.value : HybridResult.getError(result),
        );

      if (isPromiseLike(mapped)) {
        return (mapped as Promise<SyncResult<E2, E2>>).then(toErrState);
      }

      return toErrState(mapped as SyncResult<E2, E2>);
    };

    const apply = (
      state: SyncResult<T, E>,
    ): SyncResult<T2, E2> | Promise<SyncResult<T2, E2>> =>
      state.ok ? onOk(state.value) : onErr(HybridResult.getError(state));

    if (!this.isAsyncState()) {
      const next = apply(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(next as Promise<SyncResult<T2, E2>>);
      }
      return HybridResult.fromSync(next as SyncResult<T2, E2>);
    }

    const asyncState = this.toStatePromise()
      .then(apply)
      .catch((error) =>
        HybridResult.syncErr<T2, E2>(HybridResult.mapError<E2>(error)),
      );

    return HybridResult.fromAsync(asyncState as Promise<SyncResult<T2, E2>>);
  }

  flatMap<U, E2>(
    fn: (value: T) => Promise<HybridResult<U, E2>>,
  ): HybridResult<U, E | E2>;
  flatMap<U, E2>(
    fn: (value: T) => HybridResult<U, E2>,
  ): HybridResult<U, E | E2>;
  flatMap<U, E2>(
    fn: (value: T) => HybridResult<U, E2> | Promise<HybridResult<U, E2>>,
  ): HybridResult<U, E | E2> {
    const onOk = (
      state: SyncResult<T, E>,
    ): SyncResult<U, E | E2> | Promise<SyncResult<U, E | E2>> => {
      if (!state.ok) {
        return HybridResult.syncErr<U, E | E2>(HybridResult.getError(state));
      }

      const invoked = HybridResult.invokeSafely<T, HybridResult<U, E2>, E | E2>(
        fn,
        state.value,
      );

      const flatten = (
        result: SyncResult<HybridResult<U, E2>, E | E2>,
      ): SyncResult<U, E | E2> | Promise<SyncResult<U, E | E2>> => {
        if (!result.ok) {
          return HybridResult.syncErr<U, E | E2>(HybridResult.getError(result));
        }

        return HybridResult.flattenHybridResult<U, E2, E | E2>(result.value);
      };

      if (isPromiseLike(invoked)) {
        return (
          invoked as Promise<SyncResult<HybridResult<U, E2>, E | E2>>
        ).then(flatten);
      }

      return flatten(invoked as SyncResult<HybridResult<U, E2>, E | E2>);
    };

    if (!this.isAsyncState()) {
      const next = onOk(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(next as Promise<SyncResult<U, E | E2>>);
      }
      return HybridResult.fromSync(next as SyncResult<U, E | E2>);
    }

    const asyncState = this.toStatePromise()
      .then(onOk)
      .catch((error) =>
        HybridResult.syncErr<U, E | E2>(HybridResult.mapError<E | E2>(error)),
      );

    return HybridResult.fromAsync(asyncState as Promise<SyncResult<U, E | E2>>);
  }

  andThen<U, E2>(
    fn: (value: T) => Promise<HybridResult<U, E2>>,
  ): HybridResult<U, E | E2>;
  andThen<U, E2>(
    fn: (value: T) => HybridResult<U, E2>,
  ): HybridResult<U, E | E2>;
  andThen<U, E2>(
    fn: (value: T) => MaybeAsync<HybridResult<U, E2>>,
  ): HybridResult<U, E | E2> {
    return this.flatMap(fn as any);
  }

  zip<U>(fn: (value: T) => Promise<U>): HybridResult<[T, U], E>;
  zip<U>(fn: (value: T) => U): HybridResult<[T, U], E>;
  zip<U>(fn: (value: T) => MaybeAsync<U>): HybridResult<[T, U], E> {
    const onOk = (
      state: SyncResult<T, E>,
    ): SyncResult<[T, U], E> | Promise<SyncResult<[T, U], E>> => {
      if (!state.ok) {
        return HybridResult.syncErr<[T, U], E>(HybridResult.getError(state));
      }

      const original = state.value;
      const mapped = HybridResult.invokeSafely<T, U, E>(fn, original);
      const toTuple = (result: SyncResult<U, E>): SyncResult<[T, U], E> =>
        result.ok
          ? HybridResult.syncOk<[T, U], E>([original, result.value])
          : HybridResult.syncErr<[T, U], E>(HybridResult.getError(result));

      if (isPromiseLike(mapped)) {
        return (mapped as Promise<SyncResult<U, E>>).then(toTuple);
      }

      return toTuple(mapped as SyncResult<U, E>);
    };

    if (!this.isAsyncState()) {
      const next = onOk(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(next as Promise<SyncResult<[T, U], E>>);
      }
      return HybridResult.fromSync(next as SyncResult<[T, U], E>);
    }

    const asyncState = this.toStatePromise()
      .then((state) => onOk(state))
      .catch((error) =>
        HybridResult.syncErr<[T, U], E>(HybridResult.mapError<E>(error)),
      );

    return HybridResult.fromAsync(asyncState as Promise<SyncResult<[T, U], E>>);
  }

  flatZip<U, E2>(
    fn: (value: T) => Promise<HybridResult<U, E2>>,
  ): HybridResult<[T, U], E | E2>;
  flatZip<U, E2>(
    fn: (value: T) => HybridResult<U, E2>,
  ): HybridResult<[T, U], E | E2>;
  flatZip<U, E2>(
    fn: (value: T) => MaybeAsync<HybridResult<U, E2>>,
  ): HybridResult<[T, U], E | E2> {
    const onOk = (
      state: SyncResult<T, E>,
    ): SyncResult<[T, U], E | E2> | Promise<SyncResult<[T, U], E | E2>> => {
      if (!state.ok) {
        return HybridResult.syncErr<[T, U], E | E2>(
          HybridResult.getError(state),
        );
      }

      const original = state.value;
      const invoked = HybridResult.invokeSafely<T, HybridResult<U, E2>, E | E2>(
        fn,
        original,
      );

      const flatten = (
        result: SyncResult<HybridResult<U, E2>, E | E2>,
      ): SyncResult<[T, U], E | E2> | Promise<SyncResult<[T, U], E | E2>> => {
        if (!result.ok) {
          return HybridResult.syncErr<[T, U], E | E2>(
            HybridResult.getError(result),
          );
        }

        const flattened = HybridResult.flattenHybridResult<U, E2, E | E2>(
          result.value,
        );

        const toTuple = (
          inner: SyncResult<U, E | E2>,
        ): SyncResult<[T, U], E | E2> =>
          inner.ok
            ? HybridResult.syncOk<[T, U], E | E2>([original, inner.value])
            : HybridResult.syncErr<[T, U], E | E2>(
                HybridResult.getError(inner),
              );

        if (isPromiseLike(flattened)) {
          return (flattened as Promise<SyncResult<U, E | E2>>).then(toTuple);
        }

        return toTuple(flattened as SyncResult<U, E | E2>);
      };

      if (isPromiseLike(invoked)) {
        return (
          invoked as Promise<SyncResult<HybridResult<U, E2>, E | E2>>
        ).then(flatten);
      }

      return flatten(invoked as SyncResult<HybridResult<U, E2>, E | E2>);
    };

    if (!this.isAsyncState()) {
      const next = onOk(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(
          next as Promise<SyncResult<[T, U], E | E2>>,
        );
      }
      return HybridResult.fromSync(next as SyncResult<[T, U], E | E2>);
    }

    const asyncState = this.toStatePromise()
      .then((state) => onOk(state))
      .catch((error) =>
        HybridResult.syncErr<[T, U], E | E2>(
          HybridResult.mapError<E | E2>(error),
        ),
      );

    return HybridResult.fromAsync(
      asyncState as Promise<SyncResult<[T, U], E | E2>>,
    );
  }

  zipErr<E2>(
    fn: (value: T) => Promise<HybridResult<unknown, E2>>,
  ): HybridResult<T, E | E2>;
  zipErr<E2>(
    fn: (value: T) => HybridResult<unknown, E2>,
  ): HybridResult<T, E | E2>;
  zipErr<E2>(
    fn: (value: T) => MaybeAsync<HybridResult<unknown, E2>>,
  ): HybridResult<T, E | E2> {
    const onOk = (
      state: SyncResult<T, E>,
    ): SyncResult<T, E | E2> | Promise<SyncResult<T, E | E2>> => {
      if (!state.ok) {
        return HybridResult.syncErr<T, E | E2>(HybridResult.getError(state));
      }

      const original = state.value;
      const invoked = HybridResult.invokeSafely<
        T,
        HybridResult<unknown, E2>,
        E | E2
      >(fn, original);

      const flatten = (
        result: SyncResult<HybridResult<unknown, E2>, E | E2>,
      ): SyncResult<T, E | E2> | Promise<SyncResult<T, E | E2>> => {
        if (!result.ok) {
          return HybridResult.syncErr<T, E | E2>(HybridResult.getError(result));
        }

        const flattened = HybridResult.flattenHybridResult<unknown, E2, E | E2>(
          result.value,
        );

        const merge = (
          inner: SyncResult<unknown, E | E2>,
        ): SyncResult<T, E | E2> =>
          inner.ok
            ? HybridResult.syncOk<T, E | E2>(original)
            : HybridResult.syncErr<T, E | E2>(HybridResult.getError(inner));

        if (isPromiseLike(flattened)) {
          return (flattened as Promise<SyncResult<unknown, E | E2>>).then(
            merge,
          );
        }

        return merge(flattened as SyncResult<unknown, E | E2>);
      };

      if (isPromiseLike(invoked)) {
        return (
          invoked as Promise<SyncResult<HybridResult<unknown, E2>, E | E2>>
        ).then(flatten);
      }

      return flatten(invoked as SyncResult<HybridResult<unknown, E2>, E | E2>);
    };

    if (!this.isAsyncState()) {
      const next = onOk(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(next as Promise<SyncResult<T, E | E2>>);
      }
      return HybridResult.fromSync(next as SyncResult<T, E | E2>);
    }

    const asyncState = this.toStatePromise()
      .then((state) => onOk(state))
      .catch((error) =>
        HybridResult.syncErr<T, E | E2>(HybridResult.mapError<E | E2>(error)),
      );

    return HybridResult.fromAsync(asyncState as Promise<SyncResult<T, E | E2>>);
  }

  validate<VE extends unknown[]>(
    validators: {
      [K in keyof VE]: (value: T) => MaybeAsync<HybridResult<unknown, VE[K]>>;
    },
  ): HybridResult<T, E | VE[number][]> {
    const runValidators = (
      value: T,
    ):
      | SyncResult<T, E | VE[number][]>
      | Promise<SyncResult<T, E | VE[number][]>> => {
      if (validators.length === 0) {
        return HybridResult.syncOk<T, E | VE[number][]>(value);
      }

      const evaluations: (VE[number] | null | Promise<VE[number] | null>)[] =
        [];
      let hasAsync = false;

      const processResult = (
        result: SyncResult<HybridResult<unknown, VE[number]>, VE[number]>,
      ): VE[number] | null | Promise<VE[number] | null> => {
        if (!result.ok) {
          return HybridResult.getError(result);
        }

        const flattened = HybridResult.flattenHybridResult<
          unknown,
          VE[number],
          VE[number]
        >(result.value);

        if (isPromiseLike(flattened)) {
          hasAsync = true;
          return (flattened as Promise<SyncResult<unknown, VE[number]>>)
            .then((inner) => (inner.ok ? null : HybridResult.getError(inner)))
            .catch((error) => HybridResult.mapError<VE[number]>(error));
        }

        const inner = flattened as SyncResult<unknown, VE[number]>;
        return inner.ok ? null : HybridResult.getError(inner);
      };

      for (const validator of validators) {
        const invoked = HybridResult.invokeSafely<
          T,
          HybridResult<unknown, VE[number]>,
          VE[number]
        >(validator, value);

        if (isPromiseLike(invoked)) {
          hasAsync = true;
          evaluations.push(
            (
              invoked as Promise<
                SyncResult<HybridResult<unknown, VE[number]>, VE[number]>
              >
            )
              .then((result) => processResult(result))
              .catch((error) => HybridResult.mapError<VE[number]>(error)),
          );
        } else {
          const processed = processResult(
            invoked as SyncResult<
              HybridResult<unknown, VE[number]>,
              VE[number]
            >,
          );
          if (isPromiseLike(processed)) {
            hasAsync = true;
          }
          evaluations.push(processed);
        }
      }

      const finalize = (
        results: (VE[number] | null)[],
      ): SyncResult<T, E | VE[number][]> => {
        const errors = results.filter(
          (error): error is VE[number] => error !== null,
        );

        if (errors.length > 0) {
          return HybridResult.syncErr<T, E | VE[number][]>(errors);
        }

        return HybridResult.syncOk<T, E | VE[number][]>(value);
      };

      if (!hasAsync) {
        return finalize(evaluations as (VE[number] | null)[]);
      }

      const asyncState = Promise.all(
        evaluations.map((entry) =>
          isPromiseLike(entry) ? entry : Promise.resolve(entry),
        ),
      )
        .then((resolved) => finalize(resolved))
        .catch((error) =>
          HybridResult.syncErr<T, E | VE[number][]>([
            HybridResult.mapError<VE[number]>(error),
          ]),
        );

      return asyncState;
    };

    const apply = (
      state: SyncResult<T, E>,
    ):
      | SyncResult<T, E | VE[number][]>
      | Promise<SyncResult<T, E | VE[number][]>> => {
      if (!state.ok) {
        return HybridResult.syncErr<T, E | VE[number][]>(
          HybridResult.getError(state),
        );
      }

      return runValidators(state.value);
    };

    if (!this.isAsyncState()) {
      const next = apply(
        (this.state as { kind: "sync"; value: SyncResult<T, E> }).value,
      );
      if (isPromiseLike(next)) {
        return HybridResult.fromAsync(
          next as Promise<SyncResult<T, E | VE[number][]>>,
        );
      }
      return HybridResult.fromSync(next as SyncResult<T, E | VE[number][]>);
    }

    const asyncState = this.toStatePromise()
      .then((state) => apply(state))
      .catch((error) =>
        HybridResult.syncErr<T, E | VE[number][]>([
          HybridResult.mapError<VE[number]>(error),
        ]),
      );

    return HybridResult.fromAsync(
      asyncState as Promise<SyncResult<T, E | VE[number][]>>,
    );
  }

  static all<T extends HybridResult<unknown, unknown>[]>(
    ...results: T
  ): HybridResult<CombinedResultOk<T>, CombinedResultErr<T>[]> {
    type Err = CombinedResultErr<T>;

    const values: unknown[] = new Array(results.length);
    const errors: Err[] = [];
    const asyncOperations: Promise<void>[] = [];

    results.forEach((result, index) => {
      const state = result.state;

      if (state.kind === "sync") {
        const syncState = state.value;
        if (syncState.ok) {
          values[index] = syncState.value;
        } else {
          errors.push(HybridResult.getError(syncState) as Err);
        }
        return;
      }

      const operation = state.promise
        .then((resolved) => {
          if (resolved.ok) {
            values[index] = resolved.value;
          } else {
            errors.push(HybridResult.getError(resolved) as Err);
          }
        })
        .catch((error) => {
          errors.push(HybridResult.mapError<Err>(error));
        });

      asyncOperations.push(operation);
    });

    if (asyncOperations.length === 0) {
      if (errors.length > 0) {
        return HybridResult.fromSync(
          HybridResult.syncErr<CombinedResultOk<T>, Err[]>(errors),
        );
      }

      return HybridResult.fromSync(
        HybridResult.syncOk<CombinedResultOk<T>, Err[]>(
          values as CombinedResultOk<T>,
        ),
      );
    }

    const asyncState = Promise.all(asyncOperations)
      .then(() => {
        if (errors.length > 0) {
          return HybridResult.syncErr<CombinedResultOk<T>, Err[]>([...errors]);
        }

        return HybridResult.syncOk<CombinedResultOk<T>, Err[]>(
          values as CombinedResultOk<T>,
        );
      })
      .catch((error) =>
        HybridResult.syncErr<CombinedResultOk<T>, Err[]>([
          HybridResult.mapError<Err>(error),
        ]),
      );

    return HybridResult.fromAsync(
      asyncState as Promise<SyncResult<CombinedResultOk<T>, Err[]>>,
    );
  }

  orElse(defaultValue: T): T;
  orElse(defaultValue: Promise<T>): Promise<T>;
  orElse(defaultFactory: (error: E) => T): T;
  orElse(defaultFactory: (error: E) => Promise<T>): Promise<T>;
  orElse(
    fallback: MaybeAsync<T> | ((error: E) => MaybeAsync<T>),
  ): T | Promise<T> {
    const evaluateFallback = (error: E): MaybeAsync<T> => {
      if (typeof fallback === "function") {
        const fn = fallback as (error: E) => MaybeAsync<T>;
        try {
          const value = fn(error);
          if (isPromiseLike(value)) {
            return (value as Promise<T>).catch((error) => {
              throw HybridResult.mapError<unknown>(error);
            });
          }
          return value;
        } catch (error) {
          throw HybridResult.mapError<unknown>(error);
        }
      }

      if (isPromiseLike(fallback)) {
        return (fallback as Promise<T>).catch((error) => {
          throw HybridResult.mapError<unknown>(error);
        });
      }
      return fallback as T;
    };

    if (!this.isAsyncState()) {
      const state = (this.state as { kind: "sync"; value: SyncResult<T, E> })
        .value;
      if (state.ok) {
        return state.value;
      }
      const fallbackValue = evaluateFallback(HybridResult.getError(state));
      return isPromiseLike(fallbackValue)
        ? (fallbackValue as Promise<T>)
        : (fallbackValue as T);
    }

    return this.toStatePromise()
      .then((state) => {
        if (state.ok) {
          return state.value;
        }
        return evaluateFallback(HybridResult.getError(state));
      })
      .catch((error) => {
        throw HybridResult.mapError<unknown>(error);
      });
  }
}

export const Result = HybridResult;
