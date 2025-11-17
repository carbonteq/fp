const SentinelSym = Symbol.for("SentinelSym");
type Sentinel = typeof SentinelSym;

type SyncResultState<T, E> = { value: T | Sentinel; error: E | Sentinel };

type SafeUnwrapResult<T> =
  | { success: true; value: T }
  | { success: false; value: Sentinel };

export class SyncResult<T, E> {
  private state: SyncResultState<T, E>;

  constructor(state: SyncResultState<T, E>) {
    this.state = state;
  }

  static Ok<T, E>(value: T): SyncResult<T, E> {
    return new SyncResult<T, E>({ value, error: SentinelSym });
  }

  static Err<T, E>(error: E): SyncResult<T, E> {
    return new SyncResult<T, E>({ value: SentinelSym, error });
  }

  private inOkState(): boolean {
    return this.state.value !== SentinelSym;
  }

  private inErrState(): boolean {
    return this.state.error !== SentinelSym;
  }

  isOk(): this is SyncResult<T, never> {
    return this.state.error === SentinelSym;
  }

  isErr(): this is SyncResult<never, E> {
    return this.state.value === SentinelSym;
  }

  unwrap(): T {
    if (this.inOkState()) {
      return this.state.value as T;
    } else {
      throw new Error("Called unwrap on an Err value");
    }
  }

  unwrapErr(): E {
    if (this.inErrState()) {
      return this.state.error as E;
    } else {
      throw new Error("Called unwrapErr on an Ok value");
    }
  }

  safeUnwrap(): SafeUnwrapResult<T> {
    if (this.inOkState()) {
      return { success: true, value: this.state.value as T };
    } else {
      return { success: false, value: SentinelSym };
    }
  }

  clone(): SyncResult<T, E> {
    return new SyncResult<T, E>({ ...this.state });
  }

  cloneOk<Err = E>(): SyncResult<T, Err> {
    return SyncResult.Ok<T, Err>(this.state.value as T);
  }

  cloneErr<U = T>(): SyncResult<U, E> {
    return SyncResult.Err<U, E>(this.state.error as E);
  }

  map<U>(fn: (val: T) => U): SyncResult<U, E> {
    if (this.inErrState()) {
      return this.cloneErr();
    }

    return SyncResult.Ok<U, E>(fn(this.state.value as T));
  }

  mapErr<F>(fn: (err: E) => F): SyncResult<T, F> {
    if (this.inOkState()) {
      return this.cloneOk();
    }

    return SyncResult.Err<T, F>(fn(this.state.error as E));
  }

  flatMap<U>(fn: (val: T) => SyncResult<U, E>): SyncResult<U, E> {
    if (this.inErrState()) {
      return this.cloneErr();
    }

    return fn(this.state.value as T);
  }

  zip<U>(fn: (val: T) => U): SyncResult<[T, U], E> {
    if (this.inErrState()) {
      return SyncResult.Err<[T, U], E>(this.state.error as E);
    }

    const newValue = fn(this.state.value as T);
    return SyncResult.Ok<[T, U], E>([this.state.value as T, newValue]);
  }

  flatZip<U>(fn: (val: T) => SyncResult<U, E>): SyncResult<[T, U], E> {
    if (this.inErrState()) {
      return this.cloneErr();
    }

    const newResult = fn(this.state.value as T);
    if (newResult.isErr()) {
      return newResult.cloneErr();
    }

    return SyncResult.Ok<[T, U], E>([
      this.state.value as T,
      newResult.state.value as U,
    ]);
  }
}

export class AsyncResult<T, E> {
  inner: Promise<SyncResult<T, E>>;

  constructor(inner: Promise<SyncResult<T, E>>) {
    this.inner = inner;
  }

  static Ok<T, E>(value: T): AsyncResult<T, E> {
    return new AsyncResult<T, E>(Promise.resolve(SyncResult.Ok<T, E>(value)));
  }

  static Err<T, E>(error: E): AsyncResult<T, E> {
    return new AsyncResult<T, E>(Promise.resolve(SyncResult.Err<T, E>(error)));
  }

