import type { Option as OldOption } from "./option.js"
import type { ExperimentalOption } from "./option-experimental.js"
import type { Result as OldResult } from "./result.js"
import type { ExperimentalResult } from "./result-experimental.js"

type Result<T, E> = ExperimentalResult<T, E>
type Option<T> = ExperimentalOption<T>

type LegacyResult<T, E> = OldResult<T, E> | ExperimentalResult<T, E>
type LegacyOption<T> = OldOption<T> | ExperimentalOption<T>

// =============================================================================
// Type Utilities
// =============================================================================

/**
 * Extract the `_tag` values from a discriminated union.
 */
type GetTags<T> = T extends { readonly _tag: infer Tag extends string }
  ? Tag
  : never

/**
 * Extract the variant of T that has the given tag.
 */
type ExtractByTag<T, Tag> = T extends { readonly _tag: Tag } ? T : never

type IsExactlyUnknown<T> = unknown extends T
  ? ([T] extends [unknown] ? true : false)
  : false

/**
 * Extract the inner type from a discriminated union based on tag.
 *
 * For Option/Result-like variants, extracts via `unwrap`/`unwrapErr`.
 * For other discriminated unions, falls back to the narrowed variant itself.
 */
type GetInnerType<T, Tag extends string> = Tag extends "Some"
  ? T extends Option<infer V>
    ? V
    : unknown
  : Tag extends "Ok"
    ? T extends Result<infer V, unknown>
      ? V
      : unknown
    : Tag extends "Err"
      ? T extends Result<unknown, infer E>
        ? E
        : unknown
      : ExtractByTag<T, Tag> extends { unwrap(): infer V }
        ? V
        : unknown

type MatchInput<T, Tag extends string> = Tag extends "Some" | "Ok" | "Err"
  ? IsExactlyUnknown<GetInnerType<T, Tag>> extends true
    ? ExtractByTag<T, Tag>
    : GetInnerType<T, Tag>
  : ExtractByTag<T, Tag>

/**
 * Represents a compile-time exhaustiveness error.
 * When pattern matching is incomplete, this type surfaces the missing cases.
 */
type ExhaustiveError<Missing extends string> = {
  readonly _tag: "ExhaustiveError"
  readonly error: "Pattern matching is not exhaustive"
  readonly missingCases: Missing
}

// =============================================================================
// Pattern Types
// =============================================================================

/** Base pattern interface */
interface BasePattern<Tag extends string> {
  readonly _patternTag: Tag
}

/** Pattern for matching Option.Some with optional predicate guard */
interface SomePattern<T = unknown> extends BasePattern<"Some"> {
  readonly predicate?: (val: T) => boolean
  readonly _hasPredicate: boolean
}

/** Pattern for matching Option.None */
interface NonePattern extends BasePattern<"None"> {
  readonly _hasPredicate: false
}

/** Pattern for matching Result.Ok with optional predicate guard */
interface OkPattern<T = unknown> extends BasePattern<"Ok"> {
  readonly predicate?: (val: T) => boolean
  readonly _hasPredicate: boolean
}

/** Pattern for matching Result.Err with optional predicate guard */
interface ErrPattern<E = unknown> extends BasePattern<"Err"> {
  readonly predicate?: (err: E) => boolean
  readonly _hasPredicate: boolean
}

/** Wildcard pattern that matches anything */
interface WildcardPattern extends BasePattern<"_"> {}

/** Union of all pattern types */
type Pattern<T = unknown, E = unknown> =
  | SomePattern<T>
  | NonePattern
  | OkPattern<T>
  | ErrPattern<E>
  | WildcardPattern

// =============================================================================
// Pattern Namespace (P)
// =============================================================================

/** Pattern for Some without predicate - marks tag as fully consumed */
interface SomePatternNoPredicate<_T = unknown> extends BasePattern<"Some"> {
  readonly predicate: undefined
  readonly _hasPredicate: false
}

/** Pattern for Some with predicate - does NOT consume tag */
interface SomePatternWithPredicate<T = unknown> extends BasePattern<"Some"> {
  readonly predicate: (val: T) => boolean
  readonly _hasPredicate: true
}

