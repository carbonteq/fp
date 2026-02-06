import { describe, expect, expectTypeOf, it, mock } from "bun:test"
import {
  ExperimentalOption as Option,
  UnwrappedNone,
} from "@/option-experimental.js"
import type { ExperimentalResult as Result } from "@/result-experimental.js"

const doubleIt = (n: number) => n * 2
const doubleOptIt = (n: number) => Option.Some(n * 2)
const noneOptIt = (_n: number): Option<number> => Option.None

const asyncDoubleIt = async (n: number) => n * 2
const asyncDoubleOptIt = async (n: number) => Option.Some(n * 2)
const asyncOptNone = async (_n: number): Promise<Option<number>> => Option.None

describe("Experimental option construction", () => {
  it("should construct Some opt", () => {
    const opt = Option.Some(123456)

    expect(opt).not.toBeUndefined()
  })

  it("should construct None opt", () => {
    const opt = Option.None

    expect(opt).not.toBeUndefined()
  })
})

describe("option unwrapping", () => {
  it("should return value for Some", () => {
    const opt = Option.Some(123456)

    expect(opt.unwrap()).toBe(123456)
  })

  it("should throw UnwrappedNone on None", () => {
    const opt = Option.None

    expect(() => opt.unwrap()).toThrow(UnwrappedNone)
  })
})

describe("map behavior", () => {
  it("should double if some", () => {
    const opt = Option.Some(2)
    const mockedDouble = mock(doubleIt)
    const mapped = opt.map(mockedDouble)

    expect(opt.isSome()).toBeTrue()
    expect(mockedDouble).toHaveBeenCalledTimes(1)
    expect(mapped.unwrap()).toBe(4)
  })

  it("should double if some async (using mapAsync)", async () => {
    const opt = Option.Some(2)
    const mapped = await opt.mapAsync(asyncDoubleIt)

    expect(mapped.isSome()).toBeTrue()
    expect(mapped.unwrap()).toBe(4)
  })

  it("should not call mapper if None", () => {
    const opt: Option<number> = Option.None
    const mockedDouble = mock(doubleIt)
    const mapped = opt.map(mockedDouble)

    expect(mapped.isNone()).toBeTrue()
    expect(mockedDouble).not.toHaveBeenCalled()
  })

  it("should not call async mapper if None", async () => {
    const opt: Option<number> = Option.None

    const mockedDouble = mock(asyncDoubleIt)
    const mapped = await opt.mapAsync(mockedDouble)

    expect(mapped.isNone()).toBeTrue()
    expect(mockedDouble).not.toHaveBeenCalled()
  })
})

describe("flatMap behavior", () => {
  it("should call flatMappers if starting from Some", () => {
    const mockerA = mock(doubleOptIt)
    const mockerB = mock(doubleOptIt)

    const opt = Option.Some(3)
    const mapped = opt.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isSome()).toBeTrue()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
    expect(mapped.unwrap()).toBe(12)
  })

  it("should not call flatMappers if starting from None", () => {
    const mockerA = mock(doubleOptIt)
    const mockerB = mock(doubleOptIt)

    const opt = Option.None
    const mapped = opt.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isNone()).toBeTrue()
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })

  it("should not call flatMappers after encountering None", () => {
    const mockerA = mock(noneOptIt)
    const mockerB = mock(doubleOptIt)

    const opt = Option.Some(3)
    const mapped = opt.flatMap(mockerA).flatMap(mockerB)

    expect(mapped.isNone()).toBeTrue()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB, "called flatMap after None").not.toHaveBeenCalled()
  })
})