  async isOk(): Promise<boolean> {
    const result = await this.inner;
    return result.isOk();
  }

  async isErr(): Promise<boolean> {
    const result = await this.inner;
    return result.isErr();
  }

  async unwrap(): Promise<T> {
    const result = await this.inner;
    return result.unwrap();
  }

  async unwrapErr(): Promise<E> {
    const result = await this.inner;
    return result.unwrapErr();
  }

  async safeUnwrap(): Promise<SafeUnwrapResult<T>> {
    const result = await this.inner;
    return result.safeUnwrap();
  }

  map<U>(fn: (val: T) => U): AsyncResult<U, E> {
    const newInner = this.inner.then((result) => result.map(fn));
    return new AsyncResult<U, E>(newInner);
  }

  mapErr<F>(fn: (err: E) => F): AsyncResult<T, F> {
    const newInner = this.inner.then((result) => result.mapErr(fn));
    return new AsyncResult<T, F>(newInner);
  }

  flatMap<U>(fn: (val: T) => AsyncResult<U, E>): AsyncResult<U, E> {
    const newInner = this.inner.then(async (result) => {
      if (result.isErr()) {
        return result.cloneErr();
      }
      const nextResult = await fn(result.unwrap()).inner;
      return nextResult;
    });

    return new AsyncResult<U, E>(newInner);
  }

  zip<U>(fn: (val: T) => U): AsyncResult<[T, U], E> {
    const newInner = this.inner.then((result) => result.zip(fn));
    return new AsyncResult<[T, U], E>(newInner);
  }

  flatZip<U>(fn: (val: T) => AsyncResult<U, E>): AsyncResult<[T, U], E> {
    const newInner = this.inner.then(async (result) => {
      if (result.isErr()) {
        return result.cloneErr();
      }
      const nextResult = await fn(result.unwrap()).inner;
      if (nextResult.isErr()) {
        return nextResult.cloneErr();
      }
      return SyncResult.Ok<[T, U], E>([result.unwrap(), nextResult.unwrap()]);
    });

    return new AsyncResult<[T, U], E>(newInner);
  }
}

type BetterResultState<T, E> = SyncResult<T, E> | AsyncResult<T, E>;
export class BetterResult<T, E> {
  private state: BetterResultState<T, E>;

  private constructor(state: BetterResultState<T, E>) {
    this.state = state;
  }

  static Ok<T, E>(value: T): BetterResult<T, E> {
    return new BetterResult<T, E>(SyncResult.Ok<T, E>(value));
  }

  static Err<T, E>(error: E): BetterResult<T, E> {
    return new BetterResult<T, E>(SyncResult.Err<T, E>(error));
  }

  static fromPromise<T, E>(promise: Promise<T>): BetterResult<T, E> {
    const asyncResult = new AsyncResult<T, E>(
      promise.then(
        (value) => SyncResult.Ok<T, E>(value),
        (error) => SyncResult.Err<T, E>(error as E),
      ),
    );

    return new BetterResult<T, E>(asyncResult);
  }

  isAsync(): boolean {
    return this.state instanceof AsyncResult;
  }

  isOk(): boolean | Promise<boolean> {
    if (this.state instanceof SyncResult) {
      return this.state.isOk();
    } else {
      return this.state.isOk();
    }
  }

  isErr(): boolean | Promise<boolean> {
    if (this.state instanceof SyncResult) {
      return this.state.isErr();
    } else {
      return this.state.isErr();
    }
  }

  unwrap(): T | Promise<T> {
    if (this.state instanceof SyncResult) {
      return this.state.unwrap();
    } else {
      return this.state.unwrap();
    }
  }

  unwrapErr(): E | Promise<E> {
    if (this.state instanceof SyncResult) {
      return this.state.unwrapErr();
    } else {
      return this.state.unwrapErr();
    }
  }

  async safeUnwrap(): Promise<{ success: boolean; value: T | Sentinel }> {
    if (this.state instanceof SyncResult) {
      return this.state.safeUnwrap();
    } else {
      return this.state.safeUnwrap();
    }
  }

