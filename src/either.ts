import { isPromise } from "node:util/types";

// Error classes
export class UnwrappedLeftWithRight extends Error {
  constructor(e: Either<unknown, unknown>) {
    super(`Attempted to call unwrap on a Left value: <${e}>`);
  }
}

export class UnwrappedRightWithLeft extends Error {
  constructor(e: Either<unknown, unknown>) {
    super(`Attempted to call unwrapLeft on a Right value: <${e}>`);
  }
}

// Type aliases
type Mapper<T, U> = (val: T) => U;
type AsyncMapper<T, U> = (val: T) => Promise<U>;
type FlatMapper<T, U, L> = (val: T) => Either<L, U>;
type AsyncFlatMapper<T, U, L> = (val: T) => Promise<Either<L, U>>;
type MaybePromise<T> = T | Promise<T>;

// Core type definitions based on design document
type EitherState<L, R> =
  | { kind: "left"; value: L }
  | { kind: "right"; value: R }
  | { kind: "async-left"; promise: Promise<L> }
  | { kind: "async-right"; promise: Promise<R> };

type PendingOperation<L, R, L2 = L, R2 = R> = {
  track: "left" | "right";
  operation: (
    value: L | R,
  ) => EitherState<L2, R2> | Promise<EitherState<L2, R2>>;
};

// Hybrid Controller for managing state and pending operations
class HybridController<L, R> {
  private _state: EitherState<L, R>;
  private _pendingLeft: PendingOperation<L, R, any, any>[] = [];
  private _pendingRight: PendingOperation<L, R, any, any>[] = [];

  constructor(initialState: EitherState<L, R>) {
    this._state = initialState;
  }

  get state(): EitherState<L, R> {
    return this._state;
  }

  get pendingLeft(): PendingOperation<L, R, any, any>[] {
    return this._pendingLeft;
  }

  get pendingRight(): PendingOperation<L, R, any, any>[] {
    return this._pendingRight;
  }

  setState(newState: EitherState<L, R>): void {
    this._state = newState;
  }

  enqueueLeft<L2, R2>(
    operation: (value: L) => EitherState<L2, R2> | Promise<EitherState<L2, R2>>,
  ): void {
    this._pendingLeft.push({
      track: "left",
      operation: operation as (
        value: L | R,
      ) => EitherState<L2, R2> | Promise<EitherState<L2, R2>>,
    });
  }

  enqueueRight<L2, R2>(
    operation: (value: R) => EitherState<L2, R2> | Promise<EitherState<L2, R2>>,
  ): void {
    this._pendingRight.push({
      track: "right",
      operation: operation as (
        value: L | R,
      ) => EitherState<L2, R2> | Promise<EitherState<L2, R2>>,
    });
  }

  async flushLeft(): Promise<void> {
    if (this._pendingLeft.length === 0) return;

    const operations = [...this._pendingLeft];
    this._pendingLeft = [];

    for (const op of operations) {
      if (this._state.kind === "left" || this._state.kind === "async-left") {
        try {
          const value =
            this._state.kind === "left"
              ? this._state.value
              : await this._state.promise;
          const newState = await op.operation(value);
          this._state = newState as EitherState<L, R>;
        } catch (_error) {
          // If operation fails, we stay on current track
          // Could potentially switch to Left track with error value
        }
      }
    }
  }

  async flushRight(): Promise<void> {
    if (this._pendingRight.length === 0) return;

    const operations = [...this._pendingRight];
    this._pendingRight = [];

    for (const op of operations) {
      if (this._state.kind === "right" || this._state.kind === "async-right") {
        try {
          const value =
            this._state.kind === "right"
              ? this._state.value
              : await this._state.promise;
          const newState = await op.operation(value);
          this._state = newState as EitherState<L, R>;
        } catch (_error) {
          // If operation fails, we stay on current track
          // Could potentially switch to Left track with error value
        }
      }
    }
  }
}

type EitherInternal<L, R> = HybridController<L, R>;

