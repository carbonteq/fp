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
type MaybePromise<T> = T | Promise<T>;

const isPromiseLike = <T>(value: MaybePromise<T>): value is Promise<T> =>
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
  private constructor(
    private readonly state: SyncResult<T, E> | Promise<SyncResult<T, E>>,
  ) {}

  // Core internal factories

  private static fromSync<T, E>(state: SyncResult<T, E>): HybridResult<T, E> {
    return new HybridResult(state);
  }

  private static fromAsync<T, E>(
    state: Promise<SyncResult<T, E>>,
  ): HybridResult<T, E> {
    return new HybridResult(state);
  }

  private isAsyncState(): boolean {
    return isPromiseLike(this.state);
  }

  toStatePromise(): Promise<SyncResult<T, E>> {
    return isPromiseLike(this.state)
      ? (this.state as Promise<SyncResult<T, E>>)
      : Promise.resolve(this.state as SyncResult<T, E>);
  }

  // Formatting

  private static formatSyncResult<T, E>(result: SyncResult<T, E>): string {
    if (result.ok) {
      return `Result::Ok<${String(result.value)}>`;
    }
    return `Result::Err<${String(result.error)}>`;
  }

  toString(): string {
    if (!this.isAsyncState()) {
      return HybridResult.formatSyncResult(this.state as SyncResult<T, E>);
    }
    return "Result::Promise<...>";
  }

  // Core instance API (Phase 1)

  isOk(): this is HybridResult<T, never> {
    if (this.isAsyncState()) return false;
    const result = this.state as SyncResult<T, E>;
    return result.ok;
  }

  isErr(): this is HybridResult<never, E> {
    if (this.isAsyncState()) return false;
    const result = this.state as SyncResult<T, E>;
    return !result.ok;
  }

  safeUnwrap(): T | null {
    if (!this.isAsyncState()) {
      const result = this.state as SyncResult<T, E>;
      return result.ok ? result.value : null;
    }
    return null;
  }

  unwrap(): T | Promise<T> {
    if (!this.isAsyncState()) {
      const result = this.state as SyncResult<T, E>;
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
      const result = this.state as SyncResult<T, E>;
      if (!result.ok) return result.error;
      throw new UnwrappedErrWithOk(HybridResult.formatSyncResult(result));
    }

    return this.toStatePromise()
      .then((result) => {
        if (!result.ok) {
          return result.error;
        }
        throw new UnwrappedErrWithOk(HybridResult.formatSyncResult(result));
      })
      .catch((err) => {
        throw globalErrorMapper(err);
      });
  }

  flip(): HybridResult<E, T> {
    if (!this.isAsyncState()) {
      const result = this.state as SyncResult<T, E>;
      if (result.ok) {
        return HybridResult.fromSync<E, T>({
          ok: false as const,
          error: result.value as unknown as E,
        });
      }
      return HybridResult.fromSync<E, T>({
        ok: true as const,
        value: result.error as unknown as T,
      });
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
        value: result.error as unknown as T,
      } as unknown as SyncResult<E, T>;
    });

    return HybridResult.fromAsync(flipped as Promise<SyncResult<E, T>>);
  }

  toPromise(): Promise<HybridResult<T, E>> {
    return this.toStatePromise().then((state) =>
      HybridResult.fromSync<T, E>(state),
    );
  }

  // Static constructors

  static Ok<T, E = never>(value: MaybePromise<T>): HybridResult<T, E> {
    if (isPromiseLike(value)) {
      const asyncState = Promise.resolve(value).then<SyncResult<T, E>>((v) => ({
        ok: true as const,
        value: v,
      }));
      return HybridResult.fromAsync(asyncState);
    }

    return HybridResult.fromSync<T, E>({ ok: true as const, value });
  }

  static Err<E, T = never>(error: MaybePromise<E>): HybridResult<T, E> {
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
    fn: () => MaybePromise<T>,
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
}

// Public alias (for tests importing from result.hybrid.js)
export const Result = HybridResult;