  clone(): BetterResult<T, E> {
    if (this.state instanceof SyncResult) {
      return new BetterResult<T, E>(this.state.clone());
    } else {
      return new BetterResult<T, E>(
        new AsyncResult<T, E>(
          this.state.inner.then((result) => result.clone()),
        ),
      );
    }
  }

  cloneOk<Err = E>(): BetterResult<T, Err> {
    if (this.state instanceof SyncResult) {
      return new BetterResult<T, Err>(this.state.cloneOk<Err>());
    } else {
      return new BetterResult<T, Err>(
        new AsyncResult<T, Err>(
          this.state.inner.then((result) => result.cloneOk<Err>()),
        ),
      );
    }
  }

  cloneErr<U = T>(): BetterResult<U, E> {
    if (this.state instanceof SyncResult) {
      return new BetterResult<U, E>(this.state.cloneErr<U>());
    } else {
      return new BetterResult<U, E>(
        new AsyncResult<U, E>(
          this.state.inner.then((result) => result.cloneErr<U>()),
        ),
      );
    }
  }

  async toPromise(): Promise<BetterResult<T, E>> {
    if (this.state instanceof SyncResult) {
      return Promise.resolve(this);
    } else {
      return this.state.inner.then((result) => new BetterResult<T, E>(result));
    }
  }

  map<U>(fn: (val: T) => U): BetterResult<U, E> {
    if (this.state instanceof SyncResult) {
      return new BetterResult<U, E>(this.state.map(fn));
    } else {
      return new BetterResult<U, E>(this.state.map(fn));
    }
  }

  flatMap<U>(fn: (val: T) => BetterResult<U, E>): BetterResult<U, E> {
    if (this.state instanceof SyncResult) {
      const result = this.state;
      if (result.isErr()) {
        return new BetterResult<U, E>(result.cloneErr());
      }
      return fn(result.unwrap());
    } else {
      const asyncResult = this.state;
      const newInner = asyncResult.inner.then(async (result) => {
        if (result.isErr()) {
          return result.cloneErr();
        }
        const nextBetterResult = fn(result.unwrap());
        if (nextBetterResult.state instanceof SyncResult) {
          return nextBetterResult.state;
        } else {
          return await nextBetterResult.state.inner;
        }
      });
      return new BetterResult<U, E>(new AsyncResult<U, E>(newInner));
    }
  }

  zip<U>(fn: (val: T) => U): BetterResult<[T, U], E> {
    if (this.state instanceof SyncResult) {
      return new BetterResult<[T, U], E>(this.state.zip(fn));
    } else {
      return new BetterResult<[T, U], E>(this.state.zip(fn));
    }
  }

  flatZip<U>(fn: (val: T) => BetterResult<U, E>): BetterResult<[T, U], E> {
    if (this.state instanceof SyncResult) {
      const result = this.state;
      if (result.isErr()) {
        return new BetterResult<[T, U], E>(result.cloneErr());
      }

      return fn(result.unwrap()).flatMap((u) =>
        BetterResult.Ok<[T, U], E>([result.unwrap(), u]),
      );
    } else {
      const asyncResult = this.state;
      const newInner = asyncResult.inner.then(async (result) => {
        if (result.isErr()) {
          return result.cloneErr();
        }
        const nextBetterResult = fn(result.unwrap());
        if (nextBetterResult.state instanceof SyncResult) {
          return SyncResult.Ok<[T, U], E>([
            result.unwrap(),
            nextBetterResult.state.unwrap(),
          ]);
        } else {
          const nextAsyncResult = nextBetterResult.state;
          const nextResult = await nextAsyncResult.inner;
          if (nextResult.isErr()) {
            return nextResult.cloneErr();
          }
          return SyncResult.Ok<[T, U], E>([
            result.unwrap(),
            nextResult.unwrap(),
          ]);
        }
      });
      return new BetterResult<[T, U], E>(new AsyncResult<[T, U], E>(newInner));
    }
  }
}
