import { Result } from "./result.js";
import { UNIT } from "./unit.js";
import { CapturedTrace, isCapturedTrace, isPromiseLike } from "./utils.js";

type Predicate<T> = (val: T) => boolean;
type Falsy = false | 0 | "" | null | undefined;

/**
 * Error thrown when attempting to unwrap a `None` value.
 *
 * This exception is thrown by {@link Option.unwrap} when called on a `None`.
 * It represents a programmer error - you should only call `unwrap()` when
 * you are certain the Option contains a value, or use safe alternatives
 * like {@link Option.unwrapOr} or {@link Option.safeUnwrap}.
 *
 * @example
 * ```ts
 * try {
 *   Option.None.unwrap();
 * } catch (e) {
 *   e instanceof UnwrappedNone // true
 *   e.name // "UnwrapError"
 * }
 * ```
 */
export class UnwrappedNone extends Error {
  readonly name = "UnwrapError";

  constructor() {
    super("Attempted to unwrap Option::None");
  }
}

const UNWRAPPED_NONE_ERR = new UnwrappedNone();

const NONE_VAL = Symbol("Option::None");

export type UnitOption = Option<UNIT>;
export type UnwrapOption<T> = T extends Option<infer R> ? R : never;

type CombinedOptions<T extends Option<unknown>[]> = {
  [K in keyof T]: UnwrapOption<T[K]>;
};

interface MatchCases<T, U> {
  Some: (val: T) => U;
  None: () => U;
}

/**
 * Wrapper that makes Option yieldable with proper type tracking.
 *
 * @internal
 */
class OptionYieldWrap<T> {
  constructor(readonly option: Option<T>) {}

  *[Symbol.iterator](): Generator<OptionYieldWrap<T>, T, unknown> {
    return (yield this) as T;
  }
}

/**
 * Wrapper that makes Option yieldable in async generators with proper type tracking.
 *
 * @internal
 */
class AsyncOptionYieldWrap<T> {
  readonly option: Promise<Option<T>>;

