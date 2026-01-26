import { ExperimentalResult } from "./result-experimental.js";
import { UNIT } from "./unit.js";
import { CapturedTrace, isCapturedTrace, isPromiseLike } from "./utils.js";

type Predicate<T> = (val: T) => boolean;
type Falsy = false | 0 | "" | null | undefined;

/**
 * Error thrown when attempting to unwrap a `None` value.
 *
 * This exception is thrown by {@link ExperimentalOption.unwrap} when called on a `None`.
 * It represents a programmer error - you should only call `unwrap()` when
 * you are certain the ExperimentalOption contains a value, or use safe alternatives
 * like {@link ExperimentalOption.unwrapOr} or {@link ExperimentalOption.safeUnwrap}.
 *
 * @example
 * ```ts
 * try {
 *   ExperimentalOption.None.unwrap();
 * } catch (e) {
 *   e instanceof UnwrappedNone // true
 *   e.name // "UnwrapError"
 * }
 * ```
 */
export class UnwrappedNone extends Error {
  readonly name = "UnwrapError";

  constructor() {
    super("Attempted to unwrap ExperimentalOption::None");
  }
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();

const NONE_VAL = Symbol("ExperimentalOption::None");

export type UnitOption = ExperimentalOption<UNIT>;
export type UnwrapOption<T> = T extends ExperimentalOption<infer R> ? R : never;

type CombinedOptions<T extends ExperimentalOption<unknown>[]> = {
  [K in keyof T]: UnwrapOption<T[K]>;
};

interface MatchCases<T, U> {
  Some: (val: T) => U;
  None: () => U;
}

/**
 * Wrapper that makes ExperimentalOption yieldable with proper type tracking.
 *
 * @internal
 */
class OptionYieldWrap<T> {
  constructor(readonly option: ExperimentalOption<T>) {}

  *[Symbol.iterator](): Generator<OptionYieldWrap<T>, T, unknown> {
    return (yield this) as T;
  }
}

/**
 * Wrapper that makes ExperimentalOption yieldable in async generators with proper type tracking.
 *
 * @internal
 */
class AsyncOptionYieldWrap<T> {
  readonly option: Promise<ExperimentalOption<T>>;

  constructor(option: ExperimentalOption<T> | Promise<ExperimentalOption<T>>) {
    this.option = (
      isPromiseLike(option) ? option : Promise.resolve(option)
    ) as Promise<ExperimentalOption<T>>;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<
    AsyncOptionYieldWrap<T>,
    Awaited<T>,
    unknown
  > {
    return (yield this) as Awaited<T>;
  }
}

/**
 * A type-safe container for optional values.
 *
 * `ExperimentalOption<T>` represents a value that may or may not be present. It eliminates the
 * need for `null` and `undefined` checks by making absence explicit through the
 * type system.
 *
 * ## States
 *
 * - **Some\<T\>**: Contains a value of type `T`
 * - **None**: Represents absence of a value (singleton)
 *
 * ## Basic Usage
 *
 * ```ts
 * import { ExperimentalOption } from "@carbonteq/fp";
 *
 * // Creating ExperimentalOptions
 * const some: ExperimentalOption<number> = ExperimentalOption.Some(42);
 * const none: ExperimentalOption<number> = ExperimentalOption.None;
 *
 * // From nullable values
 * const fromNull = ExperimentalOption.fromNullable(null); // None
 * const fromValue = ExperimentalOption.fromNullable("hello"); // Some("hello")
 *
 * // Checking and extracting
 * if (some.isSome()) {
 *   console.log(some.unwrap()); // 42
 * }
 *
 * // Chaining operations
 * const result = ExperimentalOption.Some(5)
 *   .map(x => x * 2)
 *   .flatMap(x => ExperimentalOption.Some(x + 1));
 * // Some(11)
 * ```
 *
 * ## Async Variants
 *
 * For operations that return Promises, use `*Async` methods:
 *
 * ```ts
 * // Sync
 * ExperimentalOption.Some(5).map(x => x * 2); // ExperimentalOption<number>
 *
 * // Async
 * ExperimentalOption.Some(5).mapAsync(async x => x * 2); // Promise<ExperimentalOption<number>>
 * ```
 *
 * @template T - The type of the contained value
 *
 * @see {@link https://carbonteq.github.io/ct-fp/option | ExperimentalOption Documentation}
 */
export class ExperimentalOption<T> {
  /** Discriminant tag for type-level identification */
  readonly _tag: "Some" | "None";

  readonly #val: T;

  private constructor(val: T, tag: "Some" | "None") {
    this.#val = val;
    this._tag = tag;
  }

  /**
   * Singleton `None` instance representing absence of a value.
   *
   * This is a shared instance - all `None` values reference the same object.
   *
   * @example
   * ```ts
   * const none1 = ExperimentalOption.None;
   * const none2 = ExperimentalOption.None;
   * none1 === none2 // true
   * ```
   */
  static readonly None: ExperimentalOption<never> = new ExperimentalOption(
    NONE_VAL as never,
    "None",
  );

  /**
   * Creates a `Some` variant containing the provided value.
   *
   * @template Inner - The type of value to wrap
   * @param val - The value to wrap in a Some
   * @returns An `ExperimentalOption<Inner>` in the Some state
   *
   * @example
   * ```ts
   * const opt = ExperimentalOption.Some(42); // ExperimentalOption<number>
   * const str = ExperimentalOption.Some("hello"); // ExperimentalOption<string>
   * const obj = ExperimentalOption.Some({ id: 1 }); // ExperimentalOption<{ id: number }>
   * ```
   */
  static Some<Inner>(this: void, val: Inner): ExperimentalOption<Inner> {
    return new ExperimentalOption(val, "Some");
  }

  /**
   * Creates an `ExperimentalOption` from a nullable value, returning `None` for `null` or `undefined`.
   *
   * Unlike {@link fromFalsy}, this only treats `null` and `undefined` as absence.
   * Values like `0`, `""`, and `false` are considered valid and wrapped in `Some`.
   *
   * @template T - The input type which may include null/undefined
   * @param val - The value to convert to an ExperimentalOption
   * @returns `Some<NonNullable<T>>` if value is non-nullish, else `None`
   *
   * @example
   * ```ts
   * ExperimentalOption.fromNullable("hello") // Some("hello")
   * ExperimentalOption.fromNullable(null)    // None
   * ExperimentalOption.fromNullable(undefined) // None
   * ExperimentalOption.fromNullable(0)       // Some(0) - 0 is not nullish
   * ExperimentalOption.fromNullable("")      // Some("") - empty string is not nullish
   * ExperimentalOption.fromNullable(false)   // Some(false) - false is not nullish
   *
   * // With user input
   * function findUser(id: string): User | null {
   *   return database.getUser(id) ?? null;
   * }
   * const user = ExperimentalOption.fromNullable(findUser("123"));
   * // ExperimentalOption<User>
   * ```
   */
  static fromNullable<T>(val: T): ExperimentalOption<NonNullable<T>> {
    return val === null || val === undefined
      ? ExperimentalOption.None
      : ExperimentalOption.Some(val as NonNullable<T>);
  }

