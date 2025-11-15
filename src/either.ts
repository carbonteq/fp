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

// Core type definitions - simplified pattern based on ExperimentalResult
type EitherData<L, R> =
  | { kind: "left"; value: L }
  | { kind: "right"; value: R }
  | { kind: "async-left"; promise: Promise<L> }
  | { kind: "async-right"; promise: Promise<R> };

// Track-specific types for better type safety
type LeftTrack<L, R> = { kind: "left" | "async-left" };
type RightTrack<L, R> = { kind: "right" | "async-right" };

// Helper to extract value types from EitherData
type LeftValue<T> = T extends EitherData<infer L, any> ? L : never;
type RightValue<T> = T extends EitherData<any, infer R> ? R : never;

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
  private readonly data: EitherData<L, R>;

  private constructor(data: EitherData<L, R>) {
    this.data = data;
  }

  // Static Constructors
  static Left<L, R = never>(value: L): Either<L, R>;
  static Left<L, R = never>(value: Promise<L>): Either<L, R>;
  static Left<L, R = never>(value: L | Promise<L>): Either<L, R> {
    if (isPromise(value)) {
      return new Either<L, R>({ kind: "async-left", promise: value });
    }
    return new Either<L, R>({ kind: "left", value });
  }

  static Right<R, L = never>(value: R): Either<L, R>;
  static Right<R, L = never>(value: Promise<R>): Either<L, R>;
  static Right<R, L = never>(value: R | Promise<R>): Either<L, R> {
    if (isPromise(value)) {
      return new Either<L, R>({ kind: "async-right", promise: value });
    }
    return new Either<L, R>({ kind: "right", value });
  }

  static fromPredicate<T, L>(
    value: T,
    predicate: (t: T) => boolean,
    leftValue: L
  ): Either<L, T> {
    return predicate(value) ? Either.Right(value) : Either.Left(leftValue);
  }

  static tryCatch<T, L>(
    fn: () => T | Promise<T>,
    onError: (error: unknown) => L
  ): Either<L, T> | Either<L, Promise<T>> {
    try {
      const result = fn();
      if (isPromise(result)) {
        return Either.fromPromise(result, onError) as unknown as Either<L, Promise<T>>;
      }
      return Either.Right(result) as Either<L, T>;
    } catch (error) {
      return Either.Left(onError(error)) as Either<L, T>;
    }
  }

  static fromPromise<T, L>(
    promise: Promise<T>,
    onError: (error: unknown) => L
  ): Promise<Either<L, T>> {
    return promise
      .then((value) => Either.Right(value))
      .catch((error) => Either.Left(onError(error)));
  }

  // Introspection methods
  isLeft(): this is Either<L, never> {
    return this.data.kind === "left" || this.data.kind === "async-left";
  }

  isRight(): this is Either<never, R> {
    return this.data.kind === "right" || this.data.kind === "async-right";
  }

  isSyncLeft(): this is Either<L, never> {
    return this.data.kind === "left";
  }

  isSyncRight(): this is Either<never, R> {
    return this.data.kind === "right";
  }

  isAsyncLeft(): this is Either<L, never> {
    return this.data.kind === "async-left";
  }

  isAsyncRight(): this is Either<never, R> {
    return this.data.kind === "async-right";
  }

  async isLeftResolved(): Promise<boolean> {
    if (this.data.kind === "left") return true;
    if (this.data.kind === "async-left") {
      try {
        await this.data.promise;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  async isRightResolved(): Promise<boolean> {
    if (this.data.kind === "right") return true;
    if (this.data.kind === "async-right") {
      try {
        await this.data.promise;
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // Safe unwrapping methods
  safeUnwrap(): Option<R> {
    if (this.data.kind === "right") {
      return { kind: "some", value: this.data.value };
    }
    return { kind: "none" };
  }

  safeUnwrapLeft(): Option<L> {
    if (this.data.kind === "left") {
      return { kind: "some", value: this.data.value };
    }
    return { kind: "none" };
  }

  toTuple(): [L, null] | [null, R] {
    if (this.data.kind === "left") {
      return [this.data.value, null];
    }
    if (this.data.kind === "right") {
      return [null, this.data.value];
    }
    // For async values, we can't return them synchronously
    if (this.data.kind === "async-left") {
      throw new Error("Cannot convert async Left value to tuple synchronously. Use toTupleResolved() instead.");
    }
    if (this.data.kind === "async-right") {
      throw new Error("Cannot convert async Right value to tuple synchronously. Use toTupleResolved() instead.");
    }
    // This should never happen with proper typing
    throw new Error("Invalid Either state");
  }

  async toTupleResolved(): Promise<[L, null] | [null, R]> {
    switch (this.data.kind) {
      case "left":
        return [this.data.value, null];
      case "right":
        return [null, this.data.value];
      case "async-left":
        try {
          const resolved = await this.data.promise;
          return [resolved, null];
        } catch (error) {
          throw error;
        }
      case "async-right":
        try {
          const resolved = await this.data.promise;
          return [null, resolved];
        } catch (error) {
          throw error;
        }
      default:
        throw new Error("Invalid Either state");
    }
  }

  // Unwrapping methods
  unwrap(): R | Promise<R> {
    switch (this.data.kind) {
      case "right":
        return this.data.value;
      case "async-right":
        return this.data.promise;
      case "left":
      case "async-left":
        throw new UnwrappedLeftWithRight(this);
      default:
        throw new Error("Invalid Either state");
    }
  }

  unwrapLeft(): L | Promise<L> {
    switch (this.data.kind) {
      case "left":
        return this.data.value;
      case "async-left":
        return this.data.promise;
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
  mapRight<U>(fn: (value: R) => U | Promise<U>): Either<L, U> | Either<L, Promise<U>> {
    // If we're on the Left track, just return this Either with updated type
    if (this.data.kind === "left" || this.data.kind === "async-left") {
      return this as Either<L, U> | Either<L, Promise<U>>;
    }

    // We're on the Right track
    if (this.data.kind === "right") {
      const currentValue = this.data.value;
      const result = fn(currentValue);

      if (isPromise(result)) {
        return new Either<L, Promise<U>>({ kind: "async-right", promise: result });
      }
      return new Either<L, U>({ kind: "right", value: result });
    }

    // We're on the async Right track
    if (this.data.kind === "async-right") {
      const newPromise = this.data.promise.then((val) => fn(val));
      return new Either<L, Promise<U>>({ kind: "async-right", promise: newPromise });
    }

    // This should never happen with proper typing
    throw new Error("Invalid Either state");
  }

  // Left track operations
  mapLeft<L2>(fn: (value: L) => L2): Either<L2, R>;
  mapLeft<L2>(fn: (value: L) => Promise<L2>): Either<Promise<L2>, R>;
  mapLeft<L2>(fn: (value: L) => L2 | Promise<L2>): Either<L2, R> | Either<Promise<L2>, R> {
    if (this.internal.state.kind === "right") {
      const newEither = new Either(this.internal.state as EitherState<L2, R>) as Either<L2, R>;
      newEither.internal.pendingRight = [...this.internal.pendingRight];
      return newEither;
    }

    const currentValue = this.internal.state.value;

    if (isPromise(currentValue)) {
      const newPromise = currentValue.then((val) => fn(val as L));
      return new Either({ kind: "left", value: newPromise }) as unknown as Either<Promise<L2>, R>;
    }

    const result = fn(currentValue as L);
    if (isPromise(result)) {
      return new Either({ kind: "left", value: result }) as unknown as Either<Promise<L2>, R>;
    }

    return new Either({ kind: "left", value: result }) as unknown as Either<L2, R>;
  }

  // Flat mapping operations
  flatMap<U, L2 = never>(fn: (value: R) => Either<L2, U>): Either<L | L2, U> {
    if (this.internal.state.kind === "left") {
      const newEither = new Either(this.internal.state as EitherState<L | L2, U>) as Either<L | L2, U>;
      newEither.internal.pendingLeft = [...this.internal.pendingLeft];
      return newEither;
    }

    const currentValue = this.internal.state.value;

    if (isPromise(currentValue)) {
      const newPromise = currentValue.then((val) => {
        const result = fn(val as R);
        return result.internal.state.value;
      });

      return new Either({ kind: "right", value: newPromise }) as unknown as Either<L | L2, U>;
    }

    const result = fn(currentValue as R);
    return result as Either<L | L2, U>;
  }

  flatMapLeft<U, L2 = never>(fn: (value: L) => Either<L2, U>): Either<L2, R | U> {
    if (this.internal.state.kind === "right") {
      const newEither = new Either(this.internal.state as EitherState<L2, R | U>) as Either<L2, R | U>;
      newEither.internal.pendingRight = [...this.internal.pendingRight];
      return newEither;
    }

    const currentValue = this.internal.state.value;

    if (isPromise(currentValue)) {
      const newPromise = currentValue.then((val) => {
        const result = fn(val as L);
        return result.internal.state.value;
      });

      return new Either({ kind: "left", value: newPromise }) as unknown as Either<L2, R | U>;
    }

    const result = fn(currentValue as L);
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

  flatZip<U, L2 = never>(fn: (value: R) => Either<L2, U>): Either<L | L2, [R, U]> {
    return this.flatMap((value: R) => {
      const either = fn(value);
      return either.map((inner: U) => [value, inner] as [R, U]);
    });
  }

  flatZipLeft<U, L2 = never>(fn: (value: L) => Either<L2, U>): Either<L2, [U, R]> {
    if (this.internal.state.kind === "right") {
      const newEither = new Either(this.internal.state as EitherState<L2, [U, R]>) as Either<L2, [U, R]>;
      newEither.internal.pendingRight = [...this.internal.pendingRight];
      return newEither;
    }

    return this.flatMapLeft((value: L) => {
      const either = fn(value);
      return either.map((rightValue: U) => {
        // We need to get the original Right value, but since we're in flatMapLeft,
        // we don't have access to it. This suggests the method signature might be incorrect.
        // For now, let's return a placeholder that should be fixed by proper design review.
        return [rightValue, undefined as any] as [U, R];
      });
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
    if (this.internal.state.kind === "left") {
      return this.mapLeft(left) as Either<L2, R2>;
    }
    return this.mapRight(right) as Either<L2, R2>;
  }

  match<T>({
    left,
    right,
  }: {
    left: (value: L) => T;
    right: (value: R) => T;
  }): T | Promise<T> {
    if (this.internal.state.kind === "left") {
      const value = this.internal.state.value;
      if (isPromise(value)) {
        return value.then((resolved) => left(resolved as L));
      }
      return left(value as L);
    }

    const value = this.internal.state.value;
    if (isPromise(value)) {
      return value.then((resolved) => right(resolved as R));
    }
    return right(value as R);
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
      return Either.Right(this.internal.state.value as L);
    }
    return Either.Left(this.internal.state.value as R);
  }

  toLeft(leftValue: L): Either<L, R> {
    return Either.Left(leftValue);
  }

  toRight(rightValue: R): Either<L, R> {
    return Either.Right(rightValue);
  }

  ifLeft(fn: (value: L) => Either<L, R>): Either<L, R> {
    if (this.internal.state.kind === "left") {
      const value = this.internal.state.value;
      if (isPromise(value)) {
        // For async values, we'll return a Promise<Either> but the type system doesn't handle this well
        // This is a limitation - in practice you'd handle this differently
        value.then((resolved) => fn(resolved as L));
        return this;
      }
      return fn(value as L);
    }
    return this;
  }

  ifRight(fn: (value: R) => Either<L, R>): Either<L, R> {
    if (this.internal.state.kind === "right") {
      const value = this.internal.state.value;
      if (isPromise(value)) {
        // For async values, we'll return a Promise<Either> but the type system doesn't handle this well
        // This is a limitation - in practice you'd handle this differently
        value.then((resolved) => fn(resolved as R));
        return this;
      }
      return fn(value as R);
    }
    return this;
  }

  // Static advanced methods
  static all<L, R>(...eithers: Either<L, R>[]): Either<L[], R[]> {
    const lefts: L[] = [];
    const rights: R[] = [];

    for (const either of eithers) {
      if (either.internal.state.kind === "left") {
        lefts.push(either.internal.state.value as L);
      } else {
        rights.push(either.internal.state.value as R);
      }
    }

    return lefts.length > 0 ? Either.Left(lefts) : Either.Right(rights);
  }

  static allParallel<L, R>(eithers: Either<L, R>[]): Promise<Either<L[], R[]>> {
    const promises = eithers.map(async (either) => {
      if (either.internal.state.kind === "left") {
        const value = either.internal.state.value;
        const resolved = isPromise(value) ? await value : value;
        return { kind: "left" as const, value: resolved };
      } else {
        const value = either.internal.state.value;
        const resolved = isPromise(value) ? await value : value;
        return { kind: "right" as const, value: resolved };
      }
    });

    return Promise.all(promises).then((results) => {
      const lefts = results.filter((r) => r.kind === "left").map((r) => r.value);
      const rights = results.filter((r) => r.kind === "right").map((r) => r.value);

      return lefts.length > 0 ? Either.Left(lefts) : Either.Right(rights);
    });
  }

  // Validation methods
  validateRight<L2 = never>(
    validators: Array<(value: R) => Either<L2, R>>
  ): Either<L | L2, R> {
    if (this.internal.state.kind === "left") {
      return this as Either<L | L2, R>;
    }

    const value = this.internal.state.value as R;

    for (const validator of validators) {
      try {
        const result = validator(value);
        if (result.internal.state.kind === "left") {
          return Either.Left<L | L2, R>(result.internal.state.value as L | L2);
        }
      } catch (error) {
        return Either.Left<L | L2, R>(error as L2);
      }
    }

    return this as Either<L | L2, R>;
  }

  validateLeft<L2 = never>(
    validators: Array<(value: L) => Either<L2, L>>
  ): Either<L2 | L, R> {
    if (this.internal.state.kind === "right") {
      return this as Either<L2 | L, R>;
    }

    const value = this.internal.state.value as L;

    for (const validator of validators) {
      try {
        const result = validator(value);
        if (result.internal.state.kind === "left") {
          return Either.Left<L2 | L, R>(result.internal.state.value as L2 | L);
        }
      } catch (error) {
        return Either.Left<L2 | L, R>(error as L2);
      }
    }

    return this as Either<L2 | L, R>;
  }

  // String representation
  toString(): string {
    if (this.internal.state.kind === "left") {
      const value = this.internal.state.value;
      return isPromise(value) ? "Either::Left<pending>" : `Either::Left<${String(value)}>`;
    }

    const value = this.internal.state.value;
    return isPromise(value) ? "Either::Right<pending>" : `Either::Right<${String(value)}>`;
  }

  // Option integration
  static fromOption<T, L>(option: Option<T>, leftValue: L): Either<L, T> {
    return option.kind === "some" ? Either.Right(option.value) : Either.Left(leftValue);
  }

  toOption(): Option<R> {
    return this.internal.state.kind === "right"
      ? { kind: "some", value: this.internal.state.value as R }
      : { kind: "none" };
  }

  toOptionLeft(): Option<L> {
    return this.internal.state.kind === "left"
      ? { kind: "some", value: this.internal.state.value as L }
      : { kind: "none" };
  }

  // Async conversion
  async toPromise(): Promise<Either<L, R>> {
    if (this.internal.state.kind === "left") {
      const value = this.internal.state.value;
      const resolved = isPromise(value) ? await value : value;
      return Either.Left(resolved as L);
    }

    const value = this.internal.state.value;
    const resolved = isPromise(value) ? await value : value;
    return Either.Right(resolved as R);
  }
}