/** Pattern for Ok without predicate - marks tag as fully consumed */
interface OkPatternNoPredicate<_T = unknown> extends BasePattern<"Ok"> {
  readonly predicate: undefined
  readonly _hasPredicate: false
}

/** Pattern for Ok with predicate - does NOT consume tag */
interface OkPatternWithPredicate<T = unknown> extends BasePattern<"Ok"> {
  readonly predicate: (val: T) => boolean
  readonly _hasPredicate: true
}

/** Pattern for Err without predicate - marks tag as fully consumed */
interface ErrPatternNoPredicate<_E = unknown> extends BasePattern<"Err"> {
  readonly predicate: undefined
  readonly _hasPredicate: false
}

/** Pattern for Err with predicate - does NOT consume tag */
interface ErrPatternWithPredicate<E = unknown> extends BasePattern<"Err"> {
  readonly predicate: (err: E) => boolean
  readonly _hasPredicate: true
}

/**
 * Pattern constructors for type-safe pattern matching.
 *
 * @example
 * ```ts
 * import { match, P } from "@carbonteq/fp";
 *
 * // Basic patterns
 * match(option)
 *   .with(P.Some(), (v) => v * 2)
 *   .with(P.None(), () => 0)
 *   .exhaustive();
 *
 * // With predicate guards
 * match(option)
 *   .with(P.Some((x) => x > 10), (v) => "big")
 *   .with(P.Some(), (v) => "small")
 *   .with(P.None(), () => "none")
 *   .exhaustive();
 * ```
 */
export const P = {
  /**
   * Pattern that matches `Option.Some`.
   * Without predicate: consumes the tag for exhaustiveness.
   * With predicate: does NOT consume the tag (allows fallthrough).
   */
  Some: (<T = unknown>(predicate?: (val: T) => boolean) =>
    predicate
      ? ({ _patternTag: "Some", predicate, _hasPredicate: true } as const)
      : ({
          _patternTag: "Some",
          predicate: undefined,
          _hasPredicate: false,
        } as const)) as {
    <T = unknown>(): SomePatternNoPredicate<T>
    <T>(predicate: (val: T) => boolean): SomePatternWithPredicate<T>
  },

  /**
   * Pattern that matches `Option.None`.
   */
  None: (): NonePattern => ({
    _patternTag: "None",
    _hasPredicate: false,
  }),

  /**
   * Pattern that matches `Result.Ok`.
   * Without predicate: consumes the tag for exhaustiveness.
   * With predicate: does NOT consume the tag (allows fallthrough).
   */
  Ok: (<T = unknown>(predicate?: (val: T) => boolean) =>
    predicate
      ? ({ _patternTag: "Ok", predicate, _hasPredicate: true } as const)
      : ({
          _patternTag: "Ok",
          predicate: undefined,
          _hasPredicate: false,
        } as const)) as {
    <T = unknown>(): OkPatternNoPredicate<T>
    <T>(predicate: (val: T) => boolean): OkPatternWithPredicate<T>
  },

  /**
   * Pattern that matches `Result.Err`.
   * Without predicate: consumes the tag for exhaustiveness.
   * With predicate: does NOT consume the tag (allows fallthrough).
   */
  Err: (<E = unknown>(predicate?: (err: E) => boolean) =>
    predicate
      ? ({ _patternTag: "Err", predicate, _hasPredicate: true } as const)
      : ({
          _patternTag: "Err",
          predicate: undefined,
          _hasPredicate: false,
        } as const)) as {
    <E = unknown>(): ErrPatternNoPredicate<E>
    <E>(predicate: (err: E) => boolean): ErrPatternWithPredicate<E>
  },

  /**
   * Wildcard pattern that matches anything.
   * Use with `otherwise()` for catch-all handling.
   */
  _: { _patternTag: "_" } as WildcardPattern,
} as const

// =============================================================================
// Match Builder Types
// =============================================================================

/**
 * Handler function type for pattern matching.
 */
type MatchHandler<T, R> = (value: T) => R