// Helper predicates for state detection
function _isLeftState<L, R>(
  state: EitherState<L, R>,
): state is EitherState<L, R> & { kind: "left" | "async-left" } {
  return state.kind === "left" || state.kind === "async-left";
}

function _isRightState<L, R>(
  state: EitherState<L, R>,
): state is EitherState<L, R> & { kind: "right" | "async-right" } {
  return state.kind === "right" || state.kind === "async-right";
}

function _isAsyncState<L, R>(
  state: EitherState<L, R>,
): state is EitherState<L, R> & { kind: "async-left" | "async-right" } {
  return state.kind === "async-left" || state.kind === "async-right";
}

async function _resolveAsyncValue<L, R>(
  state: EitherState<L, R>,
): Promise<L | R> {
  if (state.kind === "async-left") {
    return await state.promise;
  }
  if (state.kind === "async-right") {
    return await state.promise;
  }
  throw new Error("State is not async");
}

// Centralized state resolution
async function _resolveState<L, R>(
  state: EitherState<L, R>,
): Promise<EitherState<L, R>> {
  if (state.kind === "async-left") {
    try {
      const resolved = await state.promise;
      return { kind: "left", value: resolved };
    } catch (error) {
      // Keep the error on the left track
      return { kind: "left", value: error as L };
    }
  }
  if (state.kind === "async-right") {
    try {
      const resolved = await state.promise;
      return { kind: "right", value: resolved };
    } catch (error) {
      // Convert async errors to left track
      return { kind: "left", value: error as L };
    }
  }
  return state; // Already sync
}

// Track switching utilities
async function _switchToLeft<L, R>(
  controller: HybridController<L, R>,
  newValue: L | Promise<L>,
): Promise<void> {
  const newState = isPromise(newValue)
    ? { kind: "async-left" as const, promise: newValue }
    : { kind: "left" as const, value: newValue };

  controller.setState(newState as EitherState<L, R>);
  await controller.flushRight(); // Flush right operations when switching to left
}

async function _switchToRight<L, R>(
  controller: HybridController<L, R>,
  newValue: R | Promise<R>,
): Promise<void> {
  const newState = isPromise(newValue)
    ? { kind: "async-right" as const, promise: newValue }
    : { kind: "right" as const, value: newValue };

  controller.setState(newState as EitherState<L, R>);
  await controller.flushLeft(); // Flush left operations when switching to right
}

// Helper to extract value types from EitherState
type LeftValue<T> = T extends EitherState<infer L, any> ? L : never;
type RightValue<T> = T extends EitherState<any, infer R> ? R : never;

// Export types
export type LeftOf<T extends Either<unknown, unknown>> = T extends Either<
  infer L,
  unknown
>
  ? L
  : never;

export type RightOf<T extends Either<unknown, unknown>> = T extends Either<
  unknown,
  infer R
>
  ? R
  : never;

export type UnwrapEither<T extends Either<unknown, unknown>> = {
  left: LeftOf<T>;
  right: RightOf<T>;
};

export class Either<L, R> {
  private readonly internal: EitherInternal<L, R>;

  private constructor(internal: EitherInternal<L, R>) {
    this.internal = internal;
  }

  // Static Constructors
  static Left<L, R = never>(value: L): Either<L, R>;
  static Left<L, R = never>(value: Promise<L>): Either<L, R>;
  static Left<L, R = never>(value: L | Promise<L>): Either<L, R> {
    const initialState = isPromise(value)
      ? { kind: "async-left" as const, promise: value }
      : { kind: "left" as const, value };
    return new Either<L, R>(
      new HybridController<L, R>(initialState as EitherState<L, R>),
    );
  }

  static Right<R, L = never>(value: R): Either<L, R>;
  static Right<R, L = never>(value: Promise<R>): Either<L, R>;
  static Right<R, L = never>(value: R | Promise<R>): Either<L, R> {
    const initialState = isPromise(value)
      ? { kind: "async-right" as const, promise: value }
      : { kind: "right" as const, value };
    return new Either<L, R>(
      new HybridController<L, R>(initialState as EitherState<L, R>),
    );
  }

