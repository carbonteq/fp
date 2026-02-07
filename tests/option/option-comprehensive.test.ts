import { describe, expect, it, mock } from "bun:test"
import { Option, UnwrappedNone } from "@/option.js"
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

  describe("Option.fromPromise()", () => {
    it("should wrap Promise<Option<T>> as Option<Promise<T>>", async () => {
      const asyncOpt = Option.fromPromise(Promise.resolve(Option.Some(42)))
      expect(asyncOpt.isSome()).toBe(true)

      const resolved = await asyncOpt.toPromise()
      expect(resolved.unwrap()).toBe(42)
    })

    it("should properly handle Promise<None>", async () => {
      const asyncOpt = Option.fromPromise(Promise.resolve(Option.None))
      const resolved = await asyncOpt.toPromise()
      expect(resolved.isNone()).toBe(true)
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

    it("should handle async mapper on sync value -> Option<Promise<U>>", async () => {
      const opt = Option.Some(5).map(async (x) => x * 2)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(10)
    })

    it("should handle sync mapper on async value -> Option<Promise<U>>", async () => {
      const opt = Option.Some(Promise.resolve(5)).map((x) => x * 2)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(10)
    })

    it("should handle async mapper on async value -> Option<Promise<U>>", async () => {
      const opt = Option.Some(Promise.resolve(5)).map(async (x) => x * 2)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(10)
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

    it("should handle async flatMap", async () => {
      const opt = Option.Some(5).flatMap(async (x) => Option.Some(x + 1))
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(6)
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

    it("should handle async zip", async () => {
      const opt = Option.Some(5).zip(async (x) => x * 2)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toEqual([5, 10])
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

    it("should handle async predicate", async () => {
      const opt = Option.Some(5).filter(async (x) => x > 3)
      const resolved = await opt.toPromise()
      expect(resolved.isSome()).toBe(true)
      expect(resolved.unwrap()).toBe(5)
    })
  })

  describe("mapOr()", () => {
    it("should map and return value for Some", () => {
      const result = Option.Some(5).mapOr(0, (x) => x * 2)
      expect(result).toBe(10)
    })

    it("should support async mapper for Some", async () => {
      const result = await Option.Some(5).mapOr(0, async (x) => x * 2)
      expect(result).toBe(10)
    })

    it("should return default for None", () => {
      const opt: Option<number> = Option.None
      const result = opt.mapOr(0, (x) => x * 2)
      expect(result).toBe(0)
    })

    it("should return default for None with async mapper", async () => {
      const opt: Option<number> = Option.None
      const mapper = mock(async (x: number) => x * 2)
      const result = await opt.mapOr(0, mapper)

      expect(result).toBe(0)
      expect(mapper).not.toHaveBeenCalled()
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

    it("should prefer immediate Some over pending Promise<None>", async () => {
      const pendingNone = Option.fromPromise(
        new Promise<Option<number>>((resolve) => {
          setTimeout(() => resolve(Option.None), 10)
        }),
      )
      const immediateSome = Option.Some(Promise.resolve(7))

      const result = Option.any(pendingNone, immediateSome)
      const resolved = await result.toPromise()

      expect(resolved.isSome()).toBe(true)
      expect(resolved.unwrap()).toBe(7)
    })
  })
})

describe("Utility Methods", () => {
  describe("tap()", () => {
    it("should execute side effect for Some and return self", () => {
      const sideEffect = mock((x: number) => {
        console.log(x)
      })
      const opt = Option.Some(42)
      const result = opt.tap(sideEffect)
      expect(sideEffect).toHaveBeenCalledWith(42)
      expect(result).toBe(opt) // Same reference
    })

    it("should not execute side effect for None", () => {
      const sideEffect = mock((x: number) => {
        console.log(x)
      })
      const opt: Option<number> = Option.None
      opt.tap(sideEffect)
      expect(sideEffect).not.toHaveBeenCalled()
    })
  })

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

  describe("toPromise()", () => {
    it("should resolve inner Promise and maintain Option structure", async () => {
      const opt = Option.Some(Promise.resolve(42))
      const resolved = await opt.toPromise()
      expect(resolved.isSome()).toBe(true)
      expect(resolved.unwrap()).toBe(42)
    })

    it("should wrap sync Option in resolved Promise", async () => {
      const opt = Option.Some(42)
      const resolved = await opt.toPromise()
      expect(resolved.isSome()).toBe(true)
      expect(resolved.unwrap()).toBe(42)
    })

    it("should resolve None to None", async () => {
      const resolved = await Option.None.toPromise()
      expect(resolved.isNone()).toBe(true)
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
  describe("Promise Infection Rules", () => {
    it("Option<T> + sync mapper → Option<U>", () => {
      const opt = Option.Some(5).map((x) => x * 2)
      // Type should be Option<number>, not Option<Promise<number>>
      expect(opt.unwrap()).toBe(10)
    })

    it("Option<T> + async mapper → Option<Promise<U>>", async () => {
      const opt = Option.Some(5).map(async (x) => x * 2)
      // Need toPromise() to resolve
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(10)
    })

    it("Option<Promise<T>> + sync mapper → Option<Promise<U>>", async () => {
      const opt = Option.Some(Promise.resolve(5)).map((x) => x * 2)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(10)
    })

    it("Option<Promise<T>> + async mapper → Option<Promise<U>>", async () => {
      const opt = Option.Some(Promise.resolve(5)).map(async (x) => x * 2)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(10)
    })
  })

  describe("Short-Circuit with Async", () => {
    it("None with async mapper should not create actual async work", async () => {
      const mapper = mock(async (x: number) => x * 2)
      const opt: Option<number> = Option.None
      opt.map(mapper)
      expect(mapper).not.toHaveBeenCalled()
    })

    it("None.toPromise() should resolve to None immediately", async () => {
      const start = Date.now()
      const resolved = await Option.None.toPromise()
      const elapsed = Date.now() - start
      expect(resolved.isNone()).toBe(true)
      expect(elapsed).toBeLessThan(50) // Should be near-instant
    })
  })

  describe("Interleaved Sync/Async Chains", () => {
    it("should correctly type chain with mixed sync/async", async () => {
      const result = await Option.Some(5)
        .map((x) => x * 2) // sync: Option<number>
        .map(async (x) => x.toString()) // async: Option<Promise<string>>
        .map((s) => s.toUpperCase()) // sync lifted: Option<Promise<string>>
        .toPromise()

      expect(result.unwrap()).toBe("10")
    })

    it("should propagate None through mixed chain", async () => {
      const syncMapper = mock((x: number) => x * 2)
      const asyncMapper = mock(async (x: number) => x.toString())

      const result = await (Option.None as Option<number>)
        .map(syncMapper)
        .map(asyncMapper)
        .toPromise()

      expect(result.isNone()).toBe(true)
      expect(syncMapper).not.toHaveBeenCalled()
      expect(asyncMapper).not.toHaveBeenCalled()
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

  describe("Async Edge Cases", () => {
    it("Sync after async maintains Promise wrapper", async () => {
      const opt = Option.Some(5)
        .map(async (x) => x)
        .map((y) => y + 1)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(6)
    })

    it("Multiple async mappers do not double-wrap Promise", async () => {
      const opt = Option.Some(5)
        .map(async (x) => x)
        .map(async (y) => y)
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(5)
    })

    it("flatMap after async map is lifted", async () => {
      const opt = Option.Some(5)
        .map(async (x) => x)
        .flatMap((y) => Option.Some(y))
      const resolved = await opt.toPromise()
      expect(resolved.unwrap()).toBe(5)
    })

    it("toPromise on sync Option works", async () => {
      const resolved = await Option.Some(5).toPromise()
      expect(resolved.unwrap()).toBe(5)
    })

    it("toPromise on None resolves to None", async () => {
      const resolved = await Option.None.toPromise()
      expect(resolved.isNone()).toBe(true)
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
    const branch1 = await original.map(async (x) => x * 2).toPromise()
    const branch2 = await original.map(async (x) => x * 3).toPromise()

    expect(original.unwrap()).toBe(2)
    expect(branch1.unwrap()).toBe(4)
    expect(branch2.unwrap()).toBe(6)
  })
})

describe("Fluent API - Complex Mixed Operation Chains", () => {
  describe("map → flatMap → zip chains", () => {
    it("sync map → sync flatMap → sync zip", () => {
      const result = Option.Some(5)
        .map((x) => x * 2) // 10
        .flatMap((x) => Option.Some(x + 1)) // Some(11)
        .zip((x) => x * 2) // Some([11, 22])

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("async map → sync flatMap → async zip", async () => {
      const result = await Option.Some(5)
        .map(async (x) => x * 2) // Option<Promise<10>>
        .flatMap((x) => Option.Some(x + 1)) // Option<Promise<11>>
        .zip(async (x) => x * 2) // Option<Promise<[11, 22]>>
        .toPromise()

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("sync map → async flatMap → sync zip", async () => {
      const result = await Option.Some(5)
        .map((x) => x * 2) // Some(10)
        .flatMap(async (x) => Option.Some(x + 1)) // Option<Promise<11>>
        .zip((x) => x * 2) // Option<Promise<[11, 22]>>
        .toPromise()

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("async map → async flatMap → async zip", async () => {
      const result = await Option.Some(5)
        .map(async (x) => x * 2) // Option<Promise<10>>
        .flatMap(async (x) => Option.Some(x + 1)) // Option<Promise<11>>
        .zip(async (x) => x * 2) // Option<Promise<[11, 22]>>
        .toPromise()

      expect(result.unwrap()).toEqual([11, 22])
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

    it("async map → sync flatMap → async flatZip", async () => {
      const result = await Option.Some(5)
        .map(async (x) => x * 2)
        .flatMap((x) => Option.Some(x + 1))
        .flatZip(async (x) => Option.Some(x * 2))
        .toPromise()

      expect(result.unwrap()).toEqual([11, 22])
    })

    it("sync map → async flatMap → sync flatZip", async () => {
      const result = await Option.Some(5)
        .map((x) => x * 2)
        .flatMap(async (x) => Option.Some(x + 1))
        .flatZip((x) => Option.Some(x * 2))
        .toPromise()

      expect(result.unwrap()).toEqual([11, 22])
    })
  })

  describe("filter in mixed chains", () => {
    it("map → filter → flatMap chain (sync)", () => {
      const result = Option.Some(5)
        .map((x) => x * 2) // 10
        .filter((x) => x > 5) // Some(10)
        .flatMap((x) => Option.Some(x + 1)) // Some(11)

      expect(result.unwrap()).toBe(11)
    })

    it("async map → toPromise → filter → flatMap chain", async () => {
      // Note: filter after async requires resolving promise first
      const intermediate = await Option.Some(5)
        .map(async (x) => x * 2)
        .toPromise()

      const result = intermediate
        .filter((x) => x > 5)
        .flatMap((x) => Option.Some(x + 1))

      expect(result.unwrap()).toBe(11)
    })

    it("filter with async predicate on sync value", async () => {
      const result = await Option.Some(10)
        .filter(async (x) => x > 5)
        .map((x) => x + 1) // x is still the original value since filter passed
        .toPromise()

      expect(result.unwrap()).toBe(11)
    })

    it("filter failing with async predicate returns None", async () => {
      const result = await Option.Some(3)
        .filter(async (x) => x > 5)
        .map((x) => x + 1)
        .toPromise()

      expect(result.isNone()).toBe(true)
    })
  })

  describe("flatMap returning None in chains", () => {
    it("chain should short-circuit at None from flatMap", async () => {
      const afterNoneMapper = mock((x: number) => x * 2)

      const result = await Option.Some(5)
        .map(async (x) => x * 2)
        .flatMap(() => Option.None as Option<number>)
        .map(afterNoneMapper)
        .toPromise()

      expect(result.isNone()).toBe(true)
      expect(afterNoneMapper).not.toHaveBeenCalled()
    })

    it("async flatMap returning None should short-circuit", async () => {
      const afterNoneMapper = mock((x: number) => x * 2)

      const result = await Option.Some(5)
        .map((x) => x * 2)
        .flatMap(async () => Option.None as Option<number>)
        .map(afterNoneMapper)
        .toPromise()

      expect(result.isNone()).toBe(true)
      expect(afterNoneMapper).not.toHaveBeenCalled()
    })
  })

  describe("Long mixed chains (5+ operations)", () => {
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

    it("should handle long async chain", async () => {
      const result = await Option.Some(1)
        .map(async (x) => x + 1) // Promise<2>
        .flatMap((x) => Option.Some(x * 2)) // Promise<4>
        .zip(async (x) => x + 10) // Promise<[4, 14]>
        .map(([a, b]) => a + b) // Promise<18>
        .flatMap(async (x) => Option.Some(x.toString())) // Promise<"18">
        .map((s) => `Result: ${s}`) // Promise<"Result: 18">
        .toPromise()

      expect(result.unwrap()).toBe("Result: 18")
    })

    it("should handle alternating sync/async chain", async () => {
      const result = await Option.Some(1)
        .map((x) => x + 1) // sync: 2
        .map(async (x) => x * 2) // async: 4
        .flatMap((x) => Option.Some(x + 1)) // sync lifted: 5
        .flatMap(async (x) => Option.Some(x * 2)) // async: 10
        .zip((x) => x.toString()) // sync lifted: [10, "10"]
        .zip(async ([_, s]) => s.length) // async: [[10, "10"], 2]
        .toPromise()

      expect(result.unwrap()).toEqual([[10, "10"], 2])
    })
  })

  describe("flatZip returning None in chains", () => {
    it("flatZip returning None should propagate None", async () => {
      const afterNoneMapper = mock((x: [number, number]) => x[0] + x[1])

      const result = await Option.Some(5)
        .map(async (x) => x * 2)
        .flatZip(() => Option.None as Option<number>)
        .map(afterNoneMapper)
        .toPromise()

      expect(result.isNone()).toBe(true)
      expect(afterNoneMapper).not.toHaveBeenCalled()
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

    it("should handle user → email → domain extraction pipeline", async () => {
      const result = await Option.Some(1)
        .map(async (id) => fetchUser(id))
        .flatMap((user) => Option.fromNullable(user))
        .flatMap((user) => Option.fromNullable(user.email))
        .map((email) => email.split("@")[1])
        .toPromise()

      expect(result.unwrap()).toBe("example.com")
    })

    it("should handle None propagation when email is null", async () => {
      const result = await Option.Some(2) // Bob has no email
        .map(async (id) => fetchUser(id))
        .flatMap((user) => Option.fromNullable(user))
        .flatMap((user) => Option.fromNullable(user.email))
        .map((email) => email.split("@")[1])
        .toPromise()

      expect(result.isNone()).toBe(true)
    })

    it("should handle user + profile zip pipeline", async () => {
      const result = await Option.Some(1)
        .map(async (id) => fetchUser(id))
        .flatMap((user) => Option.fromNullable(user))
        .flatZip(async (user) =>
          Option.fromNullable(await fetchProfile(user.id)),
        )
        .map(([user, profile]) => ({
          name: user.name,
          bio: profile.bio,
        }))
        .toPromise()

      expect(result.unwrap()).toEqual({ name: "Alice", bio: "Hello!" })
    })
  })
})