describe("flatMapAsync behavior", () => {
  it("should call async flatMappers if starting from Some", async () => {
    const mockerA = mock(asyncDoubleOptIt)
    const mockerB = mock(asyncDoubleOptIt)

    const opt = Option.Some(3)
    const mapped = await opt
      .flatMapAsync(mockerA)
      .then((o) => o.flatMapAsync(mockerB))

    expect(mapped.isSome()).toBeTrue()
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
    expect(mapped.unwrap()).toBe(12)
  })

  it("should not call async flatMappers if starting from None", async () => {
    const mockerA = mock(asyncDoubleOptIt)
    const mockerB = mock(asyncDoubleOptIt)

    const opt = Option.None
    const mapped = await opt
      .flatMapAsync(mockerA)
      .then((o) => o.flatMapAsync(mockerB))

    expect(mapped.isNone()).toBeTrue()
    expect(mockerA).not.toHaveBeenCalled()
    expect(mockerB).not.toHaveBeenCalled()
  })
})

describe("filter behavior", () => {
  it("should filter sync values", () => {
    const opt = Option.Some(2)
    const filtered = opt.filter((n) => n > 10)

    expect(filtered.isNone()).toBeTrue()
  })

  it("should filter async values (using filterAsync)", async () => {
    const opt = Option.Some(2)
    const filtered = await opt.filterAsync(async (n) => n > 10)

    expect(filtered.isNone()).toBeTrue()
  })
})

describe("branching map", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2)
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)
    const mockerC = mock(noneOptIt)
    const o1 = o.map(mockerA)
    const o2 = o.map(mockerB)
    const o3 = o.flatMap(mockerC)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isSome()).toBeTrue()
    expect(o3.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toBe(4)
    expect(o2.unwrap()).toBe(4)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
    expect(mockerC).toHaveBeenCalledTimes(1)
  })

  it("two async branches should not affect parent or each other", async () => {
    const o = Option.Some(2)
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mockerC = mock(asyncOptNone)
    const o1 = await o.mapAsync(mockerA)
    const o2 = await o.mapAsync(mockerB)
    const o3 = await o.flatMapAsync(mockerC)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isSome()).toBeTrue()
    expect(o3.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toBe(4)
    expect(o2.unwrap()).toBe(4)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
    expect(mockerC).toHaveBeenCalledTimes(1)
  })
})

describe("branching flatMap", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2)
    const mockerA = mock(doubleOptIt)
    const mockerB = mock(noneOptIt)
    const o1 = o.flatMap(mockerA)
    const o2 = o.flatMap(mockerB)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toBe(4)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("two async branches should not affect parent or each other", async () => {
    const o = Option.Some(2)
    const mockerA = mock(asyncDoubleOptIt)
    const mockerB = mock(asyncOptNone)
    const o1 = await o.flatMapAsync(mockerA)
    const o2 = await o.flatMapAsync(mockerB)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toBe(4)
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })
})

describe("branching zip", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2)
    const mockerA = mock(doubleIt)
    const mockerB = mock(doubleIt)
    const mockerC = mock(noneOptIt)
    const o1 = o.zip(mockerA)
    const o2 = o.zip(mockerB)
    const o3 = o.flatMap(mockerC)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isSome()).toBeTrue()
    expect(o3.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toEqual([2, 4])
    expect(o2.unwrap()).toEqual([2, 4])
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
    expect(mockerC).toHaveBeenCalledTimes(1)
  })

  it("two async branches should not affect parent or each other", async () => {
    const o = Option.Some(2)
    const mockerA = mock(asyncDoubleIt)
    const mockerB = mock(asyncDoubleIt)
    const mockerC = mock(asyncOptNone)
    const o1 = await o.zipAsync(mockerA)
    const o2 = await o.zipAsync(mockerB)
    const o3 = await o.flatMapAsync(mockerC)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isSome()).toBeTrue()
    expect(o3.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toEqual([2, 4])
    expect(o2.unwrap()).toEqual([2, 4])
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
    expect(mockerC).toHaveBeenCalledTimes(1)
  })
})

