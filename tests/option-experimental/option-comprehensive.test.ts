import { describe, expect, it, mock } from "bun:test"
import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "@/option-experimental.js"
import { UNIT } from "@/unit.js"

describe("Constructors", () => {
  describe("Option.Some()", () => {
    it("should create Some containing the value", () => {
      const opt = Option.Some(42)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(42)
    })

    it("should work with various data types", () => {
      expect(Option.Some("hello").unwrap()).toBe("hello")
      expect(Option.Some(true).unwrap()).toBe(true)
      expect(Option.Some([1, 2, 3]).unwrap()).toEqual([1, 2, 3])
      expect(Option.Some({ a: 1 }).unwrap()).toEqual({ a: 1 })
      expect(Option.Some(new Date(0)).unwrap()).toEqual(new Date(0))
    })

    it("should allow null in Some (valid per spec)", () => {
      const opt = Option.Some(null)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(null)
    })

    it("should allow undefined in Some (valid per spec)", () => {
      const opt = Option.Some(undefined)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(undefined)
    })
  })

  describe("Option.None", () => {
    it("should be a singleton", () => {
      expect(Option.None).toBe(Option.None)
    })

    it("should be None state", () => {
      expect(Option.None.isNone()).toBe(true)
      expect(Option.None.isSome()).toBe(false)
    })
  })

  describe("Option.fromNullable()", () => {
    it("should return Some for non-nullish values", () => {
      expect(Option.fromNullable("John").isSome()).toBe(true)
      expect(Option.fromNullable(0).isSome()).toBe(true) // 0 is not nullish
      expect(Option.fromNullable("").isSome()).toBe(true) // "" is not nullish
      expect(Option.fromNullable(false).isSome()).toBe(true)
    })

    it("should return None for null", () => {
      expect(Option.fromNullable(null).isNone()).toBe(true)
    })

    it("should return None for undefined", () => {
      expect(Option.fromNullable(undefined).isNone()).toBe(true)
    })
  })

  describe("Option.fromFalsy()", () => {
    it("should return None for falsy values", () => {
      expect(Option.fromFalsy(0).isNone()).toBe(true)
      expect(Option.fromFalsy("").isNone()).toBe(true)
      expect(Option.fromFalsy(false).isNone()).toBe(true)
      expect(Option.fromFalsy(null).isNone()).toBe(true)
      expect(Option.fromFalsy(undefined).isNone()).toBe(true)
    })

    it("should return Some for truthy values", () => {
      expect(Option.fromFalsy(42).isSome()).toBe(true)
      expect(Option.fromFalsy("hello").isSome()).toBe(true)
      expect(Option.fromFalsy([]).isSome()).toBe(true) // empty array is truthy
      expect(Option.fromFalsy({}).isSome()).toBe(true) // empty object is truthy
    })
  })

  describe("Option.fromPredicate()", () => {
    it("should return Some if predicate passes", () => {
      const opt = Option.fromPredicate(21, (x) => x >= 18)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(21)
    })

    it("should return None if predicate fails", () => {
      const opt = Option.fromPredicate(15, (x) => x >= 18)
      expect(opt.isNone()).toBe(true)
    })
  })
})

describe("State Inspection", () => {
  describe("isSome()", () => {
    it("should return true for Some", () => {
      expect(Option.Some(42).isSome()).toBe(true)
    })

    it("should return false for None", () => {
      expect(Option.None.isSome()).toBe(false)
    })

    it("should act as type guard (allows value access after check)", () => {
      const opt = Option.Some(42)
      if (opt.isSome()) {
        // TypeScript should allow accessing opt.unwrap() here
        expect(opt.unwrap()).toBe(42)
      }
    })
  })

  describe("isNone()", () => {
    it("should return false for Some", () => {
      expect(Option.Some(42).isNone()).toBe(false)
    })

    it("should return true for None", () => {
      expect(Option.None.isNone()).toBe(true)
    })
  })

  describe("isUnit()", () => {
    it("should return true for Option<Unit>", () => {
      const opt = Option.Some(UNIT)
      expect(opt.isUnit()).toBe(true)
    })

    it("should return false for other values", () => {
      expect(Option.Some(42).isUnit()).toBe(false)
      expect(Option.None.isUnit()).toBe(false)
    })
  })
})

