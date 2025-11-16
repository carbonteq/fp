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

type PendingOperation<_L, _R> = {
  track: "left" | "right";
  operation: (
    value: any,
  ) => EitherState<any, any> | Promise<EitherState<any, any>>;
};

type EitherInternal<L, R> = {
  state: EitherState<L, R>;
  pendingLeft: PendingOperation<any, any>[];
  pendingRight: PendingOperation<any, any>[];
};

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

// Option type for integration
export type Option<T> = { kind: "some"; value: T } | { kind: "none" };

export class Either<L, R> {
  private readonly internal: EitherInternal<L, R>;

  private constructor(internal: EitherInternal<L, R>) {
    this.internal = internal;
  }

  // Static Constructors
  static Left<L, R = never>(value: L): Either<L, R>;
  static Left<L, R = never>(value: Promise<L>): Either<L, R>;
  static Left<L, R = never>(value: L | Promise<L>): Either<L, R> {
    if (isPromise(value)) {
      return new Either<L, R>({
        state: { kind: "async-left", promise: value },
        pendingLeft: [],
        pendingRight: [],
      });
    }
    return new Either<L, R>({
      state: { kind: "left", value },
      pendingLeft: [],
      pendingRight: [],
    });
  }

  static Right<R, L = never>(value: R): Either<L, R>;
  static Right<R, L = never>(value: Promise<R>): Either<L, R>;
  static Right<R, L = never>(value: R | Promise<R>): Either<L, R> {
    if (isPromise(value)) {
      return new Either<L, R>({
        state: { kind: "async-right", promise: value },
        pendingLeft: [],
        pendingRight: [],
      });
    }
    return new Either<L, R>({
      state: { kind: "right", value },
      pendingLeft: [],
      pendingRight: [],
    });
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
  ): Either<L, T> | Either<L, Promise<T>> {
    try {
      const result = fn();
      if (isPromise(result)) {
        // For async functions, return Either<L, Promise<T>> where Promise is the value
        // We need to bypass the automatic async state conversion
        return new Either<L, Promise<T>>({
          state: { kind: "right", value: result },
          pendingLeft: [],
          pendingRight: [],
        });
      }
      return Either.Right(result) as Either<L, T>;
    } catch (error) {
      return Either.Left(onError(error)) as Either<L, T>;
    }
  }