  static fromPredicate<T, L>(
    value: T,
    predicate: (t: T) => boolean,
    leftValue: L,
  ): Either<L, T> {
    return predicate(value) ? Either.Right(value) : Either.Left(leftValue);
  }

  static tryCatch<T, L>(
    fn: () => T | Promise<T>,
    onError: (error: unknown) => L,
  ): Either<L, T> {
    try {
      const result = fn();
      if (isPromise(result)) {
        // For async functions, create an async-right state
        const initialState: EitherState<L, T> = {
          kind: "async-right",
          promise: result,
        };
        return new Either<L, T>(new HybridController<L, T>(initialState));
      }
      return Either.Right(result);
    } catch (error) {
      return Either.Left(onError(error));
    }
  }

  static fromPromise<T, L>(
    promise: Promise<T>,
    onError: (error: unknown) => L,
  ): Promise<Either<L, T>> {
    return promise
      .then((value) => Either.Right(value) as Either<L, T>)
      .catch((error) => Either.Left(onError(error)) as Either<L, T>);
  }

  // Introspection methods
  isLeft(): this is Either<L, never> {
    return (
      this.internal.state.kind === "left" ||
      this.internal.state.kind === "async-left"
    );
  }

  isRight(): this is Either<never, R> {
    return (
      this.internal.state.kind === "right" ||
      this.internal.state.kind === "async-right"
    );
  }

  isSyncLeft(): this is Either<L, never> {
    return this.internal.state.kind === "left";
  }

  isSyncRight(): this is Either<never, R> {
    return this.internal.state.kind === "right";
  }

  isAsyncLeft(): this is Either<L, never> {
    return this.internal.state.kind === "async-left";
  }

  isAsyncRight(): this is Either<never, R> {
    return this.internal.state.kind === "async-right";
  }