describe("branching flatZip", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2)
    const mockerA = mock(doubleOptIt)
    const mockerB = mock(noneOptIt)
    const o1 = o.flatZip(mockerA)
    const o2 = o.flatZip(mockerB)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toEqual([2, 4])
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })

  it("two async branches should not affect parent or each other", async () => {
    const o = Option.Some(2)
    const mockerA = mock(asyncDoubleOptIt)
    const mockerB = mock(asyncOptNone)
    const o1 = await o.flatZipAsync(mockerA)
    const o2 = await o.flatZipAsync(mockerB)

    expect(o.isSome()).toBeTrue()
    expect(o1.isSome()).toBeTrue()
    expect(o2.isNone()).toBeTrue()
    expect(o.unwrap()).toBe(2)
    expect(o1.unwrap()).toEqual([2, 4])
    expect(mockerA).toHaveBeenCalledTimes(1)
    expect(mockerB).toHaveBeenCalledTimes(1)
  })
})

describe("Option type inference", () => {
  describe("construction", () => {
    it("should correctly type Some and None constructors", () => {
      expectTypeOf(Option.Some(42)).toEqualTypeOf<Option<number>>()
      expectTypeOf(Option.Some("hello")).toEqualTypeOf<Option<string>>()
      expectTypeOf(Option.None).toEqualTypeOf<Option<never>>()
    })

    it("should correctly type fromNullable", () => {
      const val: string | null = "hello"
      expectTypeOf(Option.fromNullable(val)).toEqualTypeOf<Option<string>>()

      // fromNullable strips null/undefined from the type
      const maybeNull: string | null | undefined = "test"
      expectTypeOf(Option.fromNullable(maybeNull)).toEqualTypeOf<
        Option<string>
      >()
    })

    it("should correctly type fromFalsy", () => {
      const val: string = "hello"
      expectTypeOf(Option.fromFalsy(val)).toEqualTypeOf<Option<string>>()
    })

    it("should correctly type fromPredicate", () => {
      expectTypeOf(Option.fromPredicate(42, (n) => n > 0)).toEqualTypeOf<
        Option<number>
      >()
    })
  })

  describe("type guards", () => {
    it("should narrow types with isSome", () => {
      const opt: Option<number> = Option.Some(42)

      if (opt.isSome()) {
        // After isSome(), _tag should be "Some"
        expectTypeOf(opt._tag).toEqualTypeOf<"Some">()
      }
    })

    it("should narrow types with isNone", () => {
      const opt: Option<number> = Option.Some(42)

      if (opt.isNone()) {
        // After isNone(), _tag should be "None"
        expectTypeOf(opt._tag).toEqualTypeOf<"None">()
      }
    })
  })

  describe("unwrapping", () => {
    it("should return correct types for unwrap methods", () => {
      const opt = Option.Some(42)

      expectTypeOf(opt.unwrap()).toEqualTypeOf<number>()
      expectTypeOf(opt.safeUnwrap()).toEqualTypeOf<number | null>()
      expectTypeOf(opt.unwrapOr(0)).toEqualTypeOf<number>()
      expectTypeOf(opt.unwrapOrElse(() => 0)).toEqualTypeOf<number>()
    })
  })

  describe("transformations", () => {
    it("should correctly type map with sync mapper", () => {
      const opt = Option.Some(42)

      // Sync mapper: Option<U>
      expectTypeOf(opt.map((n) => n.toString())).toEqualTypeOf<Option<string>>()
    })

    it("should correctly type mapAsync", () => {
      const opt = Option.Some(42)

      // Async mapper: Promise<Option<U>>
      expectTypeOf(opt.mapAsync(async (n) => n.toString())).toEqualTypeOf<
        Promise<Option<string>>
      >()
    })

    it("should correctly type flatMap with sync mapper", () => {
      const opt = Option.Some(42)

      // Sync flatMap: Option<U>
      expectTypeOf(opt.flatMap((n) => Option.Some(n.toString()))).toEqualTypeOf<
        Option<string>
      >()
    })

    it("should correctly type flatMapAsync", () => {
      const opt = Option.Some(42)

      // Async flatMap: Promise<Option<U>>
      expectTypeOf(
        opt.flatMapAsync(async (n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Promise<Option<string>>>()
    })

    it("should correctly type filter with sync predicate", () => {
      const opt = Option.Some(42)

      // Sync predicate: Option<T>
      expectTypeOf(opt.filter((n) => n > 0)).toEqualTypeOf<Option<number>>()
    })

    it("should correctly type filterAsync", () => {
      const opt = Option.Some(42)

      // Async predicate: Promise<Option<T>>
      expectTypeOf(opt.filterAsync(async (n) => n > 0)).toEqualTypeOf<
        Promise<Option<number>>
      >()
    })

    it("should correctly type mapOr", () => {
      const opt = Option.Some(42)

      // mapOr returns U directly (not Option<U>)
      expectTypeOf(
        opt.mapOr("default", (n) => n.toString()),
      ).toEqualTypeOf<string>()
    })

    it("should correctly type mapOrAsync", () => {
      const opt = Option.Some(42)

      // mapOrAsync returns Promise<U>
      expectTypeOf(
        opt.mapOrAsync("default", async (n) => n.toString()),
      ).toEqualTypeOf<Promise<string>>()
    })
  })

  describe("zip operations", () => {
    it("should correctly type zip with sync mapper", () => {
      const opt = Option.Some(42)

      // Sync zip: Option<[T, U]>
      expectTypeOf(opt.zip((n) => n.toString())).toEqualTypeOf<
        Option<[number, string]>
      >()
    })

    it("should correctly type zipAsync", () => {
      const opt = Option.Some(42)

      // Async zip: Promise<Option<[T, U]>>
      expectTypeOf(opt.zipAsync(async (n) => n.toString())).toEqualTypeOf<
        Promise<Option<[number, string]>>
      >()
    })

    it("should correctly type flatZip with sync mapper", () => {
      const opt = Option.Some(42)

      // Sync flatZip: Option<[T, U]>
      expectTypeOf(opt.flatZip((n) => Option.Some(n.toString()))).toEqualTypeOf<
        Option<[number, string]>
      >()
    })

    it("should correctly type flatZipAsync", () => {
      const opt = Option.Some(42)

      // Async flatZip: Promise<Option<[T, U]>>
      expectTypeOf(
        opt.flatZipAsync(async (n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Promise<Option<[number, string]>>>()
    })
  })

  describe("pattern matching", () => {
    it("should correctly type match with same return types", () => {
      const opt = Option.Some(42)

      // match returns U (the return type of both branches)
      expectTypeOf(
        opt.match({
          Some: (n) => n.toString(),
          None: () => "nothing",
        }),
      ).toEqualTypeOf<string>()
    })

    it("should correctly type match returning numbers", () => {
      const opt = Option.Some(42)

      expectTypeOf(
        opt.match({
          Some: (n) => n * 2,
          None: () => -1,
        }),
      ).toEqualTypeOf<number>()
    })

    it("should correctly type match returning booleans", () => {
      const opt = Option.Some(42)

      expectTypeOf(
        opt.match({
          Some: () => true,
          None: () => false,
        }),
      ).toEqualTypeOf<boolean>()
    })
  })

  describe("static combinators", () => {
    it("should correctly type all with same types", () => {
      const o1 = Option.Some(1)
      const o2 = Option.Some(2)

      expectTypeOf(Option.all(o1, o2)).toEqualTypeOf<Option<[number, number]>>()
    })

    it("should correctly type all with different types", () => {
      const o1 = Option.Some(1)
      const o2 = Option.Some("hello")

      // all combines into tuple
      expectTypeOf(Option.all(o1, o2)).toEqualTypeOf<Option<[number, string]>>()
    })

    it("should correctly type all with three options", () => {
      const o1 = Option.Some(1)
      const o2 = Option.Some("hello")
      const o3 = Option.Some(true)

      expectTypeOf(Option.all(o1, o2, o3)).toEqualTypeOf<
        Option<[number, string, boolean]>
      >()
    })

    it("should correctly type any", () => {
      const o1 = Option.Some(1)
      const o2 = Option.Some(2)

      // any returns first Some
      expectTypeOf(Option.any(o1, o2)).toEqualTypeOf<Option<number>>()
    })
  })

  describe("complex chains", () => {
    it("should correctly type chained map and flatMap", () => {
      const opt = Option.Some(42)

      // Chain: map -> flatMap
      const chained = opt
        .map((n) => n * 2)
        .flatMap((n) => Option.Some(n.toString()))

      expectTypeOf(chained).toEqualTypeOf<Option<string>>()
    })

    it("should correctly type chained transformations with zip", () => {
      const opt = Option.Some(42)

      // Chain: map -> flatMap -> zip
      const chained = opt
        .map((n) => n * 2)
        .flatMap((n) => Option.Some(n.toString()))
        .zip((s) => s.length)

      expectTypeOf(chained).toEqualTypeOf<Option<[string, number]>>()
    })

    it("should correctly type async chains with mapAsync", async () => {
      const opt = Option.Some(42)

      // Chain with async
      const chained = await opt.mapAsync(async (n) => n * 2)

      expectTypeOf(chained).toEqualTypeOf<Option<number>>()
    })

    it("should correctly type async chains with flatMapAsync", async () => {
      const opt = Option.Some(42)

      const chained = await opt.flatMapAsync(async (n) => Option.Some(n * 2))

      expectTypeOf(chained).toEqualTypeOf<Option<number>>()
    })

    it("should correctly type branching computations", () => {
      const opt = Option.Some(42)

      // Multiple branches from same source
      const branch1 = opt.map((n) => n * 2)
      const branch2 = opt.flatMap((n) => Option.Some(n.toString()))
      const branch3 = opt.zip((n) => n.toString())

      expectTypeOf(branch1).toEqualTypeOf<Option<number>>()
      expectTypeOf(branch2).toEqualTypeOf<Option<string>>()
      expectTypeOf(branch3).toEqualTypeOf<Option<[number, string]>>()
    })

    it("should correctly type async flatZip chains", async () => {
      const opt = Option.Some(42)

      const chained = await opt.flatZipAsync(async (n) =>
        Option.Some(n.toString()),
      )

      expectTypeOf(chained).toEqualTypeOf<Option<[number, string]>>()
    })
  })

  describe("conversions", () => {
    it("should correctly type toResult", () => {
      const opt = Option.Some(42)
      expectTypeOf(opt.toResult(new Error())).toEqualTypeOf<
        Result<number, Error>
      >()
    })

    it("should correctly type innerMap", () => {
      const opt = Option.Some([1, 2, 3])
      expectTypeOf(opt.innerMap((n) => n.toString())).toEqualTypeOf<
        Option<string[]>
      >()
    })

    it("should correctly type tap (returns same type)", () => {
      const opt = Option.Some(42)
      expectTypeOf(opt.tap((n) => console.log(n))).toEqualTypeOf<
        Option<number>
      >()
    })

    it("should correctly type tapAsync (returns same type)", async () => {
      const opt = Option.Some(42)
      const result = await opt.tapAsync((n) => Promise.resolve(console.log(n)))
      expectTypeOf(result).toEqualTypeOf<Option<number>>()
    })
  })

  describe("None behavior", () => {
    it("should correctly type operations on None", () => {
      const none: Option<number> = Option.None

      // map on None with typed Option returns Option<U>
      expectTypeOf(none.map((n) => n.toString())).toEqualTypeOf<
        Option<string>
      >()

      // flatMap on None returns Option<U>
      expectTypeOf(
        none.flatMap((n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Option<string>>()

      // filter on None returns Option<T>
      expectTypeOf(none.filter((n) => n > 0)).toEqualTypeOf<Option<number>>()
    })

    it("should correctly type unwrapOr on None", () => {
      const none: Option<number> = Option.None

      // unwrapOr returns the default type
      expectTypeOf(none.unwrapOr(0)).toEqualTypeOf<number>()
    })

    it("should correctly type Option.None singleton", () => {
      // Option.None is Option<never>
      expectTypeOf(Option.None).toEqualTypeOf<Option<never>>()

      // Can be assigned to any Option<T>
      const numOpt: Option<number> = Option.None
      expectTypeOf(numOpt).toEqualTypeOf<Option<number>>()
    })
  })
})