  static fromPromise<T, L>(
    promise: Promise<T>,
    onError: (error: unknown) => L,
  ): Promise<Either<L, T>> {
    return promise
      .then((value) => Either.Right(value))
      .catch((error) => Either.Left(onError(error)));
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
  safeUnwrap(): Option<R> {
    if (this.internal.state.kind === "right") {
      return { kind: "some", value: this.internal.state.value };
    }
    return { kind: "none" };
  }

  safeUnwrapLeft(): Option<L> {
    if (this.internal.state.kind === "left") {
      return { kind: "some", value: this.internal.state.value };
    }
    return { kind: "none" };
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
        throw new UnwrappedLeftWithRight(this);
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
        throw new UnwrappedRightWithLeft(this);
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
    // If we're on the Left track, just return this Either with updated type
    if (
      this.internal.state.kind === "left" ||
      this.internal.state.kind === "async-left"
    ) {
      return this as Either<L, U> | Either<L, Promise<U>>;
    }

    // We're on the Right track
    if (this.internal.state.kind === "right") {
      const currentValue = this.internal.state.value;
      const result = fn(currentValue);

      if (isPromise(result)) {
        return new Either({
          state: { kind: "async-right", promise: result },
          pendingLeft: [],
          pendingRight: [],
        }) as unknown as Either<L, Promise<U>>;
      }
      return new Either({
        state: { kind: "right", value: result },
        pendingLeft: [],
        pendingRight: [],
      }) as unknown as Either<L, U>;
    }

    // We're on the async Right track
    if (this.internal.state.kind === "async-right") {
      const newPromise = this.internal.state.promise.then((val) => fn(val));
      return new Either({
        state: { kind: "async-right", promise: newPromise },
        pendingLeft: [],
        pendingRight: [],
      }) as unknown as Either<L, Promise<U>>;
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
      // Return this Either with updated type but preserve the Right state
      return new Either({
        state: this.internal.state as EitherState<L2, R>,
        pendingLeft: [],
        pendingRight: [],
      }) as Either<L2, R>;
    }

    if (this.internal.state.kind === "async-left") {
      const newPromise = this.internal.state.promise.then((val) => fn(val));
      return new Either({
        state: { kind: "async-left", promise: newPromise },
        pendingLeft: [],
        pendingRight: [],
      }) as unknown as Either<Promise<L2>, R>;
    }

    // We're on sync Left track
    const currentValue = (this.internal.state as { kind: "left"; value: L })
      .value;
    const result = fn(currentValue);

    if (isPromise(result)) {
      return new Either({
        state: { kind: "async-left", promise: result },
        pendingLeft: [],
        pendingRight: [],
      }) as unknown as Either<Promise<L2>, R>;
    }

    return new Either({
      state: { kind: "left", value: result },
      pendingLeft: [],
      pendingRight: [],
    }) as unknown as Either<L2, R>;
  }

  // Flat mapping operations
  flatMap<U, L2 = never>(fn: (value: R) => Either<L2, U>): Either<L | L2, U> {
    if (this.internal.state.kind === "left") {
      // We're on Left track, so Right operations are skipped
      return new Either({
        state: this.internal.state as EitherState<L | L2, U>,
        pendingLeft: [],
        pendingRight: [],
      }) as Either<L | L2, U>;
    }

    if (this.internal.state.kind === "async-right") {
      const newPromise = this.internal.state.promise.then((val) => {
        const result = fn(val as R);
        return result.internal.state;
      });

      return new Either({
        state: { kind: "async-right", promise: newPromise },
        pendingLeft: [],
        pendingRight: [],
      }) as unknown as Either<L | L2, U>;
    }

    // We're on sync Right track
    const currentValue = (this.internal.state as { kind: "right"; value: R })
      .value;
    const result = fn(currentValue);
    return result as Either<L | L2, U>;
  }

  flatMapLeft<U, L2 = never>(
    fn: (value: L) => Either<L2, U>,
  ): Either<L2, R | U> {
    if (this.internal.state.kind === "right") {
      // We're on Right track, so Left operations are skipped
      return new Either({
        state: this.internal.state as EitherState<L2, R | U>,
        pendingLeft: [],
        pendingRight: [],
      }) as Either<L2, R | U>;
    }

    if (this.internal.state.kind === "async-left") {
      const newPromise = this.internal.state.promise.then((val) => {
        const result = fn(val as L);
        return result.internal.state;
      });

      return new Either({
        state: { kind: "async-left", promise: newPromise },
        pendingLeft: [],
        pendingRight: [],
      }) as unknown as Either<L2, R | U>;
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
      // If on Right track, we need to create a new Either with correct types
      return new Either({
        state: this.internal.state as EitherState<L2, R | U>,
        pendingLeft: [],
        pendingRight: [],
      }) as Either<L2, R | U>;
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
      return new Either({
        state: leftResult.internal.state as EitherState<L2, R2>,
        pendingLeft: [],
        pendingRight: [],
      });
    }

    // We're on the Right track
    const rightResult = this.mapRight(right);
    // mapRight returns Either<L, R2>, but we need Either<L2, R2>
    // Since we're on the Right track, the L type doesn't matter
    return new Either({
      state: rightResult.internal.state as EitherState<L2, R2>,
      pendingLeft: [],
      pendingRight: [],
    });
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

  // Option integration
  static fromOption<T, L>(option: Option<T>, leftValue: L): Either<L, T> {
    return option.kind === "some"
      ? Either.Right(option.value)
      : Either.Left(leftValue);
  }

  toOption(): Option<R> {
    if (this.internal.state.kind === "right") {
      const value = (this.internal.state as { kind: "right"; value: R }).value;
      return { kind: "some", value };
    }
    return { kind: "none" };
  }

  toOptionLeft(): Option<L> {
    if (this.internal.state.kind === "left") {
      const value = (this.internal.state as { kind: "left"; value: L }).value;
      return { kind: "some", value };
    }
    return { kind: "none" };
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