  /**
   * Creates an `ExperimentalOption` from a value that may be falsy, returning `None` for falsy values.
   *
   * Treats `false`, `0`, `""`, `null`, and `undefined` as absence.
   * Use {@link fromNullable} if you only want to exclude `null`/`undefined`.
   *
   * @template T - The type of value to wrap
   * @param val - The value to convert to an ExperimentalOption
   * @returns `Some<T>` if value is truthy, else `None`
   *
   * @example
   * ```ts
   * ExperimentalOption.fromFalsy("hello")  // Some("hello")
   * ExperimentalOption.fromFalsy("")       // None
   * ExperimentalOption.fromFalsy(0)        // None
   * ExperimentalOption.fromFalsy(false)    // None
   * ExperimentalOption.fromFalsy(null)     // None
   * ExperimentalOption.fromFalsy(undefined) // None
   *
   * // Useful for validation
   * const isValid = ExperimentalOption.fromFalsy(getConfigValue("API_KEY"));
   * ```
   */
  static fromFalsy<T>(val: T | Falsy): ExperimentalOption<T> {
    return val ? ExperimentalOption.Some(val as T) : ExperimentalOption.None;
  }

  /**
   * Creates an `ExperimentalOption` based on a predicate function result.
   *
   * Returns `Some` if the predicate returns `true`, otherwise `None`.
   *
   * @template T - The type of value to test
   * @param val - The value to test
   * @param pred - A predicate function that returns true if value should be wrapped
   * @returns `Some<T>` if predicate returns true, else `None`
   *
   * @example
   * ```ts
   * const age = 25;
   * ExperimentalOption.fromPredicate(age, a => a >= 18) // Some(25)
   * ExperimentalOption.fromPredicate(15, a => a >= 18)  // None
   *
   * // Can be used for validation
   * const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   * ExperimentalOption.fromPredicate(user.email, isValidEmail)
   *
   * // With complex predicates
   * const isValidPassword = (pw: string) =>
   *   pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
   * ExperimentalOption.fromPredicate(password, isValidPassword)
   * ```
   */
  static fromPredicate<T>(val: T, pred: Predicate<T>): ExperimentalOption<T> {
    return pred(val) ? ExperimentalOption.Some(val) : ExperimentalOption.None;
  }

  /**
   * Combines multiple ExperimentalOptions into a single ExperimentalOption of an array.
   *
   * Returns `Some` containing an array of all unwrapped values if ALL inputs are `Some`.
   * Returns `None` if ANY input is `None`.
   *
   * @template T - Variadic tuple of ExperimentalOption types
   * @param options - Variable number of ExperimentalOptions to combine
   * @returns `ExperimentalOption<[T1, T2, ...]>` with array of values, or `None`
   *
   * @example
   * ```ts
   * // All Some -> array of values
   * const all = ExperimentalOption.all(
   *   ExperimentalOption.Some(1),
   *   ExperimentalOption.Some(2),
   *   ExperimentalOption.Some(3)
   * );
   * // Some([1, 2, 3])
   *
   * // Any None -> None
   * const withNone = ExperimentalOption.all(
   *   ExperimentalOption.Some(1),
   *   ExperimentalOption.None,
   *   ExperimentalOption.Some(3)
   * );
   * // None
   *
   * // Empty -> Some([])
   * const empty = ExperimentalOption.all();
   * // Some([])
   *
   * // Practical example: combine multiple validations
   * const name = ExperimentalOption.fromNullable(user.name);
   * const email = ExperimentalOption.fromNullable(user.email);
   * const age = ExperimentalOption.fromNullable(user.age);
   *
   * const complete = ExperimentalOption.all(name, email, age);
   * // ExperimentalOption<[string, string, number]>
   * ```
   */
  static all<T extends ExperimentalOption<unknown>[]>(
    ...options: T
  ): ExperimentalOption<CombinedOptions<T>> {
    const vals = [] as CombinedOptions<T>;

    for (const opt of options) {
      if (opt.isNone()) return ExperimentalOption.None;
      vals.push(opt.#val);
    }

    return ExperimentalOption.Some(vals);
  }

  /**
   * Returns the first `Some` from a list of ExperimentalOptions, or `None` if all are `None`.
   *
   * Short-circuits on the first `Some` found, evaluating subsequent options lazily.
   *
   * @template T - The type of values in the ExperimentalOptions
   * @param options - Variable number of ExperimentalOptions to check
   * @returns The first `Some<T>` found, or `None`
   *
   * @example
   * ```ts
   * // Returns first Some
   * const first = ExperimentalOption.any(
   *   ExperimentalOption.None,
   *   ExperimentalOption.Some("First value"),
   *   ExperimentalOption.Some("Second value")
   * );
   * // Some("First value")
   *
   * // All None -> None
   * const allNone = ExperimentalOption.any(
   *   ExperimentalOption.None,
   *   ExperimentalOption.None,
   *   ExperimentalOption.None
   * );
   * // None
   *
   * // Practical: Try multiple fallback sources
   * const config = ExperimentalOption.any(
   *   ExperimentalOption.fromNullable(process.env.API_KEY),
   *   ExperimentalOption.fromNullable(getEnvVar("API_KEY")),
   *   ExperimentalOption.fromNullable(readConfigFile("API_KEY"))
   * );
   *
   * // Empty -> None
   * const empty = ExperimentalOption.any();
   * // None
   * ```
   */
  static any<T>(...options: ExperimentalOption<T>[]): ExperimentalOption<T> {
    for (const opt of options) {
      if (opt.isSome()) return opt;
    }
    return ExperimentalOption.None;
  }

  /**
   * Generator-based syntax for chaining ExperimentalOption operations (simplified, no adapter).
   *
   * Provides imperative-style code while maintaining functional ExperimentalOption handling.
   * Use `yield*` to unwrap ExperimentalOptions or short-circuit on `None`.
   *
   * Short-circuits on first `None`, returning singleton `None`. Uses iteration
   * instead of recursion to avoid stack overflow on deep chains.
   *
   * @template T - The return type of the generator
   * @param genFn - A generator function that yields ExperimentalOptions
   * @returns `Some<T>` with the generator's return value, or `None`
   *
   * @example
   * ```ts
   * // Simple sync chain
   * const result = ExperimentalOption.gen(function* () {
   *   const a = yield* ExperimentalOption.Some(1);
   *   const b = yield* ExperimentalOption.Some(2);
   *   return a + b;
   * });
   * // Some(3)
   *
   * // None short-circuit
   * const shortCircuit = ExperimentalOption.gen(function* () {
   *   const a = yield* ExperimentalOption.Some(1);
   *   const b = yield* ExperimentalOption.None;    // Short-circuits here
   *   const c = yield* ExperimentalOption.Some(3); // Never executes
   *   return a + b + c;
   * });
   * // None
   *
   * // Chaining optional operations
   * const email = ExperimentalOption.gen(function* () {
   *   const user = yield* findUser(userId);
   *   const profile = yield* ExperimentalOption.fromNullable(user.profile);
   *   const settings = yield* ExperimentalOption.fromNullable(profile.settings);
   *   return settings.email;
   * });
   *
   * // Nested optional access
   * const city = ExperimentalOption.gen(function* () {
   *   const user = yield* ExperimentalOption.fromNullable(getUser());
   *   const address = yield* ExperimentalOption.fromNullable(user?.address);
   *   const city = yield* ExperimentalOption.fromNullable(address?.city);
   *   return city;
   * });
   * ```
   *
   * @see {@link genAdapter} for better type inference in complex chains
   * @see {@link asyncGen} for async operations
   */
  static gen<T>(
    genFn: () => Generator<ExperimentalOption<unknown>, T, unknown>,
  ): ExperimentalOption<T> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: ExperimentalOption<T>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = ExperimentalOption.Some(next.value);
        break;
      }

      // next.value is the ExperimentalOption that was yielded
      let yielded = next.value as ExperimentalOption<unknown>;