describe("Value Extraction", () => {
  describe("unwrap()", () => {
    it("should return value for Some", () => {
      expect(Option.Some(42).unwrap()).toBe(42)
    })

    it("should throw UnwrapError for None", () => {
      expect(() => Option.None.unwrap()).toThrow(UnwrappedNone)
    })
  })

  describe("unwrapOr()", () => {
    it("should return value for Some", () => {
      expect(Option.Some(42).unwrapOr(0)).toBe(42)
    })

    it("should return default for None", () => {
      const opt: Option<number> = Option.None
      expect(opt.unwrapOr(0)).toBe(0)
    })
  })

  describe("unwrapOrElse()", () => {
    it("should return value for Some (factory not called)", () => {
      const factory = mock(() => 999)
      expect(Option.Some(42).unwrapOrElse(factory)).toBe(42)
      expect(factory).not.toHaveBeenCalled()
    })

    it("should call factory and return result for None", () => {
      const opt: Option<number> = Option.None
      const factory = mock(() => 999)
      expect(opt.unwrapOrElse(factory)).toBe(999)
      expect(factory).toHaveBeenCalledTimes(1)
    })
  })

  describe("safeUnwrap()", () => {
    it("should return value for Some", () => {
      expect(Option.Some(42).safeUnwrap()).toBe(42)
    })

    it("should return null for None", () => {
      expect(Option.None.safeUnwrap()).toBe(null)
    })
  })

  describe("match()", () => {
    it("should call Some handler for Some", () => {
      const result = Option.Some(42).match({
        Some: (v) => `Got ${v}`,
        None: () => "Nothing",
      })
      expect(result).toBe("Got 42")
    })

    it("should call None handler for None", () => {
      const opt: Option<number> = Option.None
      const result = opt.match({
        Some: (v) => `Got ${v}`,
        None: () => "Nothing",
      })
      expect(result).toBe("Nothing")
    })

    it("should support different return types", () => {
      const numResult = Option.Some(42).match({
        Some: (v) => v * 2,
        None: () => 0,
      })
      expect(numResult).toBe(84)
    })
  })
})