  async isLeftResolved(): Promise<boolean> {
    if (this.internal.state.kind === "left") return true;
    if (this.internal.state.kind === "async-left") {
      try {
        await this.internal.state.promise;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async isRightResolved(): Promise<boolean> {
    if (this.internal.state.kind === "right") return true;
    if (this.internal.state.kind === "async-right") {
      try {
        await this.internal.state.promise;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Safe unwrapping methods
  safeUnwrap(): R | null {
    if (this.internal.state.kind === "right") {
      return this.internal.state.value;
    }
    return null;
  }

  safeUnwrapLeft(): L | null {
    if (this.internal.state.kind === "left") {
      return this.internal.state.value;
    }
    return null;
  }

  toTuple(): [L, null] | [null, R] {
    if (this.internal.state.kind === "left") {
      return [this.internal.state.value, null];
    }
    if (this.internal.state.kind === "right") {
      return [null, this.internal.state.value];
    }
    // For async values, we can't return them synchronously
    if (this.internal.state.kind === "async-left") {
      throw new Error(
        "Cannot convert async Left value to tuple synchronously. Use toTupleResolved() instead.",
      );
    }
    if (this.internal.state.kind === "async-right") {
      throw new Error(
        "Cannot convert async Right value to tuple synchronously. Use toTupleResolved() instead.",
      );
    }
    // This should never happen with proper typing
    throw new Error("Invalid Either state");
  }

  async toTupleResolved(): Promise<[L, null] | [null, R]> {
    switch (this.internal.state.kind) {
      case "left":
        return [this.internal.state.value, null];
      case "right":
        return [null, this.internal.state.value];
      case "async-left": {
        const resolved = await this.internal.state.promise;
        return [resolved, null];
      }
      case "async-right": {
        const resolved = await this.internal.state.promise;
        return [null, resolved];
      }
      default:
        throw new Error("Invalid Either state");
    }
  }

  // Unwrapping methods
  unwrap(): R | Promise<R> {
    switch (this.internal.state.kind) {
      case "right":
        return this.internal.state.value;
      case "async-right":
        return this.internal.state.promise;
      case "left":
      case "async-left":
        throw new UnwrappedLeftWithRight(this as Either<unknown, unknown>);
      default:
        throw new Error("Invalid Either state");
    }
  }

  unwrapLeft(): L | Promise<L> {
    switch (this.internal.state.kind) {
      case "left":
        return this.internal.state.value;
      case "async-left":
        return this.internal.state.promise;
      case "right":
      case "async-right":
        throw new UnwrappedRightWithLeft(this as Either<unknown, unknown>);
      default:
        throw new Error("Invalid Either state");
    }
  }

  // Right track operations
  map<U>(fn: (value: R) => U): Either<L, U> {
    return this.mapRight(fn);
  }

  mapRight<U>(fn: (value: R) => U): Either<L, U>;
  mapRight<U>(fn: (value: R) => Promise<U>): Either<L, Promise<U>>;
  mapRight<U>(
    fn: (value: R) => U | Promise<U>,
  ): Either<L, U> | Either<L, Promise<U>> {
    // If we're on the Left track, Left operations are skipped, return unchanged
    if (
      this.internal.state.kind === "left" ||
      this.internal.state.kind === "async-left"
    ) {
      // For Left track, mapRight doesn't affect the Left value, just return this with new type annotation
      return this as unknown as Either<L, U> | Either<L, Promise<U>>;
    }

    // We're on the Right track
    if (this.internal.state.kind === "right") {
      const currentValue = this.internal.state.value;
      const result = fn(currentValue);

      if (isPromise(result)) {
        return Either.Right(result) as Either<L, Promise<U>>;
      }
      return Either.Right(result) as Either<L, U>;
    }

    // We're on the async Right track
    if (this.internal.state.kind === "async-right") {
      const newPromise = this.internal.state.promise.then((val) => fn(val));
      return Either.Right(newPromise) as Either<L, Promise<U>>;
    }

    // This should never happen with proper typing
    throw new Error("Invalid Either state");
  }

  // Left track operations
  mapLeft<L2>(fn: (value: L) => L2): Either<L2, R>;
  mapLeft<L2>(fn: (value: L) => Promise<L2>): Either<Promise<L2>, R>;
  mapLeft<L2>(
    fn: (value: L) => L2 | Promise<L2>,
  ): Either<L2, R> | Either<Promise<L2>, R> {
    if (this.internal.state.kind === "right") {
      // We're on the Right track, so Left operations are skipped
      // Return this Either with updated type annotation
      return this as unknown as Either<L2, R>;
    }

    if (this.internal.state.kind === "async-left") {
      const newPromise = this.internal.state.promise.then((val) => fn(val));
      return Either.Left(newPromise) as unknown as Either<Promise<L2>, R>;
    }

    // We're on sync Left track
    const currentValue = (this.internal.state as { kind: "left"; value: L })
      .value;
    const result = fn(currentValue);

    if (isPromise(result)) {
      return Either.Left(result) as unknown as Either<Promise<L2>, R>;
    }

    return Either.Left(result) as unknown as Either<L2, R>;
  }

  // Flat mapping operations
  flatMap<U, L2 = never>(fn: (value: R) => Either<L2, U>): Either<L | L2, U> {
    if (this.internal.state.kind === "left") {
      // We're on Left track, so Right operations are skipped
      const leftValue = (this.internal.state as { kind: "left"; value: L })
        .value;
      return Either.Left(leftValue) as Either<L | L2, U>;
    }

    if (this.internal.state.kind === "async-right") {
      const newPromise = this.internal.state.promise.then((val) => {
        const result = fn(val as R);
        return result.internal.state;
      });

      return Either.Right(newPromise) as unknown as Either<L | L2, U>;
    }

    if (this.internal.state.kind === "async-left") {
      // For async-left, the operation is skipped but we preserve the async nature
      return this as unknown as Either<L | L2, U>;
    }

    // We're on sync Right track
    const currentValue = (this.internal.state as { kind: "right"; value: R })
      .value;
    const result = fn(currentValue);
    return result as Either<L | L2, U>;
  }

  // Alias for flatMap - operates on Right track
  flatMapRight<U, L2 = never>(
    fn: (value: R) => Either<L2, U>,
  ): Either<L | L2, U> {
    return this.flatMap(fn);
  }

  flatMapLeft<U, L2 = never>(
    fn: (value: L) => Either<L2, U>,
  ): Either<L2, R | U> {
    if (this.internal.state.kind === "right") {
      // We're on Right track, so Left operations are skipped
      const rightValue = (this.internal.state as { kind: "right"; value: R })
        .value;
      return Either.Right(rightValue) as Either<L2, R | U>;
    }

    if (this.internal.state.kind === "async-left") {
      const newPromise = this.internal.state.promise.then((val) => {
        const result = fn(val as L);
        return result.internal.state;
      });

      return Either.Left(newPromise) as unknown as Either<L2, R | U>;
    }

    if (this.internal.state.kind === "async-right") {
      // For async-right, the operation is skipped but we preserve the async nature
      return this as unknown as Either<L2, R | U>;
    }

    // We're on sync Left track
    const currentValue = (this.internal.state as { kind: "left"; value: L })
      .value;
    const result = fn(currentValue);
    return result as Either<L2, R | U>;
  }

  // Zipping operations
  zip<U>(fn: (value: R) => U): Either<L, [R, U]> {
    return this.mapRight((value: R) => {
      const mapped = fn(value);
      return [value, mapped] as [R, U];
    });
  }

  zipLeft<U>(fn: (value: L) => U): Either<[L, U], R> {
    return this.mapLeft((value: L) => {
      const mapped = fn(value);
      return [value, mapped] as [L, U];
    });
  }

  zipRight<U>(fn: (value: R) => U): Either<L, [R, U]> {
    return this.zip(fn);
  }

  flatZip<U, L2 = never>(
    fn: (value: R) => Either<L2, U>,
  ): Either<L | L2, [R, U]> {
    return this.flatMap((value: R) => {
      const either = fn(value);
      return either.map((inner: U) => [value, inner] as [R, U]);
    });
  }

  flatZipLeft<U, L2 = never>(
    fn: (value: L) => Either<L2, U>,
  ): Either<L2, R | U> {
    // Note: This method's signature in the design document may be incorrect.
    // flatZipLeft cannot produce [U, R] tuples when starting from a pure Left state
    // since the original Right value is not available.
    // This implementation returns Either<L2, R | U> instead.
    if (this.internal.state.kind === "right") {
      // If on Right track, we need to preserve the Right value
      const rightValue = (this.internal.state as { kind: "right"; value: R })
        .value;
      return Either.Right(rightValue) as Either<L2, R | U>;
    }

    if (this.internal.state.kind === "async-right") {
      // For async-right, preserve the async nature and type
      return this as unknown as Either<L2, R | U>;
    }

    return this.flatMapLeft((value: L) => {
      const either = fn(value);
      return either as Either<L2, R | U>;
    });
  }

  // Unified operations
  mapBoth<L2, R2>({
    left,
    right,
  }: {
    left: (value: L) => L2;
    right: (value: R) => R2;
  }): Either<L2, R2> {
    if (
      this.internal.state.kind === "left" ||
      this.internal.state.kind === "async-left"
    ) {
      const leftResult = this.mapLeft(left);
      // mapLeft returns Either<L2, R>, but we need Either<L2, R2>
      // Since we're on the Left track, the R type doesn't matter
      // We need to extract the Left value and create a new Either with correct types
      if (leftResult.internal.state.kind === "left") {
        const leftValue = (
          leftResult.internal.state as { kind: "left"; value: L2 }
        ).value;
        return Either.Left(leftValue) as Either<L2, R2>;
      } else if (leftResult.internal.state.kind === "async-left") {
        const leftPromise = (
          leftResult.internal.state as {
            kind: "async-left";
            promise: Promise<L2>;
          }
        ).promise;
        return Either.Left(leftPromise) as Either<L2, R2>;
      }
      // Fallback - this shouldn't happen with proper mapLeft
      return leftResult as Either<L2, R2>;
    }

    // We're on the Right track
    const rightResult = this.mapRight(right);
    // mapRight returns Either<L, R2>, but we need Either<L2, R2>
    // Since we're on the Right track, the L type doesn't matter
    // We need to extract the Right value and create a new Either with correct types
    if (rightResult.internal.state.kind === "right") {
      const rightValue = (
        rightResult.internal.state as { kind: "right"; value: R2 }
      ).value;
      return Either.Right(rightValue) as Either<L2, R2>;
    } else if (rightResult.internal.state.kind === "async-right") {
      const rightPromise = (
        rightResult.internal.state as {
          kind: "async-right";
          promise: Promise<R2>;
        }
      ).promise;
      return Either.Right(rightPromise) as Either<L2, R2>;
    }
    // Fallback - this shouldn't happen with proper mapRight
    return rightResult as Either<L2, R2>;
  }

  match<T>({
    left,
    right,
  }: {
    left: (value: L) => T;
    right: (value: R) => T;
  }): T | Promise<T> {
    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;
      return left(value);
    }

    if (this.internal.state.kind === "async-left") {
      return this.internal.state.promise.then((resolved) => left(resolved));
    }

    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;
      return right(value);
    }

    if (this.internal.state.kind === "async-right") {
      return this.internal.state.promise.then((resolved) => right(resolved));
    }

    throw new Error("Invalid Either state");
  }

  async matchAsync<T>({
    left,
    right,
  }: {
    left: (value: L) => T;
    right: (value: R) => T;
  }): Promise<T> {
    return this.match({ left, right }) as Promise<T>;
  }

  // Track manipulation
  swap(): Either<R, L> {
    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;
      return Either.Right(value);
    }

    if (this.internal.state.kind === "async-left") {
      return Either.Right(this.internal.state.promise) as Either<R, L>;
    }

    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;
      return Either.Left(value);
    }

    if (this.internal.state.kind === "async-right") {
      return Either.Left(this.internal.state.promise) as Either<R, L>;
    }

    throw new Error("Invalid Either state");
  }

  toLeft(leftValue: L): Either<L, R> {
    return Either.Left(leftValue);
  }

  toRight(rightValue: R): Either<L, R> {
    return Either.Right(rightValue);
  }

  ifLeft(fn: (value: L) => Either<L, R> | undefined): Either<L, R> {
    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;
      const result = fn(value);
      // If the function returns an Either, use that; otherwise return this for chaining
      return result && typeof result === "object" && "internal" in result
        ? result
        : this;
    }

    if (this.internal.state.kind === "async-left") {
      // For async values, this is more complex and would need Promise support
      // For now, return this as a limitation
      return this;
    }

    return this;
  }

  ifRight(fn: (value: R) => Either<L, R> | undefined): Either<L, R> {
    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;
      const result = fn(value);
      // If the function returns an Either, use that; otherwise return this for chaining
      return result && typeof result === "object" && "internal" in result
        ? result
        : this;
    }

    if (this.internal.state.kind === "async-right") {
      // For async values, this is more complex and would need Promise support
      // For now, return this as a limitation
      return this;
    }

    return this;
  }

