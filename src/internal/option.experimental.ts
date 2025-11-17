import { isPromise } from "node:util/types";

const OptSentinelSym = Symbol.for("OptSentinel");
type OptSentinel = typeof OptSentinelSym;

type SafeUnwrap<T> = { success: true; value: T } | { success: false };

// export class BetterOption<T> {
//   value: T | OptSentinel;

//   static None: BetterOption<never> = new BetterOption<never>(OptSentinelSym);

//   private constructor(value: T | OptSentinel) {
//     this.value = value;
//   }

//   static Some<T>(value: T): BetterOption<T> {
//     return new BetterOption<T>(value);
//   }

//   unwrap(): T {
//     if (this.value === OptSentinelSym) {
//       throw new Error("Called unwrap on a None value");
//     }

//     return this.value;
//   }

//   safeUnwrap(): SafeUnwrap<T> {
//     if (this.value === OptSentinelSym) {
//       return { success: false };
//     }

//     return { success: true, value: this.value };
//   }

//   map<U>(
//     this: BetterOption<Promise<T>>,
//     fn: (value: T) => Promise<U>,
//   ): BetterOption<Promise<U>>;
//   map<U>(
//     this: BetterOption<Promise<T>>,
//     fn: (value: T) => U,
//   ): BetterOption<Promise<U>>;
//   map<U>(
//     this: BetterOption<T>,
//     fn: (value: T) => Promise<U>,
//   ): BetterOption<Promise<U>>;
//   map<U>(this: BetterOption<T>, fn: (value: T) => U): BetterOption<U>;
//   map<U>(
//     fn: (value: T) => Promise<U> | U,
//   ): BetterOption<U> | BetterOption<Promise<U>> {
//     if (this.value === OptSentinelSym) {
//       return BetterOption.None;
//     }

//     if (isPromise(this.value)) {
//       const p = this.value as Promise<T>;
//       return new BetterOption(p.then(fn));
//     }

//     const result = fn(this.value);

//     return new BetterOption(result) as
//       | BetterOption<U>
//       | BetterOption<Promise<U>>;
//   }

//   flatMap<U>(
//     this: BetterOption<Promise<T>>,
//     fn: (val: T) => Promise<BetterOption<U>>,
//   ): BetterOption<Promise<U>>;
//   flatMap<U>(
//     this: BetterOption<Promise<T>>,
//     fn: (val: T) => BetterOption<U>,
//   ): BetterOption<Promise<U>>;
//   flatMap<U>(
//     this: BetterOption<T>,
//     fn: (val: T) => Promise<BetterOption<U>>,
//   ): BetterOption<Promise<U>>;
//   flatMap<U>(
//     this: BetterOption<T>,
//     fn: (val: T) => BetterOption<U>,
//   ): BetterOption<U>;
//   flatMap<U>(
//     fn: (val: T) => Promise<BetterOption<U>> | BetterOption<U>,
//   ): BetterOption<U> | BetterOption<Promise<U>> {
//     if (this.value === OptSentinelSym) {
//       return BetterOption.None;
//     }

//     if (isPromise(this.value)) {
//       const p = this.value as Promise<T>;
//       const res = new BetterOption(
//         p.then((v) => fn(v)).then((o) => o.value),
//       ) as BetterOption<Promise<U>>;

//       return res;
//     }

//     const result = fn(this.value);

//     if (isPromise(result)) {
//       return new BetterOption(
//         (result as Promise<BetterOption<U>>).then((o) => o.value),
//       ) as BetterOption<Promise<U>>;
//     }

//     return result;
//   }
// }

export class SyncOpt<T> {
  value: T | OptSentinel;

  static None: SyncOpt<never> = new SyncOpt<never>(OptSentinelSym);

  constructor(value: T | OptSentinel) {
    this.value = value;
  }

  static Some<T>(value: T): SyncOpt<T> {
    return new SyncOpt<T>(value);
  }

  toPromise(): Promise<SyncOpt<T>> {
    return Promise.resolve(this);
  }

  unwrap(): T {
    if (this.value === OptSentinelSym) {
      throw new Error("Called unwrap on a None value");
    }

    return this.value;
  }

  safeUnwrap(): SafeUnwrap<T> {
    if (this.value === OptSentinelSym) {
      return { success: false };
    }

    return { success: true, value: this.value };
  }

  map<U>(fn: (value: T) => U): SyncOpt<U> {
    if (this.value === OptSentinelSym) {
      return SyncOpt.None;
    }

    const result = fn(this.value);

    return new SyncOpt(result);
  }

  flatMap<U>(fn: (val: T) => SyncOpt<U>): SyncOpt<U> {
    if (this.value === OptSentinelSym) {
      return SyncOpt.None;
    }
    const result = fn(this.value);

    return result;
  }