/**
 * Internal case representation stored by the builder.
 */
interface MatchCase<T, R> {
  readonly tag: string
  readonly predicate?: (val: unknown) => boolean
  readonly handler: MatchHandler<T, R>
}

/**
 * Builder interface for fluent pattern matching.
 *
 * @template T - The type being matched
 * @template Matched - Union of tags that have been matched
 * @template Returns - Union of return types from handlers
 */
interface MatchBuilder<T, Matched extends string, Returns> {
  /**
   * Add a pattern match case using a string tag.
   *
   * @example
   * ```ts
   * match(option)
   *   .with("Some", (v) => v * 2)
   *   .with("None", () => 0)
   *   .exhaustive();
   * ```
   */
  with<Tag extends Exclude<GetTags<T>, Matched>, R>(
    tag: Tag,
    handler: MatchHandler<MatchInput<T, Tag>, R>,
  ): MatchBuilder<T, Matched | Tag, Returns | R>

  /**
   * Add a pattern match case using a Pattern object without predicate.
   * This variant fully consumes the tag for exhaustiveness checking.
   *
   * @example
   * ```ts
   * match(option)
   *   .with(P.Some(), (v) => v * 2)
   *   .with(P.None(), () => "none")
   *   .exhaustive();
   * ```
   */
  with<Tag extends Exclude<GetTags<T>, Matched>, R>(
    pattern: BasePattern<Tag> & { readonly _hasPredicate: false },
    handler: MatchHandler<MatchInput<T, Tag>, R>,
  ): MatchBuilder<T, Matched | Tag, Returns | R>

  /**
   * Add a pattern match case using a Pattern object with predicate guard.
   * This variant does NOT consume the tag (allows multiple guarded patterns).
   *
   * @example
   * ```ts
   * match(option)
   *   .with(P.Some((x) => x > 10), () => "big")
   *   .with(P.Some(), () => "small")  // Still allowed
   *   .with(P.None(), () => "none")
   *   .exhaustive();
   * ```
   */
  with<Tag extends GetTags<T>, R>(
    pattern: BasePattern<Tag> & { readonly _hasPredicate: true },
    handler: MatchHandler<GetInnerType<T, Tag>, R>,
  ): MatchBuilder<T, Matched, Returns | R>

  /**
   * Add a wildcard pattern case that matches any remaining value.
   *
   * This consumes all tags for exhaustiveness checking.
   */
  with<R>(
    pattern: WildcardPattern,
    handler: MatchHandler<T, R>,
  ): MatchBuilder<T, GetTags<T>, Returns | R>

  /**
   * Add a predicate-based match case.
   * The predicate is tested against the value regardless of its tag.
   *
   * @example
   * ```ts
   * match(option)
   *   .when((v) => v.isSome() && v.unwrap() > 10, () => "big some")
   *   .otherwise(() => "other");
   * ```
   */
  when<R>(
    predicate: (value: T) => boolean,
    handler: MatchHandler<T, R>,
  ): MatchBuilder<T, Matched, Returns | R>

  /**
   * Finalize the match, requiring all cases to be handled.
   * Returns a compile-time error type if cases are missing.
   *
   * @example
   * ```ts
   * // Compiles: all cases handled
   * match(option)
   *   .with("Some", (v) => v)
   *   .with("None", () => 0)
   *   .exhaustive();
   *
   * // Type error: missing "None" case
   * match(option)
   *   .with("Some", (v) => v)
   *   .exhaustive();
   * ```
   */
  exhaustive(): [Exclude<GetTags<T>, Matched>] extends [never]
    ? Returns
    : ExhaustiveError<Exclude<GetTags<T>, Matched>>

  /**
   * Finalize the match with a fallback for unhandled cases.
   *
   * @example
   * ```ts
   * match(option)
   *   .with("Some", (v) => v * 2)
   *   .otherwise(() => 0);  // Handles None
   * ```
   */
  otherwise<R>(fallback: MatchHandler<T, R>): Returns | R
}

// =============================================================================
// Match Builder Implementation
// =============================================================================