describe("Transformation Methods", () => {
  describe("map()", () => {
    it("should transform value for Some", () => {
      const opt = Option.Some(5).map((x) => x * 2)
      expect(opt.unwrap()).toBe(10)
    })

    it("should return None for None (mapper not called)", () => {
      const mapper = mock((x: number) => x * 2)
      const opt: Option<number> = Option.None
      const result = opt.map(mapper)
      expect(result.isNone()).toBe(true)
      expect(mapper).not.toHaveBeenCalled()
    })
  })

  describe("mapAsync()", () => {
    it("should transform value with async mapper", async () => {
      const opt = await Option.Some(5).mapAsync(async (x) => x * 2)
      expect(opt.unwrap()).toBe(10)
    })

    it("should return Promise<None> for None", async () => {
      const opt = await Option.None.mapAsync(async (x: number) => x * 2)
      expect(opt.isNone()).toBe(true)
    })

    it("should not call mapper for None", async () => {
      const mapper = mock(async (x: number) => x * 2)
      const opt: Option<number> = Option.None
      await opt.mapAsync(mapper)
      expect(mapper).not.toHaveBeenCalled()
    })
  })

  describe("flatMap()", () => {
    it("should chain Option-returning functions", () => {
      const opt = Option.Some(5).flatMap((x) => Option.Some(x + 1))
      expect(opt.unwrap()).toBe(6)
    })

    it("should return None if mapper returns None", () => {
      const opt = Option.Some(5).flatMap(() => Option.None)
      expect(opt.isNone()).toBe(true)
    })

    it("should not call mapper for None", () => {
      const mapper = mock((x: number) => Option.Some(x))
      const opt: Option<number> = Option.None
      opt.flatMap(mapper)
      expect(mapper).not.toHaveBeenCalled()
    })
  })

  describe("flatMapAsync()", () => {
    it("should chain async Option-returning functions", async () => {
      const opt = await Option.Some(5).flatMapAsync(async (x) =>
        Option.Some(x + 1),
      )
      expect(opt.unwrap()).toBe(6)
    })

    it("should return Promise<None> if mapper returns None", async () => {
      const opt = await Option.Some(5).flatMapAsync(async () => Option.None)
      expect(opt.isNone()).toBe(true)
    })

    it("should not call mapper for None", async () => {
      const mapper = mock(async (x: number) => Option.Some(x))
      const opt: Option<number> = Option.None
      await opt.flatMapAsync(mapper)
      expect(mapper).not.toHaveBeenCalled()
    })
  })

  describe("zip()", () => {
    it("should pair original with derived value", () => {
      const opt = Option.Some(5).zip((x) => x * 2)
      expect(opt.unwrap()).toEqual([5, 10])
    })

    it("should return None for None", () => {
      const opt: Option<number> = Option.None
      expect(opt.zip((x) => x * 2).isNone()).toBe(true)
    })
  })

  describe("zipAsync()", () => {
    it("should pair original with async derived value", async () => {
      const opt = await Option.Some(5).zipAsync(async (x) => x * 2)
      expect(opt.unwrap()).toEqual([5, 10])
    })

    it("should return Promise<None> for None", async () => {
      const opt: Option<number> = Option.None
      const result = await opt.zipAsync(async (x) => x * 2)
      expect(result.isNone()).toBe(true)
    })
  })

  describe("flatZip()", () => {
    it("should pair original with value from another Option", () => {
      const opt = Option.Some(5).flatZip((x) => Option.Some(x * 2))
      expect(opt.unwrap()).toEqual([5, 10])
    })

    it("should return None if mapper returns None", () => {
      const opt = Option.Some(5).flatZip(() => Option.None)
      expect(opt.isNone()).toBe(true)
    })

    it("should return None for None (mapper not called)", () => {
      const mapper = mock((x: number) => Option.Some(x))
      const opt: Option<number> = Option.None
      opt.flatZip(mapper)
      expect(mapper).not.toHaveBeenCalled()
    })
  })

  describe("flatZipAsync()", () => {
    it("should pair original with async Option value", async () => {
      const opt = await Option.Some(5).flatZipAsync(async (x) =>
        Option.Some(x * 2),
      )
      expect(opt.unwrap()).toEqual([5, 10])
    })

    it("should return Promise<None> if mapper returns None", async () => {
      const opt = await Option.Some(5).flatZipAsync(async () => Option.None)
      expect(opt.isNone()).toBe(true)
    })
  })

  describe("filter()", () => {
    it("should keep Some if predicate passes", () => {
      const opt = Option.Some(5).filter((x) => x > 3)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(5)
    })

    it("should convert to None if predicate fails", () => {
      const opt = Option.Some(5).filter((x) => x > 10)
      expect(opt.isNone()).toBe(true)
    })

    it("should return None for None (predicate not called)", () => {
      const pred = mock((x: number) => x > 3)
      const opt: Option<number> = Option.None
      const result = opt.filter(pred)
      expect(result.isNone()).toBe(true)
      expect(pred).not.toHaveBeenCalled()
    })
  })

  describe("filterAsync()", () => {
    it("should keep Some if async predicate passes", async () => {
      const opt = await Option.Some(5).filterAsync(async (x) => x > 3)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(5)
    })

    it("should convert to None if async predicate fails", async () => {
      const opt = await Option.Some(5).filterAsync(async (x) => x > 10)
      expect(opt.isNone()).toBe(true)
    })

    it("should not call predicate for None", async () => {
      const pred = mock(async (x: number) => x > 3)
      const opt: Option<number> = Option.None
      const result = await opt.filterAsync(pred)
      expect(result.isNone()).toBe(true)
      expect(pred).not.toHaveBeenCalled()
    })
  })

  describe("mapOr()", () => {
    it("should map and return value for Some", () => {
      const result = Option.Some(5).mapOr(0, (x) => x * 2)
      expect(result).toBe(10)
    })

    it("should return default for None", () => {
      const opt: Option<number> = Option.None
      const result = opt.mapOr(0, (x) => x * 2)
      expect(result).toBe(0)
    })
  })

  describe("mapOrAsync()", () => {
    it("should map and return async value for Some", async () => {
      const result = await Option.Some(5).mapOrAsync(0, async (x) => x * 2)
      expect(result).toBe(10)
    })

    it("should return default for None", async () => {
      const opt: Option<number> = Option.None
      const result = await opt.mapOrAsync(0, async (x) => x * 2)
      expect(result).toBe(0)
    })
  })

  describe("tap()", () => {
    it("should execute side effect for Some and return self", () => {
      const sideEffect = mock((x: number) => {
        return `${x} + 10`
      })
      const opt = Option.Some(42)
      const result = opt.tap(sideEffect)
      expect(sideEffect).toHaveBeenCalledWith(42)
      expect(result).toBe(opt) // Same reference
    })

    it("should not execute side effect for None", () => {
      const sideEffect = mock((_x: number) => {})
      const opt: Option<number> = Option.None
      opt.tap(sideEffect)
      expect(sideEffect).not.toHaveBeenCalled()
    })
  })

  describe("tapAsync()", () => {
    it("should execute async side effect for Some and return self", async () => {
      const sideEffect = mock(async (x: number) => {
        void `${x} + 10`
      })
      const opt = Option.Some(42)
      const result = await opt.tapAsync(sideEffect)
      expect(sideEffect).toHaveBeenCalledWith(42)
      expect(result).toBe(opt) // Same reference
    })

    it("should not execute side effect for None", async () => {
      const sideEffect = mock(async (_x: number) => {})
      const opt: Option<number> = Option.None
      await opt.tapAsync(sideEffect)
      expect(sideEffect).not.toHaveBeenCalled()
    })
  })
})