  zip<U>(fn: (val: T) => U): SyncOpt<[T, U]> {
    if (this.value === OptSentinelSym) {
      return SyncOpt.None;
    }
    const other = fn(this.value);

    return new SyncOpt([this.value, other]);
  }

  flatZip<U>(fn: (val: T) => SyncOpt<U>): SyncOpt<[T, U]> {
    if (this.value === OptSentinelSym) {
      return SyncOpt.None;
    }
    const otherOpt = fn(this.value);
    if (otherOpt.value === OptSentinelSym) {
      return SyncOpt.None;
    }

    return new SyncOpt([this.value, otherOpt.value]);
  }
}

export class AsyncOpt<T> {
  value: Promise<T | OptSentinel>;

  static None: AsyncOpt<never> = new AsyncOpt<never>(
    Promise.resolve(OptSentinelSym),
  );

  constructor(value: Promise<T | OptSentinel>) {
    this.value = value;
  }

  static Some<T>(value: T): AsyncOpt<T> {
    return new AsyncOpt<T>(Promise.resolve(value));
  }

  toPromise(): Promise<AsyncOpt<T>> {
    return Promise.resolve(this);
  }

  async unwrap(): Promise<T> {
    const val = await this.value;
    if (val === OptSentinelSym) {
      throw new Error("Called unwrap on a None value");
    }

    return val;
  }

  async safeUnwrap(): Promise<SafeUnwrap<T>> {
    const val = await this.value;
    if (val === OptSentinelSym) {
      return { success: false };
    }

    return { success: true, value: val };
  }

  map<U>(fn: (value: T) => U | Promise<U>): AsyncOpt<U> {
    const newPromise = this.value.then((val) => {
      if (val === OptSentinelSym) {
        return OptSentinelSym;
      }
      return fn(val);
    });

    return new AsyncOpt(
      Promise.resolve(newPromise).then(async (v) =>
        isPromise(v) ? await v : v,
      ),
    );
  }

  flatMap<U>(fn: (val: T) => AsyncOpt<U> | Promise<AsyncOpt<U>>): AsyncOpt<U> {
    const newPromise = this.value.then(async (val) => {
      if (val === OptSentinelSym) {
        return OptSentinelSym;
      }
      const result = fn(val);
      const opt = isPromise(result) ? await result : result;
      const unwrapped = await opt.value;
      return unwrapped;
    });

    return new AsyncOpt(newPromise);
  }

  zip<U>(fn: (val: T) => U | Promise<U>): AsyncOpt<[T, U]> {
    const newPromise = this.value.then(async (val) => {
      if (val === OptSentinelSym) {
        return OptSentinelSym;
      }
      const other = fn(val);
      const otherVal = isPromise(other) ? await other : other;
      return [val, otherVal] as [T, U];
    });

    return new AsyncOpt(newPromise);
  }

  flatZip<U>(
    fn: (val: T) => AsyncOpt<U> | Promise<AsyncOpt<U>>,
  ): AsyncOpt<[T, U]> {
    const newPromise = this.value.then(async (val) => {
      if (val === OptSentinelSym) {
        return OptSentinelSym;
      }
      const otherOptResult = fn(val);
      const otherOpt = isPromise(otherOptResult)
        ? await otherOptResult
        : otherOptResult;
      const otherVal = await otherOpt.value;
      if (otherVal === OptSentinelSym) {
        return OptSentinelSym;
      }
      return [val, otherVal] as [T, U];
    });

    return new AsyncOpt(newPromise);
  }
}

type ExperimentalOptionType<T> = SyncOpt<T> | AsyncOpt<T>;

export class ExperimentalOption<
  T,
  _InternalType extends ExperimentalOptionType<T> = ExperimentalOptionType<T>,