/**
 * Internal builder class implementing the fluent API.
 * Uses looser internal types with explicit assertions for public API compliance.
 */
class MatchBuilderImpl<
  T extends { readonly _tag: string },
  _Matched extends string,
  _Returns,
> {
  readonly #value: T
  readonly #cases: MatchCase<unknown, unknown>[]

  constructor(value: T, cases: MatchCase<unknown, unknown>[] = []) {
    this.#value = value
    this.#cases = cases
  }

  // biome-ignore lint/suspicious/noExplicitAny: internal implementation flexibility
  with(tagOrPattern: any, handler: any): any {
    const tag =
      typeof tagOrPattern === "string" ? tagOrPattern : tagOrPattern._patternTag
    const predicate =
      typeof tagOrPattern === "object" && "predicate" in tagOrPattern
        ? (tagOrPattern.predicate as ((val: unknown) => boolean) | undefined)
        : undefined

    const newCase: MatchCase<unknown, unknown> = {
      tag,
      predicate,
      handler,
    }

    return new MatchBuilderImpl(this.#value, [...this.#cases, newCase])
  }

  // biome-ignore lint/suspicious/noExplicitAny: internal implementation flexibility
  when(predicate: any, handler: any): any {
    const newCase: MatchCase<unknown, unknown> = {
      tag: "_when",
      predicate: predicate as (val: unknown) => boolean,
      handler: handler as MatchHandler<unknown, unknown>,
    }

    return new MatchBuilderImpl(this.#value, [...this.#cases, newCase])
  }

  // biome-ignore lint/suspicious/noExplicitAny: internal implementation flexibility
  exhaustive(): any {
    return this.#execute()
  }

  // biome-ignore lint/suspicious/noExplicitAny: internal implementation flexibility
  otherwise(fallback: any): any {
    return this.#execute(fallback as MatchHandler<unknown, unknown>)
  }

  #execute(fallback?: MatchHandler<unknown, unknown>): unknown {
    const value = this.#value
    const tag = value._tag

    // First, try predicate-based cases (when)
    for (const c of this.#cases) {
      if (c.tag === "_when" && c.predicate?.(value)) {
        return c.handler(value)
      }
    }

    // Then, try tag-based cases
    for (const c of this.#cases) {
      if (c.tag === tag) {
        // Check predicate guard if present
        if (c.predicate) {
          // Extract the inner value for predicate check
          const innerValue = this.#extractInnerValue(value)
          if (c.predicate(innerValue)) {
            return c.handler(innerValue)
          }
        } else {
          // No predicate, just match by tag
          const innerValue = this.#extractInnerValue(value)
          return c.handler(innerValue)
        }
      }
    }

    // Check for wildcard pattern
    for (const c of this.#cases) {
      if (c.tag === "_") {
        return c.handler(value)
      }
    }

    // Use fallback if provided
    if (fallback) {
      return fallback(value)
    }

    // This should never happen if exhaustive() type checking works
    throw new UnmatchedCaseError(tag)
  }

  #extractInnerValue(value: T): unknown {
    // For Option: extract the value for Some; for None, return the original object
    // For Result: extract the value for Ok, extract the error for Err
    if ("unwrap" in value && typeof value.unwrap === "function") {
      if (value._tag === "Some" || value._tag === "Ok") {
        try {
          return (value as unknown as { unwrap: () => unknown }).unwrap()
        } catch {
          return undefined
        }
      }
      if (value._tag === "Err" && "unwrapErr" in value) {
        try {
          return (value as unknown as { unwrapErr: () => unknown }).unwrapErr()
        } catch {
          return undefined
        }
      }
    }
    // For other discriminated unions, return the whole value
    return value
  }
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when pattern matching fails at runtime.
 * This should rarely occur if compile-time exhaustiveness is properly enforced.
 */
export class UnmatchedCaseError extends Error {
  readonly name = "UnmatchedCaseError"

  constructor(tag: string) {
    super(`Unmatched case: ${tag}`)
  }
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Create a fluent pattern matcher for discriminated unions.
 *
 * Supports `Option`, `Result`, and any type with a `_tag` discriminant.
 *
 * @template T - The discriminated union type to match
 * @param value - The value to pattern match on
 * @returns A `MatchBuilder` for fluent pattern matching
 *
 * @example
 * ```ts
 * import { match, P, Option, Result } from "@carbonteq/fp";
 *
 * // Option matching
 * const doubled = match(Option.Some(21))
 *   .with("Some", (v) => v * 2)
 *   .with("None", () => 0)
 *   .exhaustive();
 * // 42
 *
 * // Result matching
 * const message = match(Result.Ok("success"))
 *   .with("Ok", (v) => `Got: ${v}`)
 *   .with("Err", (e) => `Error: ${e}`)
 *   .exhaustive();
 * // "Got: success"
 *
 * // With predicate guards
 * const category = match(Option.Some(75))
 *   .with(P.Some((x) => x >= 90), () => "A")
 *   .with(P.Some((x) => x >= 80), () => "B")
 *   .with(P.Some((x) => x >= 70), () => "C")
 *   .with(P.Some(), () => "F")
 *   .with(P.None(), () => "N/A")
 *   .exhaustive();
 * // "C"
 *
 * // With otherwise fallback
 * const safe = match(option)
 *   .with("Some", (v) => v)
 *   .otherwise(() => defaultValue);
 *
 * // Generic discriminated unions
 * type Shape =
 *   | { _tag: "circle"; radius: number }
 *   | { _tag: "rect"; width: number; height: number };
 *
 * const area = match(shape)
 *   .with("circle", (s) => Math.PI * s.radius ** 2)
 *   .with("rect", (s) => s.width * s.height)
 *   .exhaustive();
 * ```
 */
export function match<T extends { readonly _tag: string }>(
  value: T,
): MatchBuilder<T, never, never> {
  return new MatchBuilderImpl(value, []) as MatchBuilder<T, never, never>
}

// =============================================================================
// Legacy Function Wrappers (for backward compatibility)
// =============================================================================

/**
 * Pattern match on a Result using an object with Ok and Err handlers.
 *
 * @deprecated Use `result.match()` instance method or `match(result)` builder instead.
 *
 * @example
 * ```ts
 * // Deprecated:
 * matchRes(result, { Ok: ..., Err: ... });
 *
 * // Preferred:
 * result.match({ Ok: ..., Err: ... });
 * // or
 * match(result).with("Ok", ...).with("Err", ...).exhaustive();
 * ```
 */
export const matchRes = <T, E, U>(
  r: LegacyResult<T, E>,
  branches: { Ok: (val: T) => U; Err: (err: E) => U },
): U => {
  return r.match(branches)
}

/**
 * Pattern match on an Option using an object with Some and None handlers.
 *
 * @deprecated Use `option.match()` instance method or `match(option)` builder instead.
 *
 * @example
 * ```ts
 * // Deprecated:
 * matchOpt(option, { Some: ..., None: ... });
 *
 * // Preferred:
 * option.match({ Some: ..., None: ... });
 * // or
 * match(option).with("Some", ...).with("None", ...).exhaustive();
 * ```
 */
export const matchOpt = <T, U>(
  o: LegacyOption<T>,
  branches: { Some: (val: T) => U; None: () => U },
): U => {
  return o.match(branches)
}

/**
 * Pattern match on a Result (alias for matchRes).
 *
 * @deprecated Use `result.match()` instance method or `match(result)` builder instead.
 */
export const matchResult = matchRes

/**
 * Pattern match on an Option (alias for matchOpt).
 *
 * @deprecated Use `option.match()` instance method or `match(option)` builder instead.
 */
export const matchOption = matchOpt

// =============================================================================
// Type Exports
// =============================================================================

export type {
  MatchBuilder,
  Pattern,
  SomePattern,
  NonePattern,
  OkPattern,
  ErrPattern,
  WildcardPattern,
  ExhaustiveError,
  SomePatternNoPredicate,
  SomePatternWithPredicate,
  OkPatternNoPredicate,
  OkPatternWithPredicate,
  ErrPatternNoPredicate,
  ErrPatternWithPredicate,
}