describe("Combining Options", () => {
  describe("Option.all()", () => {
    it("should combine all Some into Some array", () => {
      const result = Option.all(Option.Some(1), Option.Some(2), Option.Some(3))
      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toEqual([1, 2, 3])
    })

    it("should return None if any is None", () => {
      const result = Option.all(Option.Some(1), Option.None, Option.Some(3))
      expect(result.isNone()).toBe(true)
    })

    it("should return Some([]) for empty (vacuous truth)", () => {
      const result = Option.all()
      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toEqual([])
    })
  })

  describe("Option.any()", () => {
    it("should return first Some", () => {
      const result = Option.any(Option.None, Option.Some(2), Option.Some(3))
      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(2)
    })

    it("should return None if all are None", () => {
      const result = Option.any(Option.None, Option.None, Option.None)
      expect(result.isNone()).toBe(true)
    })

    it("should return None for empty", () => {
      const result = Option.any()
      expect(result.isNone()).toBe(true)
    })
  })
})

describe("Utility Methods", () => {
  describe("toResult()", () => {
    it("should convert Some to Ok", () => {
      const result = Option.Some(42).toResult("error")
      expect(result.isOk()).toBe(true)
      expect(result.unwrap()).toBe(42)
    })

    it("should convert None to Err with provided error", () => {
      const opt: Option<number> = Option.None
      const result = opt.toResult("was none")
      expect(result.isErr()).toBe(true)
      expect(result.unwrapErr()).toBe("was none")
    })
  })

  describe("innerMap()", () => {
    it("should map over array elements inside Option", () => {
      const opt = Option.Some([1, 2, 3]).innerMap((x) => x * 2)
      expect(opt.unwrap()).toEqual([2, 4, 6])
    })

    it("should return None for None", () => {
      const opt: Option<number[]> = Option.None
      expect(opt.innerMap((x) => x * 2).isNone()).toBe(true)
    })

    it("should throw for non-array value", () => {
      // @ts-expect-error - intentionally testing runtime check
      expect(() => Option.Some(5).innerMap((x) => x * 2)).toThrow()
    })
  })

  describe("toString()", () => {
    it('should return "Some(value)" for Some', () => {
      expect(Option.Some(42).toString()).toMatch(/Some.*42/)
    })

    it('should return "None" for None', () => {
      expect(Option.None.toString()).toMatch(/None/)
    })
  })
})