      if (isCapturedTrace(yielded)) {
        yielded = yielded.value as ExperimentalOption<unknown>;
      }

      if (yielded.isNone()) {
        // Early termination on None - return singleton None
        currentResult = ExperimentalOption.None;
        break;
      }

      // Unwrap the Some value and pass it back to the generator
      nextArg = yielded.unwrap();
    }

    return currentResult;
  }

  /**
   * Generator-based syntax for chaining ExperimentalOption operations with an adapter function.
   *
   * Provides better type inference and IDE support compared to {@link gen}.
   * The `$` adapter wraps ExperimentalOptions and enables clearer type tracking.
   *
   * Short-circuits on first `None`, returning singleton `None`. Uses iteration
   * instead of recursion to avoid stack overflow on deep chains.
   *
   * @template Eff - The effect type (inferred from usage)
   * @template T - The return type of the generator
   * @param genFn - A generator function receiving an adapter `$`
   * @returns `Some<T>` with the generator's return value, or `None`
   *
   * @example
   * ```ts
   * // Better type inference
   * const result = ExperimentalOption.genAdapter(function* ($) {
   *   const a = yield* $(ExperimentalOption.Some(1));
   *   const b = yield* $(ExperimentalOption.Some(2));
   *   return a + b;
   * });
   * // Some(3)
   *
   * // Deep nested access with better type safety
   * const email = ExperimentalOption.genAdapter(function* ($) {
   *   const user = yield* $(ExperimentalOption.fromNullable(apiResponse?.user));
   *   const profile = yield* $(ExperimentalOption.fromNullable(user?.profile));
   *   const contact = yield* $(ExperimentalOption.fromNullable(profile?.contact));
   *   return contact?.email;
   * });
   *
   * // Complex validation chain
   * const validConfig = ExperimentalOption.genAdapter(function* ($) {
   *   const raw = yield* $(loadConfig());
   *   const parsed = yield* $(parseConfig(raw));
   *   const validated = yield* $(validateConfig(parsed));
   *   return validated;
   * });
   * ```
   *
   * @see {@link gen} for simpler chains without adapter
   * @see {@link asyncGenAdapter} for async operations
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static genAdapter<Eff extends OptionYieldWrap<any>, T>(
    genFn: (
      adapter: <A>(option: ExperimentalOption<A>) => OptionYieldWrap<A>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => Generator<Eff, T, any>,
  ): ExperimentalOption<T> {
    const adapter = <A>(option: ExperimentalOption<A>): OptionYieldWrap<A> =>
      new OptionYieldWrap(option);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: ExperimentalOption<T>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = ExperimentalOption.Some(next.value);
        break;
      }

      // next.value is the OptionYieldWrap that was yielded
      const wrapped = next.value as OptionYieldWrap<unknown>;
      let option = wrapped.option;

      if (isCapturedTrace(option)) {
        option = (
          option as unknown as CapturedTrace<ExperimentalOption<unknown>>
        ).value as ExperimentalOption<unknown>;
      }

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = ExperimentalOption.None;
        break;
      }

      // Unwrap the Some value and pass it back to the generator
      nextArg = option.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining ExperimentalOption operations (simplified, no adapter).
   *
   * Use `yield*` with `ExperimentalOption<T>` values directly. For `Promise<ExperimentalOption<T>>`,
   * await first then `yield*`.
   *
   * Short-circuits on first `None`, returning singleton `None`. Uses async iteration
   * instead of recursion to avoid stack overflow on deep chains.
   *
   * @template T - The return type of the generator
   * @param genFn - An async generator function that yields ExperimentalOptions
   * @returns `Promise<Some<T>>` with the generator's return value, or `Promise<None>`
   *
   * @example
   * ```ts
   * // Simple async chain
   * const result = await ExperimentalOption.asyncGen(async function* () {
   *   const a = yield* ExperimentalOption.Some(1);
   *   const b = yield* await asyncOperation(a);  // await Promise<ExperimentalOption> first
   *   const c = yield* ExperimentalOption.Some(3);
   *   return a + b + c;
   * });
   * // Some(result)
   *
   * // None short-circuit in async
   * const shortCircuit = await ExperimentalOption.asyncGen(async function* () {
   *   const data = yield* await fetchOptionalData();
   *   const parsed = yield* parse(data);         // Short-circuits on None
   *   const validated = yield* validate(parsed); // Never executes
   *   return validated;
   * });
   * // None
   *
   * // Mixed sync/async workflow
   * const result = await ExperimentalOption.asyncGen(async function* () {
   *   const id = yield* ExperimentalOption.Some(parseInt(input)); // sync
   *   const user = yield* await fetchUser(id);        // async
   *   const profile = yield* ExperimentalOption.fromNullable(user?.profile); // sync
   *   const enriched = yield* await enrichProfile(profile); // async
   *   return enriched;
   * });
   *
   * // Complex pipeline with multiple optional steps
   * async function processLead(email: string): Promise<ExperimentalOption<Lead>> {
   *   return await ExperimentalOption.asyncGen(async function* () {
   *     const normalized = yield* Some(normalizeEmail(email));
   *     const existing = yield* await findExistingLead(normalized);
   *     const enriched = yield* await enrichLeadData(existing);
   *     const validated = yield* validateLead(enriched);
   *     return validated;
   *   });
   * }
   * ```
   *
   * @see {@link asyncGenAdapter} for better type inference and cleaner syntax
   * @see {@link gen} for synchronous operations
   */
  static async asyncGen<T>(
    genFn: () => AsyncGenerator<ExperimentalOption<unknown>, T, unknown>,
  ): Promise<ExperimentalOption<T>> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: ExperimentalOption<T>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = ExperimentalOption.Some(next.value);
        break;
      }

      // next.value is an ExperimentalOption (user awaits promises before yielding)
      let option = next.value as ExperimentalOption<unknown>;

      if (isCapturedTrace(option)) {
        option = option.value as ExperimentalOption<unknown>;
      }

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = ExperimentalOption.None;
        break;
      }

      // Unwrap the Some value
      nextArg = await option.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining ExperimentalOption operations with an adapter function.
   *
   * The `$` adapter handles both sync `ExperimentalOption<T>` and async `Promise<ExperimentalOption<T>>`,
   * automatically awaiting promises. This provides cleaner syntax for mixed sync/async workflows.
   *
   * Short-circuits on first `None`, returning singleton `None`. Uses async iteration
   * instead of recursion to avoid stack overflow on deep chains.
   *
   * @template Eff - The effect type (inferred from usage)
   * @template T - The return type of the generator
   * @param genFn - An async generator function receiving an adapter `$`
   * @returns `Promise<Some<T>>` with the generator's return value, or `Promise<None>`
   *
   * @example
   * ```ts
   * // No need to manually await - adapter handles it
   * const result = await ExperimentalOption.asyncGenAdapter(async function* ($) {
   *   const a = yield* $(ExperimentalOption.Some(1));       // sync ExperimentalOption
   *   const b = yield* $(asyncOperation(a));    // Promise<ExperimentalOption> - auto-awaited
   *   const c = yield* $(ExperimentalOption.Some(3));
   *   return a + b + c;
   * });
   *
   * // Complex workflow with database and API calls
   * const userData = await ExperimentalOption.asyncGenAdapter(async function* ($) {
   *   const session = yield* $(getSession());       // Promise<ExperimentalOption<Session>>
   *   const userId = yield* $(ExperimentalOption.fromNullable(session?.userId));
   *   const profile = yield* $(await fetchProfile(userId)); // Promise<ExperimentalOption<Profile>>
   *   const preferences = yield* $(ExperimentalOption.fromNullable(profile?.preferences));
   *   const enriched = yield* $(await enrichPreferences(preferences));
   *   return enriched;
   * });
   *
   * // Real-world: Optional data enrichment
   * async function getProductDetails(productId: string): Promise<ExperimentalOption<ProductDetails>> {
   *   return await ExperimentalOption.asyncGenAdapter(async function* ($) {
   *     const product = yield* $(await fetchProduct(productId));
   *     const pricing = yield* $(await fetchPricing(product.sku));
   *     const inventory = yield* $(await checkInventory(product.id));
   *     const reviews = yield* $(await fetchReviews(product.id));
   *     const related = yield* $(await fetchRelatedProducts(product.category));
   *
   *     return { product, pricing, inventory, reviews, related };
   *   });
   * }
   * ```
   *
   * @see {@link asyncGen} when you want explicit `await` for async operations
   * @see {@link genAdapter} for synchronous operations
   */
  // biome-ignore lint/suspicious/noExplicitAny: inference
  static async asyncGenAdapter<Eff extends AsyncOptionYieldWrap<any>, T>(
    genFn: (
      adapter: <A>(
        option: ExperimentalOption<A> | Promise<ExperimentalOption<A>>,
      ) => AsyncOptionYieldWrap<A>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => AsyncGenerator<Eff, T, any>,
  ): Promise<ExperimentalOption<T>> {
    const adapter = <A>(
      option: ExperimentalOption<A> | Promise<ExperimentalOption<A>>,
    ): AsyncOptionYieldWrap<A> => new AsyncOptionYieldWrap(option);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: ExperimentalOption<T>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = ExperimentalOption.Some(next.value);
        break;
      }

      // next.value is the AsyncOptionYieldWrap that was yielded
      const wrapped = next.value as AsyncOptionYieldWrap<unknown>;
      let option = await wrapped.option;

      if (isCapturedTrace(option)) {
        option = (
          option as unknown as CapturedTrace<ExperimentalOption<unknown>>
        ).value as ExperimentalOption<unknown>;
      }

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = ExperimentalOption.None;
        break;
      }

      // Unwrap the Some value
      nextArg = await option.unwrap();
    }

    return currentResult;
  }

  /**
   * Type guard that narrows the type to `Some`.
   *
   * Returns `true` if this ExperimentalOption is in the `Some` state, containing a value.
   *
   * @returns `true` if this is a `Some`, `false` if `None`
   *
   * @example
   * ```ts
   * const opt: ExperimentalOption<number> = ExperimentalOption.Some(42);
   *
   * if (opt.isSome()) {
   *   // TypeScript knows opt is ExperimentalOption<number> & { _tag: "Some" }
   *   console.log(opt.unwrap()); // 42
   * }
   * ```
   */
  isSome(): this is ExperimentalOption<T> & { readonly _tag: "Some" } {
    return this._tag === "Some" && this.#val !== NONE_VAL;
  }

  /**
   * Type guard that narrows the type to `None`.
   *
   * Returns `true` if this ExperimentalOption is in the `None` state (absence of value).
   *
   * @returns `true` if this is `None`, `false` if `Some`
   *
   * @example
   * ```ts
   * const opt: ExperimentalOption<number> = ExperimentalOption.None;
   *
   * if (opt.isNone()) {
   *   // TypeScript knows opt is ExperimentalOption<never> & { _tag: "None" }
   *   console.log("No value present");
   * }
   * ```
   */
  isNone(): this is ExperimentalOption<never> & { readonly _tag: "None" } {
    return this._tag === "None" || this.#val === NONE_VAL;
  }

  /**
   * Type guard that checks if the contained value is the `Unit` type.
   *
   * Returns `true` if this ExperimentalOption contains the special `UNIT` value,
   * used to represent operations that produce no meaningful output.
   *
   * @returns `true` if this contains `UNIT`, `false` otherwise
   *
   * @example
   * ```ts
   * const unitOpt: ExperimentalOption<UNIT> = ExperimentalOption.Some(UNIT);
   * unitOpt.isUnit(); // true
   *
   * const normalOpt: ExperimentalOption<number> = ExperimentalOption.Some(42);
   * normalOpt.isUnit(); // false
   * ```
   */
  isUnit(): this is ExperimentalOption<UNIT> {
    return this.#val === UNIT;
  }

  /**
   * Returns the contained value or throws {@link UnwrappedNone} if `None`.
   *
   * This is an unsafe operation that throws on `None`. Use only when you are
   * certain the ExperimentalOption contains a value, or use safe alternatives like
   * {@link unwrapOr} or {@link safeUnwrap}.
   *
   * @throws {@link UnwrappedNone} if this is `None`
   * @returns The contained value
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(42).unwrap(); // 42
   * ExperimentalOption.None.unwrap();    // throws UnwrappedNone
   *
   * // Safe usage pattern
   * const opt = ExperimentalOption.Some(42);
   * if (opt.isSome()) {
   *   const value = opt.unwrap(); // Safe: we checked isSome()
   * }
   * ```
   *
   * @see {@link unwrapOr} for safe unwrapping with a default value
   * @see {@link unwrapOrElse} for lazy default computation
   * @see {@link safeUnwrap} for null-returning safe unwrap
   */
  unwrap(): T {
    if (this.isNone()) {
      throw UNWRAPPED_NONE_ERR;
    }
    return this.#val;
  }

  /**
   * Returns the contained value, or the provided default value if `None`.
   *
   * A safe alternative to {@link unwrap} that doesn't throw.
   *
   * @param defaultValue - The value to return if this is `None`
   * @returns The contained value, or the default
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(42).unwrapOr(0); // 42
   * ExperimentalOption.None.unwrapOr(0);    // 0
   *
   * // With user input
   * const age = ExperimentalOption.fromNullable(user.age).unwrapOr(18);
   *
   * // With complex defaults
   * const config = ExperimentalOption.fromNullable(getConfig())
   *   .unwrapOr({ port: 3000, host: "localhost" });
   * ```
   *
   * @see {@link unwrapOrElse} for lazy default computation
   * @see {@link safeUnwrap} for null-returning safe unwrap
   */
  unwrapOr(defaultValue: T): T {
    if (this.isNone()) return defaultValue;
    return this.#val;
  }

  /**
   * Returns the contained value, or computes a default via a function if `None`.
   *
   * Unlike {@link unwrapOr}, the default is computed lazily - only if this is `None`.
   * Use this when the default value is expensive to compute.
   *
   * @param fn - A factory function that produces the default value
   * @returns The contained value, or the computed default
   *
   * @example
   * ```ts
   * // Lazy default - only computed if needed
   * const value = ExperimentalOption.None.unwrapOrElse(() => {
   *   console.log("Computing expensive default...");
   *   return expensivelyComputeDefault();
   * });
   * // Prints "Computing expensive default..."
   *
   * // Not computed when Some
   * const some = ExperimentalOption.Some(42).unwrapOrElse(() => {
   *   console.log("This won't print");
   *   return expensivelyComputeDefault();
   * });
   * // Returns 42 without printing
   *
   * // Practical: cache lookup with fallback
   * const cached = ExperimentalOption.fromNullable(cache.get(key))
   *   .unwrapOrElse(() => {
   *     const value = fetchFromDatabase(key);
   *     cache.set(key, value);
   *     return value;
   *   });
   * ```
   *
   * @see {@link unwrapOr} for simple default values
   * @see {@link unwrap} for unsafe unwrapping
   */
  unwrapOrElse(fn: () => T): T {
    if (this.isNone()) return fn();
    return this.#val;
  }

  /**
   * Returns the contained value, or `null` if `None`.
   *
   * Provides a safe way to extract values that integrates with TypeScript's
   * null checking while maintaining the ExperimentalOption semantics.
   *
   * @returns The contained value, or `null`
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(42).safeUnwrap(); // 42
   * ExperimentalOption.None.safeUnwrap();    // null
   *
   * // Integration with existing null-handling code
   * const value = ExperimentalOption.fromNullable(user.name).safeUnwrap();
   * if (value !== null) {
   *   console.log(value.toUpperCase());
   * }
   *
   * // With nullish coalescing
   * const displayName = ExperimentalOption.fromNullable(user.displayName)
   *   .safeUnwrap() ?? user.email;
   * ```
   *
   * @see {@link unwrapOr} for typed defaults
   * @see {@link unwrapOrElse} for lazy defaults
   */
  safeUnwrap(): T | null {
    if (this.isNone()) return null;
    return this.#val;
  }

  /**
   * Pattern matches on both states of the ExperimentalOption, providing exhaustive handling.
   *
   * This is the most explicit way to handle ExperimentalOptions, ensuring both `Some` and `None`
   * cases are handled at compile time.
   *
   * @template U - The result type of both branches
   * @param cases - Object containing handlers for both states
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * const result = ExperimentalOption.Some(42).match({
   *   Some: (value) => `Got: ${value}`,
   *   None: () => "Got nothing"
   * });
   * // "Got: 42"
   *
   * const noneResult = ExperimentalOption.None.match({
   *   Some: (value) => `Got: ${value}`,
   *   None: () => "Got nothing"
   * });
   * // "Got nothing"
   *
   * // Practical: user lookup
   * const message = findUser(userId).match({
   *   Some: (user) => `Welcome, ${user.name}!`,
   *   None: () => "User not found"
   * });
   * ```
   *
   * @see {@link isSome} and {@link isNone} for conditional handling
   */
  match<U>(cases: MatchCases<T, U>): U {
    if (this.isNone()) {
      return cases.None();
    }
    return cases.Some(this.#val);
  }

  /**
   * Pattern matches using positional arguments (FP convention alias for `match`).
   *
   * This is a more concise alternative to `match` using positional arguments
   * instead of an object. Familiar to developers from Scala, Haskell, and other FP languages.
   *
   * @template U - The result type of both branches
   * @param onSome - Handler called with the value if `Some`
   * @param onNone - Handler called if `None`
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * const result = ExperimentalOption.Some(42).fold(
   *   (value) => `Got: ${value}`,
   *   () => "Got nothing"
   * );
   * // "Got: 42"
   *
   * const noneResult = ExperimentalOption.None.fold(
   *   (value) => `Got: ${value}`,
   *   () => "Got nothing"
   * );
   * // "Got nothing"
   *
   * // Equivalent to match:
   * experimentalOption.fold(onSome, onNone);
   * experimentalOption.match({ Some: onSome, None: onNone });
   * ```
   *
   * @see {@link match} for object-based pattern matching
   * @see {@link foldAsync} for async handlers
   */
  fold<U>(onSome: (val: T) => U, onNone: () => U): U {
    if (this.isNone()) {
      return onNone();
    }
    return onSome(this.#val);
  }

  /**
   * Async pattern matching using positional arguments.
   *
   * Async variant of `fold` for when handlers return Promises.
   *
   * @template U - The result type of both branches
   * @param onSome - Async handler called with the value if `Some`
   * @param onNone - Async handler called if `None`
   * @returns Promise resolving to the result of the appropriate handler
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.Some(userId).foldAsync(
   *   async (id) => await fetchUser(id),
   *   async () => await getDefaultUser()
   * );
   *
   * // With database lookup
   * const user = await ExperimentalOption.fromNullable(sessionUserId).foldAsync(
   *   async (id) => await db.users.findById(id),
   *   async () => ({ id: 0, name: "Guest" })
   * );
   * ```
   *
   * @see {@link fold} for synchronous handlers
   * @see {@link matchAsync} for object-based async pattern matching
   */
  async foldAsync<U>(
    onSome: (val: T) => Promise<U>,
    onNone: () => Promise<U>,
  ): Promise<U> {
    if (this.isNone()) {
      return onNone();
    }

    return onSome(this.#val).catch((_) => onNone());
  }

  /**
   * Async pattern matching on both states of the ExperimentalOption.
   *
   * Async variant of `match` for when handlers return Promises.
   *
   * @template U - The result type of both branches
   * @param cases - Object containing async handlers for both states
   * @returns Promise resolving to the result of the appropriate handler
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.Some(userId).matchAsync({
   *   Some: async (id) => await fetchUser(id),
   *   None: async () => await getDefaultUser()
   * });
   *
   * // With API calls
   * const data = await maybeConfig.matchAsync({
   *   Some: async (config) => await loadWithConfig(config),
   *   None: async () => await loadDefaults()
   * });
   * ```
   *
   * @see {@link match} for synchronous pattern matching
   * @see {@link foldAsync} for positional-argument async matching
   */
  async matchAsync<U>(cases: {
    Some: (val: T) => Promise<U>;
    None: () => Promise<U>;
  }): Promise<U> {
    if (this.isNone()) {
      return cases.None();
    }
    return cases.Some(this.#val).catch((_) => cases.None());
  }

  /**
   * Pattern matches with a subset of cases, using a default for unhandled cases.
   *
   * Unlike `match` which requires all cases, `matchPartial` allows handling
   * only specific cases with a fallback default value or function.
   *
   * @template U - The result type
   * @param cases - Partial object with optional `Some` and `None` handlers
   * @param defaultValue - Value to return for unhandled cases
   * @returns The result of the matching handler or the default
   *
   * @example
   * ```ts
   * // Only handle Some, default for None
   * ExperimentalOption.Some(42).matchPartial({ Some: (v) => v * 2 }, 0);  // 84
   * ExperimentalOption.None.matchPartial({ Some: (v) => v * 2 }, 0);      // 0
   *
   * // Only handle None
   * ExperimentalOption.Some(42).matchPartial({ None: () => -1 }, 100);    // 100
   * ExperimentalOption.None.matchPartial({ None: () => -1 }, 100);        // -1
   *
   * // Lazy default with function
   * experimentalOption.matchPartial(
   *   { Some: (v) => process(v) },
   *   () => computeExpensiveDefault()
   * );
   * ```
   *
   * @see {@link match} for exhaustive pattern matching
   */

  matchPartial<U>(
    cases: {
      Some?: (val: T) => NoInfer<U>;
      None?: () => NoInfer<U>;
    },
    getDefault: () => U,
  ): U {
    if (this.isNone()) {
      return cases.None ? cases.None() : getDefault();
    }

    return cases.Some ? cases.Some(this.#val) : getDefault();
  }

  /**
   * Transforms the contained value using the provided function.
   *
   * If `Some`, applies the function and wraps the result in a new `Some`.
   * If `None`, returns `None` without calling the function.
   *
   * This method rejects async mappers at compile time - use {@link mapAsync} for those.
   *
   * @template U - The type of the transformed value
   * @param fn - A function that transforms the contained value
   * @returns `Some<U>` with the transformed value, or `None`
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(5).map(x => x * 2);     // Some(10)
   * ExperimentalOption.None.map(x => x * 2);        // None
   *
   * // Chaining transforms
   * ExperimentalOption.Some("hello")
   *   .map(s => s.toUpperCase())
   *   .map(s => `${s}!`)
   *   .map(s => s.length);
   * // Some(6)
   *
   * // Type transformation
   * ExperimentalOption.Some("123")
   *   .map(s => parseInt(s, 10));
   * // Some(123)
   * ```
   *
   * @see {@link mapAsync} for async transformations
   * @see {@link flatMap} for chaining operations that return ExperimentalOptions
   * @see {@link mapOr} for unwrapping with transformation
   */
  map<U>(fn: (val: T) => Promise<U>): never;
  map<U>(fn: (val: T) => U): ExperimentalOption<U>;
  map<U>(fn: (val: T) => U): ExperimentalOption<U> {
    if (this.isNone()) {
      return ExperimentalOption.None;
    }

    return ExperimentalOption.Some(fn(this.#val));
  }

  /**
   * Transforms the contained value using an async function.
   *
   * If `Some`, awaits the async function and wraps the result in a new `Some`.
   * If `None`, returns a resolved `None` Promise without calling the function.
   *
   * @template U - The type of the transformed value
   * @param fn - An async function that transforms the contained value
   * @returns `Promise<Some<U>>` with the transformed value, or `Promise<None>`
   *
   * @example
   * ```ts
   * // Simple async transform
   * const result = await ExperimentalOption.Some(5).mapAsync(async x => {
   *   return x * 2;
   * });
   * // Some(10)
   *
   * // Chaining with .then()
   * ExperimentalOption.Some(5)
   *   .map(x => x * 2)              // Some(10)
   *   .mapAsync(async x => {
   *     return await fetchData(x);  // Some<Data>
   *   })
   *   .then(o => o.map(d => d.name)); // Promise<Some<string>>
   *
   * // Practical: API call after validation
   * const userData = await ExperimentalOption.Some(userId)
   *   .mapAsync(async id => await fetchUser(id))
   *   .then(o => o.mapAsync(async user => await fetchProfile(user.id)));
   * // Promise<ExperimentalOption<Profile>>
   * ```
   *
   * @see {@link map} for synchronous transformations
   */
  async mapAsync<U>(
    fn: (val: T) => Promise<U>,
  ): Promise<ExperimentalOption<U>> {
    if (this.isNone()) {
      return Promise.resolve(ExperimentalOption.None);
    }

    return fn(this.#val).then((u) => ExperimentalOption.Some(u));
  }

  /**
   * Maps the value or returns a default value (unwrapped).
   *
   * Unlike {@link map}, this returns the value directly (not wrapped in ExperimentalOption).
   * If `Some`, applies the function and returns the result.
   * If `None`, returns the default value without calling the function.
   *
   * @template U - The type of the result
   * @param defaultValue - The value to return if `None`
   * @param fn - A function to apply if `Some`
   * @returns The mapped value or the default
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(5).mapOr(0, x => x * 2); // 10
   * ExperimentalOption.None.mapOr(0, x => x * 2);    // 0
   *
   * // Practical: formatting with fallback
   * const displayName = ExperimentalOption.fromNullable(user.name)
   *   .mapOr("Anonymous", name => name.toUpperCase());
   * // "JOHN" or "Anonymous"
   *
   * // With complex defaults
   * const balance = ExperimentalOption.fromNullable(account?.balance)
   *   .mapOr(0, b => b.toFixed(2));
   * ```
   *
   * @see {@link map} for wrapped results
   * @see {@link mapOrAsync} for async transformations
   */
  mapOr<U>(defaultValue: U, fn: (val: T) => U): U {
    if (this.isNone()) {
      return defaultValue;
    }

    return fn(this.#val);
  }

  /**
   * Maps the value using an async function or returns a default value.
   *
   * @template U - The type of the result
   * @param defaultValue - The value to return if `None`
   * @param fn - An async function to apply if `Some`
   * @returns `Promise<U>` with the mapped value or the default
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.Some(5).mapOrAsync(0, async x => {
   *   return x * 2;
   * });
   * // 10
   *
   * const noneResult = await ExperimentalOption.None.mapOrAsync(0, async x => {
   *   return x * 2;
   * });
   * // 0
   *
   * // Practical: async fetch with fallback
   * const balance = await ExperimentalOption.fromNullable(userId)
   *   .mapOrAsync(0, async id => await getAccountBalance(id));
   * ```
   *
   * @see {@link mapOr} for synchronous transformations
   */
  async mapOrAsync<U>(defaultValue: U, fn: (val: T) => Promise<U>): Promise<U> {
    if (this.isNone()) {
      return defaultValue;
    }

    return fn(this.#val);
  }

  /**
   * Chains operations that return ExperimentalOptions, flattening nested ExperimentalOptions.
   *
   * Also known as `bind` or `chain`. Use this to sequence operations where
   * each step depends on the previous value and may fail.
   *
   * If `Some`, applies the function and returns its result directly.
   * If `None`, returns `None` without calling the function.
   *
   * @template U - The type of the value in the returned ExperimentalOption
   * @param fn - A function that returns an ExperimentalOption
   * @returns The result of the function, or `None`
   *
   * @example
   * ```ts
   * // Basic chaining
   * ExperimentalOption.Some(5).flatMap(x => ExperimentalOption.Some(x + 1)); // Some(6)
   * ExperimentalOption.Some(5).flatMap(x => ExperimentalOption.None);        // None
   * ExperimentalOption.None.flatMap(x => ExperimentalOption.Some(x + 1));    // None
   *
   * // Chaining optional operations
   * const email = findUser(userId)
   *   .flatMap(user => ExperimentalOption.fromNullable(user.profile))
   *   .flatMap(profile => ExperimentalOption.fromNullable(profile.avatar))
   *   .flatMap(avatar => ExperimentalOption.fromNullable(avatar.url));
   *
   * // Practical: multi-step validation
   * const valid = ExperimentalOption.Some(input)
   *   .flatMap(s => parseEmail(s))
   *   .flatMap(email => checkDomain(email))
   *   .flatMap(domain => resolveDomain(domain));
   * ```
   *
   * @see {@link flatMapAsync} for async operations
   * @see {@link map} for simple transformations
   * @see {@link gen} for imperative-style chaining
   */
  flatMap<U>(fn: (val: T) => ExperimentalOption<U>): ExperimentalOption<U> {
    if (this.isNone()) {
      return ExperimentalOption.None;
    }

    return fn(this.#val);
  }

  /**
   * Chains async operations that return ExperimentalOptions.
   *
   * @template U - The type of the value in the returned ExperimentalOption
   * @param fn - An async function that returns an ExperimentalOption
   * @returns `Promise<ExperimentalOption<U>>` with the result, or `Promise<None>`
   *
   * @example
   * ```ts
   * // Async database lookup chain
   * const profile = await ExperimentalOption.Some(userId)
   *   .flatMapAsync(async id => await findUser(id))
   *   .flatMapAsync(async user => await getProfile(user.id))
   *   .flatMapAsync(async p => await getAvatar(p.avatarId));
   * // Promise<ExperimentalOption<Avatar>>
   *
   * // Practical: multi-step async pipeline
   * const result = await ExperimentalOption.Some(email)
   *   .flatMapAsync(validateEmail)
   *   .flatMapAsync(e => fetchUserByEmail(e))
   *   .flatMapAsync(u => getUserPermissions(u.id));
   * ```
   *
   * @see {@link flatMap} for synchronous operations
   * @see {@link asyncGen} for imperative-style async chaining
   */
  async flatMapAsync<U>(
    fn: (val: T) => Promise<ExperimentalOption<U>>,
  ): Promise<ExperimentalOption<U>> {
    if (this.isNone()) {
      return ExperimentalOption.None;
    }

    return fn(this.#val);
  }

  /**
   * Converts `Some` to `None` if the predicate returns `false`.
   *
   * If `Some`, tests the predicate and returns `Some` if true, `None` if false.
   * If `None`, returns `None` without calling the predicate.
   *
   * @param pred - A predicate function to test the contained value
   * @returns `Some<T>` if predicate passes, else `None`
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(5).filter(x => x > 3);   // Some(5)
   * ExperimentalOption.Some(5).filter(x => x > 10);  // None
   * ExperimentalOption.None.filter(x => x > 3);      // None
   *
   * // Age validation
   * const adult = ExperimentalOption.Some(age)
   *   .filter(a => a >= 18);
   *
   * // Multiple filters
   * const valid = ExperimentalOption.Some(password)
   *   .filter(pw => pw.length >= 8)
   *   .filter(pw => /[A-Z]/.test(pw))
   *   .filter(pw => /[0-9]/.test(pw));
   * ```
   *
   * @see {@link filterAsync} for async predicates
   * @see {@link fromPredicate} for creating ExperimentalOptions from predicates
   */
  filter(pred: (val: T) => boolean): ExperimentalOption<T> {
    if (this.isNone()) {
      return ExperimentalOption.None;
    }

    return pred(this.#val) ? this : ExperimentalOption.None;
  }

  /**
   * Converts `Some` to `None` if the async predicate returns `false`.
   *
   * @param pred - An async predicate function to test the contained value
   * @returns `Promise<Some<T>>` if predicate passes, else `Promise<None>`
   *
   * @example
   * ```ts
   * // Async validation
   * const valid = await ExperimentalOption.Some(email)
   *   .filterAsync(async e => await checkEmailDomain(e));
   *
   * // Practical: database validation
   * const unique = await ExperimentalOption.Some(username)
   *   .filterAsync(async u => await isUsernameAvailable(u));
   * ```
   *
   * @see {@link filter} for synchronous predicates
   */
  async filterAsync(
    pred: (val: T) => Promise<boolean>,
  ): Promise<ExperimentalOption<T>> {
    if (this.isNone()) {
      return Promise.resolve(ExperimentalOption.None);
    }

    return pred(this.#val).then((passed) =>
      passed ? this : ExperimentalOption.None,
    );
  }

  /**
   * Pairs the original value with a derived value.
   *
   * Creates a tuple `[original, derived]` where the second value is computed
   * from the first using the provided function.
   *
   * This method rejects async mappers at compile time - use {@link zipAsync} for those.
   *
   * @template U - The type of the derived value
   * @param fn - A function that derives a value from the contained value
   * @returns `Some<[T, U]>` with the tuple, or `None`
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(5).zip(x => x * 2);       // Some([5, 10])
   * ExperimentalOption.None.zip(x => x * 2);          // None
   *
   * // Keep original while computing derived value
   * ExperimentalOption.Some(user).zip(u => u.permissions.length);
   * // Some([user, 5])
   *
   * // Practical: price with discount
   * const priceWithDiscount = ExperimentalOption.Some(100)
   *   .zip(price => price * 0.9);
   * // Some([100, 90])
   *
   * // Derive metadata while keeping original
   * ExperimentalOption.Some(request).zip(req => ({
   *   size: JSON.stringify(req).length,
   *   timestamp: Date.now()
   * }));
   * // Some([request, { size, timestamp }])
   * ```
   *
   * @see {@link zipAsync} for async derivation
   * @see {@link flatZip} for combining with another ExperimentalOption
   */
  zip<U>(fn: (val: T) => Promise<U>): never;
  zip<U>(fn: (val: T) => U): ExperimentalOption<[prev: T, curr: U]>;
  zip<U>(fn: (val: T) => U): ExperimentalOption<[T, U]> {
    if (this.isNone()) {
      return ExperimentalOption.None;
    }

    return ExperimentalOption.Some([this.#val, fn(this.#val)]);
  }

  /**
   * Pairs the original value with an async derived value.
   *
   * @template U - The type of the derived value
   * @param fn - An async function that derives a value from the contained value
   * @returns `Promise<Some<[T, U]>>` with the tuple, or `Promise<None>`
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.Some(user)
   *   .zipAsync(async u => await fetchCount(u));
   * // Some([user, number])
   *
   * // Practical: user with additional data
   * const enriched = await ExperimentalOption.Some(userId)
   *   .zipAsync(async id => await fetchUser(id))
   *   .then(o => o.zipAsync(async ([id, user]) => await getStats(user.id)));
   * // Promise<ExperimentalOption<[userId, User, Stats]>>
   * ```
   *
   * @see {@link zip} for synchronous derivation
   */
  async zipAsync<U>(
    fn: (val: T) => Promise<U>,
  ): Promise<ExperimentalOption<[T, U]>> {
    if (this.isNone()) {
      return Promise.resolve(ExperimentalOption.None);
    }

    return fn(this.#val).then((u) => ExperimentalOption.Some([this.#val, u]));
  }

  /**
   * Pairs the original value with a value from another ExperimentalOption.
   *
   * Combines two independent ExperimentalOptions into a tuple. Both must be `Some` to succeed.
   *
   * @template U - The type of the value in the other ExperimentalOption
   * @param fn - A function that returns an ExperimentalOption to combine with
   * @returns `Some<[T, U]>` with both values, or `None`
   *
   * @example
   * ```ts
   * // Basic usage
   * ExperimentalOption.Some(5).flatZip(x => ExperimentalOption.Some(10));  // Some([5, 10])
   * ExperimentalOption.Some(5).flatZip(x => ExperimentalOption.None);     // None
   * ExperimentalOption.None.flatZip(x => ExperimentalOption.Some(10));    // None
   *
   * // Practical: combine independent lookups
   * const productData = ExperimentalOption.Some(productId)
   *   .flatZip(id => fetchProductPrice(id));
   * // ExperimentalOption<[productId, price]>
   *
   * // Multiple dependencies
   * const complete = ExperimentalOption.Some(userId)
   *   .flatZip(id => fetchUser(id))
   *   .flatMap(([id, user]) => ExperimentalOption.Some([id, user.profileId]))
   *   .flatZip(([id, profileId]) => fetchProfile(profileId));
   * // ExperimentalOption<[userId, profileId, profile]>
   * ```
   *
   * @see {@link flatZipAsync} for async ExperimentalOptions
   * @see {@link zip} for derived values
   * @see {@link all} for combining multiple ExperimentalOptions at once
   */
  flatZip<U>(
    fn: (val: T) => ExperimentalOption<U>,
  ): ExperimentalOption<[T, U]> {
    if (this.isNone()) {
      return ExperimentalOption.None;
    }

    const other = fn(this.#val);
    if (other.isNone()) {
      return ExperimentalOption.None;
    }

    return ExperimentalOption.Some([this.#val, other.unwrap()]);
  }

  /**
   * Pairs the original value with a value from an async ExperimentalOption.
   *
   * @template U - The type of the value in the other ExperimentalOption
   * @param fn - An async function that returns an ExperimentalOption
   * @returns `Promise<Some<[T, U]>>` with both values, or `Promise<None>`
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.Some(userId)
   *   .flatZipAsync(async id => await fetchUser(id));
   * // ExperimentalOption<[userId, User]>
   *
   * // Practical: async pipeline
   * const enriched = await ExperimentalOption.Some(userId)
   *   .flatZipAsync(async id => await fetchUser(id))
   *   .then(o => o.flatMapAsync(async ([id, user]) =>
   *     ExperimentalOption.Some([id, user, await fetchProfile(user.profileId)])
   *   ));
   * ```
   *
   * @see {@link flatZip} for synchronous ExperimentalOptions
   */
  async flatZipAsync<U>(
    fn: (val: T) => Promise<ExperimentalOption<U>>,
  ): Promise<ExperimentalOption<[T, U]>> {
    if (this.isNone()) {
      return Promise.resolve(ExperimentalOption.None);
    }

    return fn(this.#val).then((other) => {
      if (other.isNone()) {
        return ExperimentalOption.None;
      }
      return ExperimentalOption.Some([this.#val, other.unwrap()]);
    });
  }

  /**
   * Executes a side effect function if `Some`, returning `this` unchanged.
   *
   * Useful for logging, debugging, or executing effects without breaking the chain.
   *
   * @param fn - A side effect function to execute with the contained value
   * @returns `this` (unchanged, for chaining)
   *
   * @example
   * ```ts
   * // Logging without breaking chain
   * ExperimentalOption.Some(user)
   *   .tap(u => console.log(`Processing ${u.name}`))
   *   .map(u => u.email);
   *
   * // Debugging
   * ExperimentalOption.Some(input)
   *   .tap(val => console.log("Before:", val))
   *   .map(transform)
   *   .tap(val => console.log("After:", val));
   *
   * // Practical: audit trail
   * const result = ExperimentalOption.Some(transaction)
   *   .tap(t => auditLog("start", t.id))
   *   .flatMap(t => process(t))
   *   .tap(r => auditLog("success", r.id))
   *   .tapErr(e => auditLog("error", e.message));
   * ```
   *
   * @see {@link tapAsync} for async side effects
   */
  tap(fn: (val: T) => void): ExperimentalOption<T> {
    if (this.isSome()) {
      fn(this.#val);
    }
    return this;
  }

  /**
   * Executes an async side effect function if `Some`, returning `this` unchanged.
   *
   * @param fn - An async side effect function to execute
   * @returns `Promise<ExperimentalOption<T>>` that resolves to `this`
   *
   * @example
   * ```ts
   * // Async logging
   * await ExperimentalOption.Some(user)
   *   .tapAsync(async u => await logAnalytics(u.id))
   *   .map(u => u.email);
   *
   * // Practical: metrics collection
   * const result = await ExperimentalOption.Some(request)
   *   .tapAsync(async req => await trackMetric("request_start", req.id))
   *   .flatMapAsync(async req => await processRequest(req))
   *   .tapAsync(async res => await trackMetric("request_success", res.id));
   * ```
   *
   * @see {@link tap} for synchronous side effects
   */
  async tapAsync(
    fn: (val: T) => Promise<void>,
  ): Promise<ExperimentalOption<T>> {
    if (this.isSome()) {
      return fn(this.#val).then(() => this);
    }
    return Promise.resolve(this);
  }

  /**
   * Converts this ExperimentalOption to a Result.
   *
   * `Some` becomes `Ok`, `None` becomes `Err` with the provided error.
   *
   * @template E - The type of the error for the `Err` variant
   * @param error - The error value to use if this is `None`
   * @returns `Result<T, E>` with the value or error
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(42).toResult("was none");    // Ok(42)
   * ExperimentalOption.None.toResult("was none");        // Err("was none")
   *
   * // Practical: convert to Result for error handling
   * const user = ExperimentalOption.fromNullable(getUser())
   *   .toResult(new Error("User not found"));
   *
   * // With custom error types
   * const config = ExperimentalOption.fromNullable(loadConfig())
   *   .toResult({ code: "CONFIG_MISSING", message: "Config file not found" });
   * ```
   *
   * @see {@link ExperimentalResult} for the Result type
   */
  toResult<E>(error: E): ExperimentalResult<T, E> {
    if (this.isNone()) {
      return ExperimentalResult.Err(error);
    }
    return ExperimentalResult.Ok(this.#val);
  }

  /**
   * Maps over array elements inside an `ExperimentalOption<Array<T>>`.
   *
   * Only callable when `T` is an array type. Applies the mapper to each
   * element if `Some`, or returns `None`.
   *
   * @template Inner - The element type of the array
   * @template Out - The output element type
   * @param mapper - A function to transform each array element
   * @returns `Some<Out[]>` with mapped array, or `None`
   * @throws {TypeError} if called on a non-array ExperimentalOption
   *
   * @example
   * ```ts
   * ExperimentalOption.Some([1, 2, 3]).innerMap(n => n * 2);
   * // Some([2, 4, 6])
   *
   * ExperimentalOption.None.innerMap(n => n * 2);
   * // None
   *
   * // Practical: transform list results
   * const users = await fetchUsers() // ExperimentalOption<User[]>
   *   .innerMap(u => u.name)
   *   .innerMap(names => names.sort());
   * // Some<string[]>
   *
   * // Error case
   * ExperimentalOption.Some(42).innerMap(x => x * 2);
   * // throws TypeError: innerMap can only be called on ExperimentalOption<Array<T>>
   * ```
   *
   * @see {@link map} for transforming the contained value directly
   */
  innerMap<Inner, Out>(
    this: ExperimentalOption<Array<Inner>>,
    mapper: (val: Inner) => Out,
  ): ExperimentalOption<Out[]> {
    if (this.isNone()) return ExperimentalOption.None;

    if (!Array.isArray(this.#val)) {
      throw new TypeError(
        "innerMap can only be called on ExperimentalOption<Array<T>>",
      );
    }

    return ExperimentalOption.Some((this.#val as Inner[]).map(mapper));
  }

  /**
   * Returns a string representation of the ExperimentalOption.
   *
   * @returns A string describing the ExperimentalOption state and value
   *
   * @example
   * ```ts
   * ExperimentalOption.Some(42).toString();  // "ExperimentalOption::Some(42)"
   * ExperimentalOption.None.toString();      // "ExperimentalOption::None"
   * ExperimentalOption.Some("hello").toString(); // "ExperimentalOption::Some(hello)"
   * ```
   */
  toString(): string {
    if (this.isNone()) return "ExperimentalOption::None";
    return `ExperimentalOption::Some(${String(this.#val)})`;
  }

  /**
   * Makes ExperimentalOption iterable for use with generator-based syntax.
   *
   * Yields self and returns the unwrapped value when resumed.
   * Used internally by {@link ExperimentalOption.gen} for `yield*` syntax.
   *
   * @example
   * ```ts
   * const result = ExperimentalOption.gen(function* () {
   *   const value = yield* ExperimentalOption.Some(42);
   *   return value * 2;
   * });
   * // Some(84)
   * ```
   *
   * @internal
   */
  *[Symbol.iterator](): Generator<ExperimentalOption<T>, T, unknown> {
    const trace = new Error().stack;
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as ExperimentalOption<T>) as T;
  }

  /**
   * Makes ExperimentalOption iterable for use with async generator-based syntax.
   *
   * Yields self and returns the unwrapped value when resumed.
   * Used internally by {@link ExperimentalOption.asyncGen} for `yield*` syntax.
   *
   * @example
   * ```ts
   * const result = await ExperimentalOption.asyncGen(async function* () {
   *   const value = yield* await Promise.resolve(ExperimentalOption.Some(42));
   *   return value * 2;
   * });
   * // Some(84)
   * ```
   *
   * @internal
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<
    ExperimentalOption<T>,
    Awaited<T>,
    unknown
  > {
    const trace = new Error().stack;
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as ExperimentalOption<T>) as Awaited<T>;
  }
}