  // Static advanced methods
  static all<L, R>(...eithers: Either<L, R>[]): Either<L[], R[]> {
    const lefts: L[] = [];
    const rights: R[] = [];

    for (const either of eithers) {
      if (either.internal.state.kind === "left") {
        const value = (either.internal.state as { kind: "left"; value: L })
          .value;
        lefts.push(value);
      } else if (either.internal.state.kind === "right") {
        const value = (either.internal.state as { kind: "right"; value: R })
          .value;
        rights.push(value);
      }
      // Skip async states for this synchronous method
    }

    return lefts.length > 0 ? Either.Left(lefts) : Either.Right(rights);
  }

  static allParallel<L, R>(eithers: Either<L, R>[]): Promise<Either<L[], R[]>> {
    const promises = eithers.map(async (either) => {
      if (either.internal.state.kind === "left") {
        const value = (either.internal.state as { kind: "left"; value: L })
          .value;
        return { kind: "left" as const, value };
      } else if (either.internal.state.kind === "async-left") {
        const resolved = await either.internal.state.promise;
        return { kind: "left" as const, value: resolved };
      } else if (either.internal.state.kind === "right") {
        const value = (either.internal.state as { kind: "right"; value: R })
          .value;
        return { kind: "right" as const, value };
      } else if (either.internal.state.kind === "async-right") {
        const resolved = await either.internal.state.promise;
        return { kind: "right" as const, value: resolved };
      } else {
        throw new Error("Invalid Either state");
      }
    });

    return Promise.all(promises).then((results) => {
      const lefts = results
        .filter((r) => r.kind === "left")
        .map((r) => r.value);
      const rights = results
        .filter((r) => r.kind === "right")
        .map((r) => r.value);

      return lefts.length > 0 ? Either.Left(lefts) : Either.Right(rights);
    });
  }