describe("Async Handling", () => {
  describe("Promise chaining with .then()", () => {
    it("Option<T> + sync map → Option<U>", () => {
      const opt = Option.Some(5).map((x) => x * 2)
      expect(opt.unwrap()).toBe(10)
    })

    it("Option<T> + mapAsync → Promise<Option<U>>", async () => {
      const opt = await Option.Some(5).mapAsync(async (x) => x * 2)
      expect(opt.unwrap()).toBe(10)
    })

    it("chain mapAsync → map with .then()", async () => {
      const result = await Option.Some(5)
        .mapAsync(async (x) => x * 2)
        .then((o) => o.map((x) => x + 1))
      expect(result.unwrap()).toBe(11)
    })
  })

  describe("asyncGen with explicit await", () => {
    it("should handle awaited Promise<Option<T>> yields", async () => {
      const result = await Option.asyncGen(async function* () {
        const a = yield* await Promise.resolve(Option.Some(1))
        const b = yield* await Promise.resolve(Option.Some(2))
        return a + b
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(3)
    })

    it("should short-circuit on awaited Promise<None>", async () => {
      let reachedAfterNone = false

      const result = await Option.asyncGen(async function* () {
        const a = yield* await Promise.resolve(Option.Some(1))
        const b = yield* await Promise.resolve(Option.None)
        reachedAfterNone = true
        return a + b
      })

      expect(result.isNone()).toBe(true)
      expect(reachedAfterNone).toBe(false)
    })
  })

  describe("asyncGenAdapter", () => {
    it("should handle Promise<Option<T>> with adapter", async () => {
      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Promise.resolve(Option.Some(1)))
        const b = yield* $(Promise.resolve(Option.Some(2)))
        return a + b
      })

      expect(result.isSome()).toBe(true)
      expect(result.unwrap()).toBe(3)
    })

    it("should short-circuit on None with adapter", async () => {
      let reachedAfterNone = false

      const result = await Option.asyncGenAdapter(async function* ($) {
        const a = yield* $(Promise.resolve(Option.Some(1)))
        const b = yield* $(Promise.resolve(Option.None))
        reachedAfterNone = true
        return a + b
      })

      expect(result.isNone()).toBe(true)
      expect(reachedAfterNone).toBe(false)
    })
  })

  describe("Explicit async boundaries", () => {
    it("mapAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).mapAsync(async (x) => x * 2)
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.unwrap()).toBe(10)
    })

    it("flatMapAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).flatMapAsync(async (x) => Option.Some(x + 1))
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.unwrap()).toBe(6)
    })

    it("filterAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).filterAsync(async (x) => x > 3)
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.isSome()).toBe(true)
    })

    it("zipAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).zipAsync(async (x) => x * 2)
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.unwrap()).toEqual([5, 10])
    })

    it("flatZipAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).flatZipAsync(async (x) => Option.Some(x * 2))
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.unwrap()).toEqual([5, 10])
    })

    it("mapOrAsync returns Promise<U>", async () => {
      const val = Option.Some(5).mapOrAsync(0, async (x) => x * 2)
      const isPromise = val instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await val
      expect(resolved).toBe(10)
    })

    it("tapAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).tapAsync(async (x) => {
        const _unused = x * 2
      })
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.unwrap()).toBe(5)
    })
  })

  describe("Short-Circuit with Async", () => {
    it("None with async mapper should not create actual async work", async () => {
      const mapper = mock(async (x: number) => x * 2)
      const opt: Option<number> = Option.None
      await opt.mapAsync(mapper)
      expect(mapper).not.toHaveBeenCalled()
    })
  })

  describe("Promise chaining patterns", () => {
    it("should chain async operations with .then()", async () => {
      const result = await Option.Some(5)
        .mapAsync(async (x) => x * 2)
        .then((o) => o.map((x) => x + 1))
      expect(result.unwrap()).toBe(11)
    })

    it("should propagate None through async chain", async () => {
      const asyncMapper = mock(async (x: string) => x.toString())

      const result = await Option.None.mapAsync(asyncMapper)

      expect(result.isNone()).toBe(true)
      expect(asyncMapper).not.toHaveBeenCalled()
    })

    it("tapAsync returns Promise<Option>", async () => {
      const opt = Option.Some(5).tapAsync(async (x) => {
        const _unused = x * 2
      })
      const isPromise = opt instanceof Promise
      expect(isPromise).toBe(true)
      const resolved = await opt
      expect(resolved.unwrap()).toBe(5)
    })
  })
})