  constructor(option: Option<T> | Promise<Option<T>>) {
    this.option = (
      isPromiseLike(option) ? option : Promise.resolve(option)
    ) as Promise<Option<T>>;
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
 * `Option<T>` represents a value that may or may not be present. It eliminates the
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
 * import { Option } from "@carbonteq/fp";
 *
 * // Creating Options
 * const some: Option<number> = Option.Some(42);
 * const none: Option<number> = Option.None;
 *
 * // From nullable values
 * const fromNull = Option.fromNullable(null); // None
 * const fromValue = Option.fromNullable("hello"); // Some("hello")
 *
 * // Checking and extracting
 * if (some.isSome()) {
 *   console.log(some.unwrap()); // 42
 * }
 *
 * // Chaining operations
 * const result = Option.Some(5)
 *   .map(x => x * 2)
 *   .flatMap(x => Option.Some(x + 1));
 * // Some(11)
 * ```
 *
 * ## Async Variants
 *
 * For operations that return Promises, use `*Async` methods:
 *
 * ```ts
 * // Sync
 * Option.Some(5).map(x => x * 2); // Option<number>
 *
 * // Async
 * Option.Some(5).mapAsync(async x => x * 2); // Promise<Option<number>>
 * ```
 *
 * @template T - The type of the contained value
 *
 * @see {@link https://carbonteq.github.io/ct-fp/option | Option Documentation}
 */
export class Option<T> {
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
   * const none1 = Option.None;
   * const none2 = Option.None;
   * none1 === none2 // true
   * ```
   */
  static readonly None: Option<never> = new Option(NONE_VAL as never, "None");

  /**
   * Creates a `Some` variant containing the provided value.
   *
   * @template Inner - The type of value to wrap
   * @param val - The value to wrap in a Some
   * @returns An `Option<Inner>` in the Some state
   *
   * @example
   * ```ts
   * const opt = Option.Some(42); // Option<number>
   * const str = Option.Some("hello"); // Option<string>
   * const obj = Option.Some({ id: 1 }); // Option<{ id: number }>
   * ```
   */
  static Some<Inner>(this: void, val: Inner): Option<Inner> {
    return new Option(val, "Some");
  }

  /**
   * Creates an `Option` from a nullable value, returning `None` for `null` or `undefined`.
   *
   * Unlike {@link fromFalsy}, this only treats `null` and `undefined` as absence.
   * Values like `0`, `""`, and `false` are considered valid and wrapped in `Some`.
   *
   * @template T - The input type which may include null/undefined
   * @param val - The value to convert to an Option
   * @returns `Some<NonNullable<T>>` if value is non-nullish, else `None`
   *
   * @example
   * ```ts
   * Option.fromNullable("hello") // Some("hello")
   * Option.fromNullable(null)    // None
   * Option.fromNullable(undefined) // None
   * Option.fromNullable(0)       // Some(0) - 0 is not nullish
   * Option.fromNullable("")      // Some("") - empty string is not nullish
   * Option.fromNullable(false)   // Some(false) - false is not nullish
   *
   * // With user input
   * function findUser(id: string): User | null {
   *   return database.getUser(id) ?? null;
   * }
   * const user = Option.fromNullable(findUser("123"));
   * // Option<User>
   * ```
   */
  static fromNullable<T>(val: T): Option<NonNullable<T>> {
    return val === null || val === undefined
      ? Option.None
      : Option.Some(val as NonNullable<T>);
  }

  /**
   * Creates an `Option` from a value that may be falsy, returning `None` for falsy values.
   *
   * Treats `false`, `0`, `""`, `null`, and `undefined` as absence.
   * Use {@link fromNullable} if you only want to exclude `null`/`undefined`.
   *
   * @template T - The type of value to wrap
   * @param val - The value to convert to an Option
   * @returns `Some<T>` if value is truthy, else `None`
   *
   * @example
   * ```ts
   * Option.fromFalsy("hello")  // Some("hello")
   * Option.fromFalsy("")       // None
   * Option.fromFalsy(0)        // None
   * Option.fromFalsy(false)    // None
   * Option.fromFalsy(null)     // None
   * Option.fromFalsy(undefined) // None
   *
   * // Useful for validation
   * const isValid = Option.fromFalsy(getConfigValue("API_KEY"));
   * ```
   */
  static fromFalsy<T>(val: T | Falsy): Option<T> {
    return val ? Option.Some(val as T) : Option.None;
  }

  /**
   * Creates an `Option` based on a predicate function result.
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
   * Option.fromPredicate(age, a => a >= 18) // Some(25)
   * Option.fromPredicate(15, a => a >= 18)  // None
   *
   * // Can be used for validation
   * const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   * Option.fromPredicate(user.email, isValidEmail)
   *
   * // With complex predicates
   * const isValidPassword = (pw: string) =>
   *   pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw);
   * Option.fromPredicate(password, isValidPassword)
   * ```
   */
  static fromPredicate<T>(val: T, pred: Predicate<T>): Option<T> {
    return pred(val) ? Option.Some(val) : Option.None;
  }

  /**
   * Combines multiple Options into a single Option of an array.
   *
   * Returns `Some` containing an array of all unwrapped values if ALL inputs are `Some`.
   * Returns `None` if ANY input is `None`.
   *
   * @template T - Variadic tuple of Option types
   * @param options - Variable number of Options to combine
   * @returns `Option<[T1, T2, ...]>` with array of values, or `None`
   *
   * @example
   * ```ts
   * // All Some -> array of values
   * const all = Option.all(
   *   Option.Some(1),
   *   Option.Some(2),
   *   Option.Some(3)
   * );
   * // Some([1, 2, 3])
   *
   * // Any None -> None
   * const withNone = Option.all(
   *   Option.Some(1),
   *   Option.None,
   *   Option.Some(3)
   * );
   * // None
   *
   * // Empty -> Some([])
   * const empty = Option.all();
   * // Some([])
   *
   * // Practical example: combine multiple validations
   * const name = Option.fromNullable(user.name);
   * const email = Option.fromNullable(user.email);
   * const age = Option.fromNullable(user.age);
   *
   * const complete = Option.all(name, email, age);
   * // Option<[string, string, number]>
   * ```
   */
  static all<T extends Option<unknown>[]>(
    ...options: T
  ): Option<CombinedOptions<T>> {
    const vals = [] as CombinedOptions<T>;

    for (const opt of options) {
      if (opt.isNone()) return Option.None;
      vals.push(opt.#val);
    }

    return Option.Some(vals);
  }

  /**
   * Returns the first `Some` from a list of Options, or `None` if all are `None`.
   *
   * Short-circuits on the first `Some` found, evaluating subsequent options lazily.
   *
   * @template T - The type of values in the Options
   * @param options - Variable number of Options to check
   * @returns The first `Some<T>` found, or `None`
   *
   * @example
   * ```ts
   * // Returns first Some
   * const first = Option.any(
   *   Option.None,
   *   Option.Some("First value"),
   *   Option.Some("Second value")
   * );
   * // Some("First value")
   *
   * // All None -> None
   * const allNone = Option.any(
   *   Option.None,
   *   Option.None,
   *   Option.None
   * );
   * // None
   *
   * // Practical: Try multiple fallback sources
   * const config = Option.any(
   *   Option.fromNullable(process.env.API_KEY),
   *   Option.fromNullable(getEnvVar("API_KEY")),
   *   Option.fromNullable(readConfigFile("API_KEY"))
   * );
   *
   * // Empty -> None
   * const empty = Option.any();
   * // None
   * ```
   */
  static any<T>(...options: Option<T>[]): Option<T> {
    for (const opt of options) {
      if (opt.isSome()) return opt;
    }
    return Option.None;
  }

  /**
   * Generator-based syntax for chaining Option operations (simplified, no adapter).
   *
   * Provides imperative-style code while maintaining functional Option handling.
   * Use `yield*` to unwrap Options or short-circuit on `None`.
   *
   * Short-circuits on first `None`, returning singleton `None`. Uses iteration
   * instead of recursion to avoid stack overflow on deep chains.
   *
   * @template T - The return type of the generator
   * @param genFn - A generator function that yields Options
   * @returns `Some<T>` with the generator's return value, or `None`
   *
   * @example
   * ```ts
   * // Simple sync chain
   * const result = Option.gen(function* () {
   *   const a = yield* Option.Some(1);
   *   const b = yield* Option.Some(2);
   *   return a + b;
   * });
   * // Some(3)
   *
   * // None short-circuit
   * const shortCircuit = Option.gen(function* () {
   *   const a = yield* Option.Some(1);
   *   const b = yield* Option.None;    // Short-circuits here
   *   const c = yield* Option.Some(3); // Never executes
   *   return a + b + c;
   * });
   * // None
   *
   * // Chaining optional operations
   * const email = Option.gen(function* () {
   *   const user = yield* findUser(userId);
   *   const profile = yield* Option.fromNullable(user.profile);
   *   const settings = yield* Option.fromNullable(profile.settings);
   *   return settings.email;
   * });
   *
   * // Nested optional access
   * const city = Option.gen(function* () {
   *   const user = yield* Option.fromNullable(getUser());
   *   const address = yield* Option.fromNullable(user?.address);
   *   const city = yield* Option.fromNullable(address?.city);
   *   return city;
   * });
   * ```
   *
   * @see {@link genAdapter} for better type inference in complex chains
   * @see {@link asyncGen} for async operations
   */
  static gen<T>(
    genFn: () => Generator<Option<unknown>, T, unknown>,
  ): Option<T> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is the Option that was yielded
      let yielded = next.value as Option<unknown>;

      if (isCapturedTrace(yielded)) {
        yielded = yielded.value as Option<unknown>;
      }

      if (yielded.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value and pass it back to the generator
      nextArg = yielded.unwrap();
    }

    return currentResult;
  }

  /**
   * Generator-based syntax for chaining Option operations with an adapter function.
   *
   * Provides better type inference and IDE support compared to {@link gen}.
   * The `$` adapter wraps Options and enables clearer type tracking.
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
   * const result = Option.genAdapter(function* ($) {
   *   const a = yield* $(Option.Some(1));
   *   const b = yield* $(Option.Some(2));
   *   return a + b;
   * });
   * // Some(3)
   *
   * // Deep nested access with better type safety
   * const email = Option.genAdapter(function* ($) {
   *   const user = yield* $(Option.fromNullable(apiResponse?.user));
   *   const profile = yield* $(Option.fromNullable(user?.profile));
   *   const contact = yield* $(Option.fromNullable(profile?.contact));
   *   return contact?.email;
   * });
   *
   * // Complex validation chain
   * const validConfig = Option.genAdapter(function* ($) {
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
      adapter: <A>(option: Option<A>) => OptionYieldWrap<A>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => Generator<Eff, T, any>,
  ): Option<T> {
    const adapter = <A>(option: Option<A>): OptionYieldWrap<A> =>
      new OptionYieldWrap(option);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is the OptionYieldWrap that was yielded
      const wrapped = next.value as OptionYieldWrap<unknown>;
      let option = wrapped.option;

      if (isCapturedTrace(option)) {
        option = (option as unknown as CapturedTrace<Option<unknown>>)
          .value as Option<unknown>;
      }

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value and pass it back to the generator
      nextArg = option.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining Option operations (simplified, no adapter).
   *
   * Use `yield*` with `Option<T>` values directly. For `Promise<Option<T>>`,
   * await first then `yield*`.
   *
   * Short-circuits on first `None`, returning singleton `None`. Uses async iteration
   * instead of recursion to avoid stack overflow on deep chains.
   *
   * @template T - The return type of the generator
   * @param genFn - An async generator function that yields Options
   * @returns `Promise<Some<T>>` with the generator's return value, or `Promise<None>`
   *
   * @example
   * ```ts
   * // Simple async chain
   * const result = await Option.asyncGen(async function* () {
   *   const a = yield* Option.Some(1);
   *   const b = yield* await asyncOperation(a);  // await Promise<Option> first
   *   const c = yield* Option.Some(3);
   *   return a + b + c;
   * });
   * // Some(result)
   *
   * // None short-circuit in async
   * const shortCircuit = await Option.asyncGen(async function* () {
   *   const data = yield* await fetchOptionalData();
   *   const parsed = yield* parse(data);         // Short-circuits on None
   *   const validated = yield* validate(parsed); // Never executes
   *   return validated;
   * });
   * // None
   *
   * // Mixed sync/async workflow
   * const result = await Option.asyncGen(async function* () {
   *   const id = yield* Option.Some(parseInt(input)); // sync
   *   const user = yield* await fetchUser(id);        // async
   *   const profile = yield* Option.fromNullable(user?.profile); // sync
   *   const enriched = yield* await enrichProfile(profile); // async
   *   return enriched;
   * });
   *
   * // Complex pipeline with multiple optional steps
   * async function processLead(email: string): Promise<Option<Lead>> {
   *   return await Option.asyncGen(async function* () {
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
    genFn: () => AsyncGenerator<Option<unknown>, T, unknown>,
  ): Promise<Option<T>> {
    const iterator = genFn();

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is an Option (user awaits promises before yielding)
      let option = next.value as Option<unknown>;

      if (isCapturedTrace(option)) {
        option = option.value as Option<unknown>;
      }

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
        break;
      }

      // Unwrap the Some value
      nextArg = await option.unwrap();
    }

    return currentResult;
  }

  /**
   * Async generator-based syntax for chaining Option operations with an adapter function.
   *
   * The `$` adapter handles both sync `Option<T>` and async `Promise<Option<T>>`,
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
   * const result = await Option.asyncGenAdapter(async function* ($) {
   *   const a = yield* $(Option.Some(1));       // sync Option
   *   const b = yield* $(asyncOperation(a));    // Promise<Option> - auto-awaited
   *   const c = yield* $(Option.Some(3));
   *   return a + b + c;
   * });
   *
   * // Complex workflow with database and API calls
   * const userData = await Option.asyncGenAdapter(async function* ($) {
   *   const session = yield* $(getSession());       // Promise<Option<Session>>
   *   const userId = yield* $(Option.fromNullable(session?.userId));
   *   const profile = yield* $(await fetchProfile(userId)); // Promise<Option<Profile>>
   *   const preferences = yield* $(Option.fromNullable(profile?.preferences));
   *   const enriched = yield* $(await enrichPreferences(preferences));
   *   return enriched;
   * });
   *
   * // Real-world: Optional data enrichment
   * async function getProductDetails(productId: string): Promise<Option<ProductDetails>> {
   *   return await Option.asyncGenAdapter(async function* ($) {
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
        option: Option<A> | Promise<Option<A>>,
      ) => AsyncOptionYieldWrap<A>,
      // biome-ignore lint/suspicious/noExplicitAny: inference
    ) => AsyncGenerator<Eff, T, any>,
  ): Promise<Option<T>> {
    const adapter = <A>(
      option: Option<A> | Promise<Option<A>>,
    ): AsyncOptionYieldWrap<A> => new AsyncOptionYieldWrap(option);

    const iterator = genFn(adapter);

    // Use iteration instead of recursion to avoid stack overflow
    let nextArg: unknown;
    let currentResult: Option<T>;

    while (true) {
      const next = await iterator.next(nextArg);

      if (next.done) {
        // Generator completed successfully - wrap return value in Some
        currentResult = Option.Some(next.value);
        break;
      }

      // next.value is the AsyncOptionYieldWrap that was yielded
      const wrapped = next.value as AsyncOptionYieldWrap<unknown>;
      let option = await wrapped.option;

      if (isCapturedTrace(option)) {
        option = (option as unknown as CapturedTrace<Option<unknown>>)
          .value as Option<unknown>;
      }

      if (option.isNone()) {
        // Early termination on None - return singleton None
        currentResult = Option.None;
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
   * Returns `true` if this Option is in the `Some` state, containing a value.
   *
   * @returns `true` if this is a `Some`, `false` if `None`
   *
   * @example
   * ```ts
   * const opt: Option<number> = Option.Some(42);
   *
   * if (opt.isSome()) {
   *   // TypeScript knows opt is Option<number> & { _tag: "Some" }
   *   console.log(opt.unwrap()); // 42
   * }
   * ```
   */
  isSome(): this is Option<T> & { readonly _tag: "Some" } {
    return this._tag === "Some" && this.#val !== NONE_VAL;
  }

  /**
   * Type guard that narrows the type to `None`.
   *
   * Returns `true` if this Option is in the `None` state (absence of value).
   *
   * @returns `true` if this is `None`, `false` if `Some`
   *
   * @example
   * ```ts
   * const opt: Option<number> = Option.None;
   *
   * if (opt.isNone()) {
   *   // TypeScript knows opt is Option<never> & { _tag: "None" }
   *   console.log("No value present");
   * }
   * ```
   */
  isNone(): this is Option<never> & { readonly _tag: "None" } {
    return this._tag === "None" || this.#val === NONE_VAL;
  }

  /**
   * Type guard that checks if the contained value is the `Unit` type.
   *
   * Returns `true` if this Option contains the special `UNIT` value,
   * used to represent operations that produce no meaningful output.
   *
   * @returns `true` if this contains `UNIT`, `false` otherwise
   *
   * @example
   * ```ts
   * const unitOpt: Option<UNIT> = Option.Some(UNIT);
   * unitOpt.isUnit(); // true
   *
   * const normalOpt: Option<number> = Option.Some(42);
   * normalOpt.isUnit(); // false
   * ```
   */
  isUnit(): this is Option<UNIT> {
    return this.#val === UNIT;
  }

  /**
   * Returns the contained value or throws {@link UnwrappedNone} if `None`.
   *
   * This is an unsafe operation that throws on `None`. Use only when you are
   * certain the Option contains a value, or use safe alternatives like
   * {@link unwrapOr} or {@link safeUnwrap}.
   *
   * @throws {@link UnwrappedNone} if this is `None`
   * @returns The contained value
   *
   * @example
   * ```ts
   * Option.Some(42).unwrap(); // 42
   * Option.None.unwrap();    // throws UnwrappedNone
   *
   * // Safe usage pattern
   * const opt = Option.Some(42);
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
   * Option.Some(42).unwrapOr(0); // 42
   * Option.None.unwrapOr(0);    // 0
   *
   * // With user input
   * const age = Option.fromNullable(user.age).unwrapOr(18);
   *
   * // With complex defaults
   * const config = Option.fromNullable(getConfig())
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
   * const value = Option.None.unwrapOrElse(() => {
   *   console.log("Computing expensive default...");
   *   return expensivelyComputeDefault();
   * });
   * // Prints "Computing expensive default..."
   *
   * // Not computed when Some
   * const some = Option.Some(42).unwrapOrElse(() => {
   *   console.log("This won't print");
   *   return expensivelyComputeDefault();
   * });
   * // Returns 42 without printing
   *
   * // Practical: cache lookup with fallback
   * const cached = Option.fromNullable(cache.get(key))
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
   * null checking while maintaining the Option semantics.
   *
   * @returns The contained value, or `null`
   *
   * @example
   * ```ts
   * Option.Some(42).safeUnwrap(); // 42
   * Option.None.safeUnwrap();    // null
   *
   * // Integration with existing null-handling code
   * const value = Option.fromNullable(user.name).safeUnwrap();
   * if (value !== null) {
   *   console.log(value.toUpperCase());
   * }
   *
   * // With nullish coalescing
   * const displayName = Option.fromNullable(user.displayName)
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
   * Pattern matches on both states of the Option, providing exhaustive handling.
   *
   * This is the most explicit way to handle Options, ensuring both `Some` and `None`
   * cases are handled at compile time.
   *
   * @template U - The result type of both branches
   * @param cases - Object containing handlers for both states
   * @returns The result of calling the appropriate handler
   *
   * @example
   * ```ts
   * const result = Option.Some(42).match({
   *   Some: (value) => `Got: ${value}`,
   *   None: () => "Got nothing"
   * });
   * // "Got: 42"
   *
   * const noneResult = Option.None.match({
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
   * Option.Some(5).map(x => x * 2);     // Some(10)
   * Option.None.map(x => x * 2);        // None
   *
   * // Chaining transforms
   * Option.Some("hello")
   *   .map(s => s.toUpperCase())
   *   .map(s => `${s}!`)
   *   .map(s => s.length);
   * // Some(6)
   *
   * // Type transformation
   * Option.Some("123")
   *   .map(s => parseInt(s, 10));
   * // Some(123)
   * ```
   *
   * @see {@link mapAsync} for async transformations
   * @see {@link flatMap} for chaining operations that return Options
   * @see {@link mapOr} for unwrapping with transformation
   */
  map<U>(fn: (val: T) => Promise<U>): never;
  map<U>(fn: (val: T) => U): Option<U>;
  map<U>(fn: (val: T) => U): Option<U> {
    if (this.isNone()) {
      return Option.None;
    }

    return Option.Some(fn(this.#val));
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
   * const result = await Option.Some(5).mapAsync(async x => {
   *   return x * 2;
   * });
   * // Some(10)
   *
   * // Chaining with .then()
   * Option.Some(5)
   *   .map(x => x * 2)              // Some(10)
   *   .mapAsync(async x => {
   *     return await fetchData(x);  // Some<Data>
   *   })
   *   .then(o => o.map(d => d.name)); // Promise<Some<string>>
   *
   * // Practical: API call after validation
   * const userData = await Option.Some(userId)
   *   .mapAsync(async id => await fetchUser(id))
   *   .then(o => o.mapAsync(async user => await fetchProfile(user.id)));
   * // Promise<Option<Profile>>
   * ```
   *
   * @see {@link map} for synchronous transformations
   */
  async mapAsync<U>(fn: (val: T) => Promise<U>): Promise<Option<U>> {
    if (this.isNone()) {
      return Promise.resolve(Option.None);
    }

    return fn(this.#val).then((u) => Option.Some(u));
  }

  /**
   * Maps the value or returns a default value (unwrapped).
   *
   * Unlike {@link map}, this returns the value directly (not wrapped in Option).
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
   * Option.Some(5).mapOr(0, x => x * 2); // 10
   * Option.None.mapOr(0, x => x * 2);    // 0
   *
   * // Practical: formatting with fallback
   * const displayName = Option.fromNullable(user.name)
   *   .mapOr("Anonymous", name => name.toUpperCase());
   * // "JOHN" or "Anonymous"
   *
   * // With complex defaults
   * const balance = Option.fromNullable(account?.balance)
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
   * const result = await Option.Some(5).mapOrAsync(0, async x => {
   *   return x * 2;
   * });
   * // 10
   *
   * const noneResult = await Option.None.mapOrAsync(0, async x => {
   *   return x * 2;
   * });
   * // 0
   *
   * // Practical: async fetch with fallback
   * const balance = await Option.fromNullable(userId)
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
   * Chains operations that return Options, flattening nested Options.
   *
   * Also known as `bind` or `chain`. Use this to sequence operations where
   * each step depends on the previous value and may fail.
   *
   * If `Some`, applies the function and returns its result directly.
   * If `None`, returns `None` without calling the function.
   *
   * @template U - The type of the value in the returned Option
   * @param fn - A function that returns an Option
   * @returns The result of the function, or `None`
   *
   * @example
   * ```ts
   * // Basic chaining
   * Option.Some(5).flatMap(x => Option.Some(x + 1)); // Some(6)
   * Option.Some(5).flatMap(x => Option.None);        // None
   * Option.None.flatMap(x => Option.Some(x + 1));    // None
   *
   * // Chaining optional operations
   * const email = findUser(userId)
   *   .flatMap(user => Option.fromNullable(user.profile))
   *   .flatMap(profile => Option.fromNullable(profile.avatar))
   *   .flatMap(avatar => Option.fromNullable(avatar.url));
   *
   * // Practical: multi-step validation
   * const valid = Option.Some(input)
   *   .flatMap(s => parseEmail(s))
   *   .flatMap(email => checkDomain(email))
   *   .flatMap(domain => resolveDomain(domain));
   * ```
   *
   * @see {@link flatMapAsync} for async operations
   * @see {@link map} for simple transformations
   * @see {@link gen} for imperative-style chaining
   */
  flatMap<U>(fn: (val: T) => Option<U>): Option<U> {
    if (this.isNone()) {
      return Option.None;
    }

    return fn(this.#val);
  }

  /**
   * Chains async operations that return Options.
   *
   * @template U - The type of the value in the returned Option
   * @param fn - An async function that returns an Option
   * @returns `Promise<Option<U>>` with the result, or `Promise<None>`
   *
   * @example
   * ```ts
   * // Async database lookup chain
   * const profile = await Option.Some(userId)
   *   .flatMapAsync(async id => await findUser(id))
   *   .flatMapAsync(async user => await getProfile(user.id))
   *   .flatMapAsync(async p => await getAvatar(p.avatarId));
   * // Promise<Option<Avatar>>
   *
   * // Practical: multi-step async pipeline
   * const result = await Option.Some(email)
   *   .flatMapAsync(validateEmail)
   *   .flatMapAsync(e => fetchUserByEmail(e))
   *   .flatMapAsync(u => getUserPermissions(u.id));
   * ```
   *
   * @see {@link flatMap} for synchronous operations
   * @see {@link asyncGen} for imperative-style async chaining
   */
  async flatMapAsync<U>(
    fn: (val: T) => Promise<Option<U>>,
  ): Promise<Option<U>> {
    if (this.isNone()) {
      return Option.None;
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
   * Option.Some(5).filter(x => x > 3);   // Some(5)
   * Option.Some(5).filter(x => x > 10);  // None
   * Option.None.filter(x => x > 3);      // None
   *
   * // Age validation
   * const adult = Option.Some(age)
   *   .filter(a => a >= 18);
   *
   * // Multiple filters
   * const valid = Option.Some(password)
   *   .filter(pw => pw.length >= 8)
   *   .filter(pw => /[A-Z]/.test(pw))
   *   .filter(pw => /[0-9]/.test(pw));
   * ```
   *
   * @see {@link filterAsync} for async predicates
   * @see {@link fromPredicate} for creating Options from predicates
   */
  filter(pred: (val: T) => boolean): Option<T> {
    if (this.isNone()) {
      return Option.None;
    }

    return pred(this.#val) ? this : Option.None;
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
   * const valid = await Option.Some(email)
   *   .filterAsync(async e => await checkEmailDomain(e));
   *
   * // Practical: database validation
   * const unique = await Option.Some(username)
   *   .filterAsync(async u => await isUsernameAvailable(u));
   * ```
   *
   * @see {@link filter} for synchronous predicates
   */
  async filterAsync(pred: (val: T) => Promise<boolean>): Promise<Option<T>> {
    if (this.isNone()) {
      return Promise.resolve(Option.None);
    }

    return pred(this.#val).then((passed) => (passed ? this : Option.None));
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
   * Option.Some(5).zip(x => x * 2);       // Some([5, 10])
   * Option.None.zip(x => x * 2);          // None
   *
   * // Keep original while computing derived value
   * Option.Some(user).zip(u => u.permissions.length);
   * // Some([user, 5])
   *
   * // Practical: price with discount
   * const priceWithDiscount = Option.Some(100)
   *   .zip(price => price * 0.9);
   * // Some([100, 90])
   *
   * // Derive metadata while keeping original
   * Option.Some(request).zip(req => ({
   *   size: JSON.stringify(req).length,
   *   timestamp: Date.now()
   * }));
   * // Some([request, { size, timestamp }])
   * ```
   *
   * @see {@link zipAsync} for async derivation
   * @see {@link flatZip} for combining with another Option
   */
  zip<U>(fn: (val: T) => Promise<U>): never;
  zip<U>(fn: (val: T) => U): Option<[prev: T, curr: U]>;
  zip<U>(fn: (val: T) => U): Option<[T, U]> {
    if (this.isNone()) {
      return Option.None;
    }

    return Option.Some([this.#val, fn(this.#val)]);
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
   * const result = await Option.Some(user)
   *   .zipAsync(async u => await fetchCount(u));
   * // Some([user, number])
   *
   * // Practical: user with additional data
   * const enriched = await Option.Some(userId)
   *   .zipAsync(async id => await fetchUser(id))
   *   .then(o => o.zipAsync(async ([id, user]) => await getStats(user.id)));
   * // Promise<Option<[userId, User, Stats]>>
   * ```
   *
   * @see {@link zip} for synchronous derivation
   */
  async zipAsync<U>(fn: (val: T) => Promise<U>): Promise<Option<[T, U]>> {
    if (this.isNone()) {
      return Promise.resolve(Option.None);
    }

    return fn(this.#val).then((u) => Option.Some([this.#val, u]));
  }

  /**
   * Pairs the original value with a value from another Option.
   *
   * Combines two independent Options into a tuple. Both must be `Some` to succeed.
   *
   * @template U - The type of the value in the other Option
   * @param fn - A function that returns an Option to combine with
   * @returns `Some<[T, U]>` with both values, or `None`
   *
   * @example
   * ```ts
   * // Basic usage
   * Option.Some(5).flatZip(x => Option.Some(10));  // Some([5, 10])
   * Option.Some(5).flatZip(x => Option.None);     // None
   * Option.None.flatZip(x => Option.Some(10));    // None
   *
   * // Practical: combine independent lookups
   * const productData = Option.Some(productId)
   *   .flatZip(id => fetchProductPrice(id));
   * // Option<[productId, price]>
   *
   * // Multiple dependencies
   * const complete = Option.Some(userId)
   *   .flatZip(id => fetchUser(id))
   *   .flatMap(([id, user]) => Option.Some([id, user.profileId]))
   *   .flatZip(([id, profileId]) => fetchProfile(profileId));
   * // Option<[userId, profileId, profile]>
   * ```
   *
   * @see {@link flatZipAsync} for async Options
   * @see {@link zip} for derived values
   * @see {@link all} for combining multiple Options at once
   */
  flatZip<U>(fn: (val: T) => Option<U>): Option<[T, U]> {
    if (this.isNone()) {
      return Option.None;
    }

    const other = fn(this.#val);
    if (other.isNone()) {
      return Option.None;
    }

    return Option.Some([this.#val, other.unwrap()]);
  }

  /**
   * Pairs the original value with a value from an async Option.
   *
   * @template U - The type of the value in the other Option
   * @param fn - An async function that returns an Option
   * @returns `Promise<Some<[T, U]>>` with both values, or `Promise<None>`
   *
   * @example
   * ```ts
   * const result = await Option.Some(userId)
   *   .flatZipAsync(async id => await fetchUser(id));
   * // Option<[userId, User]>
   *
   * // Practical: async pipeline
   * const enriched = await Option Some(userId)
   *   .flatZipAsync(async id => await fetchUser(id))
   *   .then(o => o.flatMapAsync(async ([id, user]) =>
   *     Option.Some([id, user, await fetchProfile(user.profileId)])
   *   ));
   * ```
   *
   * @see {@link flatZip} for synchronous Options
   */
  async flatZipAsync<U>(
    fn: (val: T) => Promise<Option<U>>,
  ): Promise<Option<[T, U]>> {
    if (this.isNone()) {
      return Promise.resolve(Option.None);
    }

    return fn(this.#val).then((other) => {
      if (other.isNone()) {
        return Option.None;
      }
      return Option.Some([this.#val, other.unwrap()]);
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
   * Option.Some(user)
   *   .tap(u => console.log(`Processing ${u.name}`))
   *   .map(u => u.email);
   *
   * // Debugging
   * Option.Some(input)
   *   .tap(val => console.log("Before:", val))
   *   .map(transform)
   *   .tap(val => console.log("After:", val));
   *
   * // Practical: audit trail
   * const result = Option.Some(transaction)
   *   .tap(t => auditLog("start", t.id))
   *   .flatMap(t => process(t))
   *   .tap(r => auditLog("success", r.id))
   *   .tapErr(e => auditLog("error", e.message));
   * ```
   *
   * @see {@link tapAsync} for async side effects
   */
  tap(fn: (val: T) => void): Option<T> {
    if (this.isSome()) {
      fn(this.#val);
    }
    return this;
  }

  /**
   * Executes an async side effect function if `Some`, returning `this` unchanged.
   *
   * @param fn - An async side effect function to execute
   * @returns `Promise<Option<T>>` that resolves to `this`
   *
   * @example
   * ```ts
   * // Async logging
   * await Option.Some(user)
   *   .tapAsync(async u => await logAnalytics(u.id))
   *   .map(u => u.email);
   *
   * // Practical: metrics collection
   * const result = await Option.Some(request)
   *   .tapAsync(async req => await trackMetric("request_start", req.id))
   *   .flatMapAsync(async req => await processRequest(req))
   *   .tapAsync(async res => await trackMetric("request_success", res.id));
   * ```
   *
   * @see {@link tap} for synchronous side effects
   */
  async tapAsync(fn: (val: T) => Promise<void>): Promise<Option<T>> {
    if (this.isSome()) {
      return fn(this.#val).then(() => this);
    }
    return Promise.resolve(this);
  }

  /**
   * Converts this Option to a Result.
   *
   * `Some` becomes `Ok`, `None` becomes `Err` with the provided error.
   *
   * @template E - The type of the error for the `Err` variant
   * @param error - The error value to use if this is `None`
   * @returns `Result<T, E>` with the value or error
   *
   * @example
   * ```ts
   * Option.Some(42).toResult("was none");    // Ok(42)
   * Option.None.toResult("was none");        // Err("was none")
   *
   * // Practical: convert to Result for error handling
   * const user = Option.fromNullable(getUser())
   *   .toResult(new Error("User not found"));
   *
   * // With custom error types
   * const config = Option.fromNullable(loadConfig())
   *   .toResult({ code: "CONFIG_MISSING", message: "Config file not found" });
   * ```
   *
   * @see {@link Result} for the Result type
   */
  toResult<E>(error: E): Result<T, E> {
    if (this.isNone()) {
      return Result.Err(error);
    }
    return Result.Ok(this.#val);
  }

  /**
   * Maps over array elements inside an `Option<Array<T>>`.
   *
   * Only callable when `T` is an array type. Applies the mapper to each
   * element if `Some`, or returns `None`.
   *
   * @template Inner - The element type of the array
   * @template Out - The output element type
   * @param mapper - A function to transform each array element
   * @returns `Some<Out[]>` with mapped array, or `None`
   * @throws {TypeError} if called on a non-array Option
   *
   * @example
   * ```ts
   * Option.Some([1, 2, 3]).innerMap(n => n * 2);
   * // Some([2, 4, 6])
   *
   * Option.None.innerMap(n => n * 2);
   * // None
   *
   * // Practical: transform list results
   * const users = await fetchUsers() // Option<User[]>
   *   .innerMap(u => u.name)
   *   .innerMap(names => names.sort());
   * // Some<string[]>
   *
   * // Error case
   * Option.Some(42).innerMap(x => x * 2);
   * // throws TypeError: innerMap can only be called on Option<Array<T>>
   * ```
   *
   * @see {@link map} for transforming the contained value directly
   */
  innerMap<Inner, Out>(
    this: Option<Array<Inner>>,
    mapper: (val: Inner) => Out,
  ): Option<Out[]> {
    if (this.isNone()) return Option.None;

    if (!Array.isArray(this.#val)) {
      throw new TypeError("innerMap can only be called on Option<Array<T>>");
    }

    return Option.Some((this.#val as Inner[]).map(mapper));
  }

  /**
   * Returns a string representation of the Option.
   *
   * @returns A string describing the Option state and value
   *
   * @example
   * ```ts
   * Option.Some(42).toString();  // "Option::Some(42)"
   * Option.None.toString();      // "Option::None"
   * Option.Some("hello").toString(); // "Option::Some(hello)"
   * ```
   */
  toString(): string {
    if (this.isNone()) return "Option::None";
    return `Option::Some(${String(this.#val)})`;
  }

  /**
   * Makes Option iterable for use with generator-based syntax.
   *
   * Yields self and returns the unwrapped value when resumed.
   * Used internally by {@link Option.gen} for `yield*` syntax.
   *
   * @example
   * ```ts
   * const result = Option.gen(function* () {
   *   const value = yield* Option.Some(42);
   *   return value * 2;
   * });
   * // Some(84)
   * ```
   *
   * @internal
   */
  *[Symbol.iterator](): Generator<Option<T>, T, unknown> {
    const trace = new Error().stack;
    return (yield new CapturedTrace(this, trace) as unknown as Option<T>) as T;
  }

  /**
   * Makes Option iterable for use with async generator-based syntax.
   *
   * Yields self and returns the unwrapped value when resumed.
   * Used internally by {@link Option.asyncGen} for `yield*` syntax.
   *
   * @example
   * ```ts
   * const result = await Option.asyncGen(async function* () {
   *   const value = yield* await Promise.resolve(Option.Some(42));
   *   return value * 2;
   * });
   * // Some(84)
   * ```
   *
   * @internal
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<
    Option<T>,
    Awaited<T>,
    unknown
  > {
    const trace = new Error().stack;
    return (yield new CapturedTrace(
      this,
      trace,
    ) as unknown as Option<T>) as Awaited<T>;
  }
}