> {
  value: SyncOpt<T> | AsyncOpt<T>;

  static None: ExperimentalOption<never> = new ExperimentalOption<never>(
    SyncOpt.None,
  );

  private constructor(value: SyncOpt<T> | AsyncOpt<T>) {
    this.value = value;
  }

  static Some<T>(value: T): ExperimentalOption<T> {
    return new ExperimentalOption<T>(SyncOpt.Some(value));
  }

  toPromise(): Promise<ExperimentalOption<T>> {
    if (this.value instanceof SyncOpt) {
      return this.value
        .toPromise()
        .then((syncOpt) => new ExperimentalOption<T>(syncOpt));
    }

    return Promise.resolve(this);
  }

  unwrap(this: ExperimentalOption<T, SyncOpt<T>>): T;
  unwrap(this: ExperimentalOption<T, AsyncOpt<T>>): Promise<T>;
  unwrap(): T | Promise<T> {
    return this.value.unwrap();
  }

  safeUnwrap(this: ExperimentalOption<T, SyncOpt<T>>): SafeUnwrap<T>;
  safeUnwrap(this: ExperimentalOption<T, AsyncOpt<T>>): Promise<SafeUnwrap<T>>;
  safeUnwrap(): SafeUnwrap<T> | Promise<SafeUnwrap<T>> {
    return this.value.safeUnwrap();
  }

  map<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (value: T) => Promise<U>,
  ): ExperimentalOption<U, AsyncOpt<U>>;
  map<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (value: T) => Promise<U>,
  ): ExperimentalOption<U, AsyncOpt<U>>;
  map<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (value: T) => Promise<U>,
  ): ExperimentalOption<U, AsyncOpt<U>>;
  map<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (value: T) => U,
  ): ExperimentalOption<U, SyncOpt<U>>;
  map<U>(fn: (value: T) => U | Promise<U>): ExperimentalOption<U> {
    if (this.value instanceof SyncOpt) {
      if (this.value.value === OptSentinelSym) {
        return new ExperimentalOption<U>(SyncOpt.None);
      }

      const result = fn(this.value.value);

      if (isPromise(result)) {
        // Convert to AsyncOpt
        return new ExperimentalOption<U, AsyncOpt<U>>(new AsyncOpt(result));
      } else {
        // Sync result
        return new ExperimentalOption<U, SyncOpt<U>>(new SyncOpt(result));
      }
    } else {
      // AsyncOpt case
      const newPromise = this.value.value.then(async (val) => {
        if (val === OptSentinelSym) {
          return OptSentinelSym;
        }
        const result = fn(val);
        return isPromise(result) ? await result : result;
      });

      return new ExperimentalOption<U, AsyncOpt<U>>(new AsyncOpt(newPromise));
    }
  }

  flatMap<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (val: T) => Promise<ExperimentalOption<U>>,
  ): ExperimentalOption<U, AsyncOpt<U>>;
  flatMap<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (val: T) => ExperimentalOption<U>,
  ): ExperimentalOption<U, AsyncOpt<U>>;
  flatMap<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (val: T) => Promise<ExperimentalOption<U>>,
  ): ExperimentalOption<U, AsyncOpt<U>>;
  flatMap<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (val: T) => ExperimentalOption<U>,
  ): ExperimentalOption<U, SyncOpt<U>>;
  flatMap<U>(
    fn: (val: T) => Promise<ExperimentalOption<U>> | ExperimentalOption<U>,
  ): ExperimentalOption<U> {
    if (this.value instanceof SyncOpt) {
      if (this.value.value === OptSentinelSym) {
        return new ExperimentalOption<U>(SyncOpt.None);
      }

      const result = fn(this.value.value);

      if (isPromise(result)) {
        // Convert to AsyncOpt
        return new ExperimentalOption<U, AsyncOpt<U>>(
          new AsyncOpt(
            result.then((expOpt) => {
              if (expOpt.value instanceof SyncOpt) {
                return expOpt.value.value;
              } else {
                // If it's already AsyncOpt, unwrap its promise
                return expOpt.value.value;
              }
            }),
          ),
        );
      } else {
        // Sync result
        return new ExperimentalOption<U, SyncOpt<U>>(result.value);
      }
    } else {
      // AsyncOpt case
      const newPromise = this.value.value.then(async (val) => {
        if (val === OptSentinelSym) {
          return OptSentinelSym;
        }
        const result = fn(val);
        const expOpt = isPromise(result) ? await result : result;

        if (expOpt.value instanceof SyncOpt) {
          return expOpt.value.value;
        } else {
          // If it's AsyncOpt, unwrap its value
          return await expOpt.value.value;
        }
      });

      return new ExperimentalOption<U, AsyncOpt<U>>(new AsyncOpt(newPromise));
    }
  }

  zip<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (val: T) => Promise<U>,
  ): ExperimentalOption<[T, U], AsyncOpt<[T, U]>>;
  zip<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (val: T) => U,
  ): ExperimentalOption<[T, U], AsyncOpt<[T, U]>>;
  zip<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (val: T) => Promise<U>,
  ): ExperimentalOption<[T, U], AsyncOpt<[T, U]>>;
  zip<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (val: T) => U,
  ): ExperimentalOption<[T, U], SyncOpt<[T, U]>>;
  zip<U>(fn: (val: T) => U | Promise<U>): ExperimentalOption<[T, U]> {
    if (this.value instanceof SyncOpt) {
      if (this.value.value === OptSentinelSym) {
        return new ExperimentalOption<[T, U]>(SyncOpt.None);
      }

      const originalValue = this.value.value;
      const result = fn(this.value.value);

      if (isPromise(result)) {
        // Convert to AsyncOpt
        return new ExperimentalOption<[T, U], AsyncOpt<[T, U]>>(
          new AsyncOpt(result.then((u) => [originalValue, u] as [T, U])),
        );
      } else {
        // Sync result
        return new ExperimentalOption<[T, U], SyncOpt<[T, U]>>(
          new SyncOpt([originalValue, result] as [T, U]),
        );
      }
    } else {
      // AsyncOpt case
      const newPromise = this.value.value.then(async (val) => {
        if (val === OptSentinelSym) {
          return OptSentinelSym;
        }
        const result = fn(val);
        const u = isPromise(result) ? await result : result;
        return [val, u] as [T, U];
      });

      return new ExperimentalOption<[T, U], AsyncOpt<[T, U]>>(
        new AsyncOpt(newPromise),
      );
    }
  }

  flatZip<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (val: T) => Promise<ExperimentalOption<U>>,
  ): ExperimentalOption<[T, U], AsyncOpt<[T, U]>>;
  flatZip<U>(
    this: ExperimentalOption<T, AsyncOpt<T>>,
    fn: (val: T) => ExperimentalOption<U>,
  ): ExperimentalOption<[T, U], AsyncOpt<[T, U]>>;
  flatZip<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (val: T) => Promise<ExperimentalOption<U>>,
  ): ExperimentalOption<[T, U], AsyncOpt<[T, U]>>;
  flatZip<U>(
    this: ExperimentalOption<T, SyncOpt<T>>,
    fn: (val: T) => ExperimentalOption<U>,
  ): ExperimentalOption<[T, U], SyncOpt<[T, U]>>;
  flatZip<U>(
    fn: (val: T) => Promise<ExperimentalOption<U>> | ExperimentalOption<U>,
  ): ExperimentalOption<[T, U]> {
    if (this.value instanceof SyncOpt) {
      if (this.value.value === OptSentinelSym) {
        return new ExperimentalOption<[T, U]>(SyncOpt.None);
      }

      const originalValue = this.value.value;
      const result = fn(this.value.value);

      if (isPromise(result)) {
        // Convert to AsyncOpt
        return new ExperimentalOption<[T, U], AsyncOpt<[T, U]>>(
          new AsyncOpt(
            result
              .then((expOpt) => {
                if (expOpt.value instanceof SyncOpt) {
                  if (expOpt.value.value === OptSentinelSym) {
                    return OptSentinelSym;
                  }
                  return [originalValue, expOpt.value.value] as [T, U];
                } else {
                  // If it's AsyncOpt, we need to handle the promise
                  return expOpt.value.value.then((u) => {
                    if (u === OptSentinelSym) {
                      return OptSentinelSym;
                    }
                    return [originalValue, u] as [T, U];
                  });
                }
              })
              .then((result) => {
                // Handle the case where result might be a promise
                return isPromise(result) ? result : Promise.resolve(result);
              })
              .then(async (promisedResult) => {
                return await promisedResult;
              }),
          ),
        );
      } else {
        // Sync result
        if (result.value instanceof SyncOpt) {
          if (result.value.value === OptSentinelSym) {
            return new ExperimentalOption<[T, U]>(SyncOpt.None);
          }
          return new ExperimentalOption<[T, U], SyncOpt<[T, U]>>(
            new SyncOpt([originalValue, result.value.value] as [T, U]),
          );
        } else {
          // Result is AsyncOpt - need to extract its value
          return new ExperimentalOption<[T, U], AsyncOpt<[T, U]>>(
            new AsyncOpt(
              result.value.value.then((u) => {
                if (u === OptSentinelSym) {
                  return OptSentinelSym;
                }
                return [originalValue, u] as [T, U];
              }),
            ),
          );
        }
      }
    } else {
      // AsyncOpt case
      const newPromise = this.value.value.then(async (val) => {
        if (val === OptSentinelSym) {
          return OptSentinelSym;
        }
        const result = fn(val);
        const expOpt = isPromise(result) ? await result : result;

        if (expOpt.value instanceof SyncOpt) {
          if (expOpt.value.value === OptSentinelSym) {
            return OptSentinelSym;
          }
          return [val, expOpt.value.value] as [T, U];
        } else {
          // If it's AsyncOpt, unwrap its value
          const u = await expOpt.value.value;
          if (u === OptSentinelSym) {
            return OptSentinelSym;
          }
          return [val, u] as [T, U];
        }
      });

      return new ExperimentalOption<[T, U], AsyncOpt<[T, U]>>(
        new AsyncOpt(newPromise),
      );
    }
  }
}