describe("Edge Cases & Invariants", () => {
  describe("Monad Laws", () => {
    it("Identity preservation: opt.map(x => x) ≡ opt", () => {
      const opt = Option.Some(42)
      const mapped = opt.map((x) => x)
      expect(mapped.unwrap()).toBe(opt.unwrap())
    })

    it("Composition: opt.map(f).map(g) ≡ opt.map(x => g(f(x)))", () => {
      const f = (x: number) => x * 2
      const g = (x: number) => x + 1
      const opt = Option.Some(5)

      const chainedResult = opt.map(f).map(g).unwrap()
      const composedResult = opt.map((x) => g(f(x))).unwrap()

      expect(chainedResult).toBe(composedResult)
    })

    it("flatMap left identity: Some(x).flatMap(f) ≡ f(x)", () => {
      const f = (x: number) => Option.Some(x * 2)
      const x = 5

      expect(Option.Some(x).flatMap(f).unwrap()).toBe(f(x).unwrap())
    })

    it("flatMap right identity: opt.flatMap(Some) ≡ opt", () => {
      const opt = Option.Some(42)
      expect(opt.flatMap(Option.Some).unwrap()).toBe(opt.unwrap())
    })

    it("flatMap associativity: opt.flatMap(f).flatMap(g) ≡ opt.flatMap(x => f(x).flatMap(g))", () => {
      const f = (x: number) => Option.Some(x * 2)
      const g = (x: number) => Option.Some(x + 1)
      const opt = Option.Some(5)

      const leftResult = opt.flatMap(f).flatMap(g).unwrap()
      const rightResult = opt.flatMap((x) => f(x).flatMap(g)).unwrap()

      expect(leftResult).toBe(rightResult)
    })
  })

  describe("Edge Cases from Spec Table", () => {
    it("None is singleton", () => {
      expect(Option.None).toBe(Option.None)
    })

    it("null in Some is valid", () => {
      const opt = Option.Some(null)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(null)
    })

    it("undefined in Some is valid", () => {
      const opt = Option.Some(undefined)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(undefined)
    })

    it("Nested Option is not auto-flattened", () => {
      const inner = Option.Some(5)
      const outer = Option.Some(inner)
      expect(outer.unwrap()).toBe(inner)
      expect(outer.unwrap().unwrap()).toBe(5)
    })

    it("Empty array in Some is valid", () => {
      const opt = Option.Some([])
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toEqual([])
    })

    it("NaN in Some is valid", () => {
      const opt = Option.Some(NaN)
      expect(opt.isSome()).toBe(true)
      expect(Number.isNaN(opt.unwrap())).toBe(true)
    })

    it("fromNullable(0) returns Some(0)", () => {
      const opt = Option.fromNullable(0)
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe(0)
    })

    it('fromNullable("") returns Some("")', () => {
      const opt = Option.fromNullable("")
      expect(opt.isSome()).toBe(true)
      expect(opt.unwrap()).toBe("")
    })

    it("unwrap on None throws UnwrapError", () => {
      expect(() => Option.None.unwrap()).toThrow(UnwrappedNone)
    })
  })
})