  // Validation methods
  validateRight<L2 = never>(
    validators: Array<(value: R) => Either<L2, R>>,
  ): Either<L | L2, R> {
    if (this.internal.state.kind === "left") {
      return this as Either<L | L2, R>;
    }

    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;

      for (const validator of validators) {
        try {
          const result = validator(value);
          if (result.internal.state.kind === "left") {
            const leftValue = (
              result.internal.state as { kind: "left"; value: any }
            ).value;
            return Either.Left<L | L2, R>(leftValue);
          }
        } catch (error) {
          return Either.Left<L | L2, R>(error as L2);
        }
      }
    }

    // Handle async-right case
    if (this.internal.state.kind === "async-right") {
      // For async values, we should return a Promise<Either> but the type system doesn't support this well
      // This is a limitation - in practice you'd handle this differently
      return this as Either<L | L2, R>;
    }

    return this as Either<L | L2, R>;
  }

  validateLeft<L2 = never>(
    validators: Array<(value: L) => Either<L2, L>>,
  ): Either<L2 | L, R> {
    if (this.internal.state.kind === "right") {
      return this as Either<L2 | L, R>;
    }

    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;

      for (const validator of validators) {
        try {
          const result = validator(value);
          if (result.internal.state.kind === "left") {
            const leftValue = (
              result.internal.state as { kind: "left"; value: any }
            ).value;
            return Either.Left<L2 | L, R>(leftValue);
          }
        } catch (error) {
          return Either.Left<L2 | L, R>(error as L2);
        }
      }
    }

    // Handle async-left case
    if (this.internal.state.kind === "async-left") {
      // For async values, we should return a Promise<Either> but the type system doesn't support this well
      // This is a limitation - in practice you'd handle this differently
      return this as Either<L2 | L, R>;
    }

    return this as Either<L2 | L, R>;
  }

  // String representation
  toString(): string {
    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;
      return `Either::Left<${String(value)}>`;
    }

    if (this.internal.state.kind === "async-left") {
      return "Either::Left<pending>";
    }

    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;
      return `Either::Right<${String(value)}>`;
    }

    if (this.internal.state.kind === "async-right") {
      return "Either::Right<pending>";
    }

    throw new Error("Invalid Either state");
  }

  // Utility methods
  static lift<A, B, L = never>(fn: (a: A) => B): Either<L, (a: A) => B> {
    return Either.Right(fn);
  }

  // Async conversion
  async toPromise(): Promise<Either<L, R>> {
    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;
      return Either.Left(value);
    }

    if (this.internal.state.kind === "async-left") {
      const resolved = await this.internal.state.promise;
      return Either.Left(resolved);
    }

    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;
      return Either.Right(value);
    }

    if (this.internal.state.kind === "async-right") {
      const resolved = await this.internal.state.promise;
      return Either.Right(resolved);
    }

    throw new Error("Invalid Either state");
  }
}