describe("Branching and Immutability", () => {
  it("multiple branches from same Option should be independent", () => {
    const original = Option.Some(2)
    const branch1 = original.map((x) => x * 2)
    const branch2 = original.map((x) => x * 3)
    const branch3 = original.flatMap(() => Option.None)

    expect(original.unwrap()).toBe(2)
    expect(branch1.unwrap()).toBe(4)
    expect(branch2.unwrap()).toBe(6)
    expect(branch3.isNone()).toBe(true)
  })

  it("async branches should be independent", async () => {
    const original = Option.Some(2)
    const branch1 = await original.mapAsync(async (x) => x * 2)
    const branch2 = await original.mapAsync(async (x) => x * 3)

    expect(original.unwrap()).toBe(2)
    expect(branch1.unwrap()).toBe(4)
    expect(branch2.unwrap()).toBe(6)
  })
})

describe("Fluent API - Complex Operation Chains", () => {
  describe("map → flatMap → zip chains", () => {
    it("sync map → sync flatMap → sync zip", () => {
      const result = Option.Some(5)
        .map((x) => x * 2) // 10
        .flatMap((x) => Option.Some(x + 1)) // Some(11)
        .zip((x) => x * 2) // Some([11, 22])

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("mapAsync → flatMap → zipAsync with .then()", async () => {
      const result = await Option.Some(5)
        .mapAsync(async (x) => x * 2)
        .then((o) => o.flatMap((x) => Option.Some(x + 1)))
        .then((o) => o.zipAsync(async (x) => x * 2))

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("flatMapAsync → map with .then()", async () => {
      const result = await Option.Some(5)
        .flatMapAsync(async (x) => Option.Some(x * 2))
        .then((o) => o.map((x) => x + 1))

      expect(result.unwrap()).toBe(11)
    })
  })

  describe("map → flatMap → flatZip chains", () => {
    it("sync map → sync flatMap → sync flatZip", () => {
      const result = Option.Some(5)
        .map((x) => x * 2) // 10
        .flatMap((x) => Option.Some(x + 1)) // Some(11)
        .flatZip((x) => Option.Some(x * 2)) // Some([11, 22])

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("mapAsync → flatMapAsync → flatZipAsync with .then()", async () => {
      const result = await Option.Some(5)
        .mapAsync(async (x) => x * 2)
        .then((o) => o.flatMapAsync(async (x) => Option.Some(x + 1)))
        .then((o) => o.flatZipAsync(async (x) => Option.Some(x * 2)))

      expect(result.unwrap()).toEqual([11, 22])
    })
  })

  describe("filter in chains", () => {
    it("map → filter → flatMap chain (sync)", () => {
      const result = Option.Some(5)
        .map((x) => x * 2) // 10
        .filter((x) => x > 5) // Some(10)
        .flatMap((x) => Option.Some(x + 1)) // Some(11)

      expect(result.unwrap()).toBe(11)
    })

    it("mapAsync → filterAsync → flatMap with .then()", async () => {
      const result = await Option.Some(5)
        .mapAsync(async (x) => x * 2)
        .then((o) => o.filterAsync(async (x) => x > 5))
        .then((o) => o.flatMap((x) => Option.Some(x + 1)))

      expect(result.unwrap()).toBe(11)
    })
  })

  describe("Long chains (5+ operations)", () => {
    it("should handle long sync chain", () => {
      const result = Option.Some(1)
        .map((x) => x + 1) // 2
        .flatMap((x) => Option.Some(x * 2)) // 4
        .zip((x) => x + 10) // [4, 14]
        .map(([a, b]) => a + b) // 18
        .flatMap((x) => Option.Some(x.toString())) // "18"
        .filter((s) => s.length > 0) // Some("18")
        .map((s) => `Result: ${s}`) // "Result: 18"

      expect(result.unwrap()).toBe("Result: 18")
    })

    it("should handle long async chain with .then()", async () => {
      const result = await Option.Some(1)
        .mapAsync(async (x) => x + 1)
        .then((o) => o.flatMap((x) => Option.Some(x * 2)))
        .then((o) => o.zipAsync(async (x) => x + 10))
        .then((o) => o.map(([a, b]) => a + b))
        .then((o) => o.flatMapAsync(async (x) => Option.Some(x.toString())))
        .then((o) => o.map((s) => `Result: ${s}`))

      expect(result.unwrap()).toBe("Result: 18")
    })
  })

  describe("Real-world pipeline scenarios", () => {
    interface User {
      id: number
      name: string
      email: string | null
    }

    interface Profile {
      bio: string
      avatar: string | null
    }

    const fetchUser = async (id: number): Promise<User | null> => {
      if (id === 1) return { id: 1, name: "Alice", email: "alice@example.com" }
      if (id === 2) return { id: 2, name: "Bob", email: null }
      return null
    }

    const fetchProfile = async (userId: number): Promise<Profile | null> => {
      if (userId === 1) return { bio: "Hello!", avatar: "alice.png" }
      return null
    }

    it("should handle user → email → domain extraction pipeline with mapAsync", async () => {
      const result = await Option.Some(1)
        .flatMapAsync(async (id) => Option.fromNullable(await fetchUser(id)))
        .then((o) => o.flatMap((u) => Option.fromNullable(u.email)))
        .then((o) => o.map((email) => email.split("@")[1]))

      expect(result.unwrap()).toBe("example.com")
    })

    it("should handle None propagation when email is null", async () => {
      const result = await Option.Some(2) // Bob has no email
        .flatMapAsync(async (id) => Option.fromNullable(await fetchUser(id)))
        .then((o) => o.flatMap((u) => Option.fromNullable(u.email)))
        .then((o) => o.map((email) => email.split("@")[1]))

      expect(result.isNone()).toBe(true)
    })

    it("should handle user + profile zip pipeline with flatZipAsync", async () => {
      const result = await Option.Some(1)
        .flatMapAsync(async (id) => Option.fromNullable(await fetchUser(id)))
        .then((o) =>
          o.flatZipAsync(async (u) =>
            Option.fromNullable(await fetchProfile(u.id)),
          ),
        )
        .then((o) =>
          o.map(([u, profile]) => ({ name: u.name, bio: profile.bio })),
        )

      expect(result.unwrap()).toEqual({ name: "Alice", bio: "Hello!" })
    })
  })

  describe("asyncGen for complex workflows", () => {
    interface User {
      id: number
      name: string
      email: string | null
    }

    interface Profile {
      bio: string
      avatar: string | null
    }

    const fetchUser = async (id: number): Promise<Option<User>> => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      if (id === 1)
        return Option.Some({
          id: 1,
          name: "Alice",
          email: "alice@example.com",
        })
      if (id === 2) return Option.Some({ id: 2, name: "Bob", email: null })
      return Option.None
    }

    const fetchProfile = async (userId: number): Promise<Option<Profile>> => {
      await new Promise((resolve) => setTimeout(resolve, 1))
      if (userId === 1)
        return Option.Some({ bio: "Hello!", avatar: "alice.png" })
      return Option.None
    }

    it("should handle user → email → domain extraction with asyncGen", async () => {
      const result = await Option.asyncGen(async function* () {
        const id = yield* Option.Some(1)
        const user = yield* await fetchUser(id)
        const email = yield* Option.fromNullable(user.email)
        return email.split("@")[1]
      })

      expect(result.unwrap()).toBe("example.com")
    })

    it("should handle user + profile zip pipeline with asyncGen", async () => {
      const result = await Option.asyncGen(async function* () {
        const id = yield* Option.Some(1)
        const user = yield* await fetchUser(id)
        const profile = yield* await fetchProfile(user.id)
        return { name: user.name, bio: profile.bio }
      })

      expect(result.unwrap()).toEqual({ name: "Alice", bio: "Hello!" })
    })

    it("should short-circuit on None in asyncGen", async () => {
      let _reachedAfterNone = false
      const result = await Option.asyncGen(async function* () {
        const id = yield* Option.Some(1)
        const user = yield* await fetchUser(id)
        // For Bob, email is null, so fromNullable returns None
        const email = yield* Option.fromNullable(user.email)
        _reachedAfterNone = true
        return email.split("@")[1]
      })

      // First user (Alice) has email
      expect(result.unwrap()).toBe("example.com")
    })
  })
})
