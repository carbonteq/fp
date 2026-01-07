import { describe, expect, expectTypeOf, it, mock } from "bun:test";
import { Option, UnwrappedNone } from "@/option.js";
import type { Result } from "@/result.js";
import { expectSyncValue } from "../testUtils";

const doubleIt = (n: number) => n * 2;
const doubleOptIt = (n: number) => Option.Some(n * 2);
const noneOptIt = (_n: number): Option<number> => Option.None;

const asyncDoubleIt = async (n: number) => n * 2;
const asyncDoubleOptIt = async (n: number) => Option.Some(n * 2);
const asyncOptNone = async (_n: number): Promise<Option<number>> => Option.None;

describe("option construction", () => {
  it("should construct Some opt", () => {
    const opt = Option.Some(123456);

    expect(opt).not.toBeUndefined();
  });

  it("should construct None opt", () => {
    const opt = Option.None;

    expect(opt).not.toBeUndefined();
  });
});

describe("option unwrapping", () => {
  it("should return value for Some", () => {
    const opt = Option.Some(123456);

    expect(opt.unwrap()).toBe(123456);
  });

  it("should throw UnwrappedNone on None", () => {
    const opt = Option.None;

    expect(() => opt.unwrap()).toThrow(UnwrappedNone);
  });
});

describe("map behavior", () => {
  it("should double if some", () => {
    const opt = Option.Some(2);
    const mockedDouble = mock(doubleIt);
    const mapped = opt.map(mockedDouble);

    expect(opt.isSome()).toBeTrue();
    expect(mockedDouble).toHaveBeenCalledTimes(1);
    expect(mapped.unwrap()).toBe(4);
  });

  it("should double if some async", async () => {
    const opt = Option.Some(2);
    const mapped = await opt.map(asyncDoubleIt).toPromise();

    expect(mapped.isSome()).toBeTrue();
    expect(mapped.unwrap()).toBe(4);
  });

  it("should not call mapper if None", () => {
    const opt: Option<number> = Option.None;
    const mockedDouble = mock(doubleIt);
    const mapped = opt.map(mockedDouble);

    expect(mapped.isNone()).toBeTrue();
    expect(mockedDouble).not.toHaveBeenCalled();
  });

  it("should not call mapper if starting from None promise", async () => {
    const opt: Option<number> = Option.None;

    const mockedDouble = mock(asyncDoubleIt);
    const mapped = await opt.map(mockedDouble).toPromise();

    expect(mapped.isNone()).toBeTrue();
    expect(mockedDouble).not.toHaveBeenCalled();
  });
});

describe("flatMap behavior", () => {
  it("should call flatMappers if starting from Some", () => {
    const mockerA = mock(doubleOptIt);
    const mockerB = mock(doubleOptIt);

    const opt = Option.Some(3);
    const mapped = opt.flatMap(mockerA).flatMap(mockerB);

    expect(mapped.isSome()).toBeTrue();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mapped.unwrap()).toBe(12);
  });

  it("should not call flatMappers if starting from None", () => {
    const mockerA = mock(doubleOptIt);
    const mockerB = mock(doubleOptIt);

    const opt = Option.None;
    const mapped = opt.flatMap(mockerA).flatMap(mockerB);

    expect(mapped.isNone()).toBeTrue();
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should not call flatMappers after encountering None", () => {
    const mockerA = mock(noneOptIt);
    const mockerB = mock(doubleOptIt);

    const opt = Option.Some(3);
    const mapped = opt.flatMap(mockerA).flatMap(mockerB);

    expect(mapped.isNone()).toBeTrue();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB, "called flatMap after None").not.toHaveBeenCalled();
  });
});

describe("filter behavior", () => {
  it("should propagate async filter None state", async () => {
    const opt = Option.Some(Promise.resolve(2));
    const filtered = opt.filter(async (n) => n > 10);
    const resolved = await filtered.toPromise();

    expect(filtered.isNone()).toBeTrue();
    expect(filtered.isSome()).toBeFalse();
    expect(resolved.isNone()).toBeTrue();
  });
});

describe("branching map", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2);
    const mockerA = mock(doubleIt);
    const mockerB = mock(doubleIt);
    const mockerC = mock(noneOptIt);
    const o1 = o.map(mockerA);
    const o2 = o.map(mockerB);
    const o3 = o.flatMap(mockerC);

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(o2.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation should not affect parent or each other (async)", async () => {
    const o = Option.Some(2);
    const mockerA = mock(asyncDoubleIt);
    const mockerB = mock(asyncDoubleIt);
    const mockerC = mock(asyncOptNone);
    const o1 = await o.map(mockerA).toPromise();
    const o2 = await o.map(mockerB).toPromise();
    const o3 = await o.flatMap(mockerC).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(o2.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation starting from Promise should not affect parent or each other", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(doubleIt);
    const mockerB = mock(doubleIt);
    const mockerC = mock(noneOptIt);
    const o1 = await o.map(mockerA).toPromise();
    const o2 = await o.map(mockerB).toPromise();
    const o3 = await o.flatMap(mockerC).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(o2.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(asyncDoubleIt);
    const mockerB = mock(asyncDoubleIt);
    const mockerC = mock(asyncOptNone);
    const o1 = await o.map(mockerA).toPromise();
    const o2 = await o.map(mockerB).toPromise();
    const o3 = await o.flatMap(mockerC).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(o2.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });
});

describe("branching flatMap", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2);
    const mockerA = mock(doubleOptIt);
    const mockerB = mock(noneOptIt);
    const o1 = o.flatMap(mockerA);
    const o2 = o.flatMap(mockerB);

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation should not affect parent or each other (async)", async () => {
    const o = Option.Some(2);
    const mockerA = mock(asyncDoubleOptIt);
    const mockerB = mock(asyncOptNone);
    const o1 = await o.flatMap(mockerA).toPromise();
    const o2 = await o.flatMap(mockerB).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation from Promise should not affect parent or each other", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(doubleOptIt);
    const mockerB = mock(noneOptIt);
    const o1 = await o.flatMap(mockerA).toPromise();
    const o2 = await o.flatMap(mockerB).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation from Promise should not affect parent or each other (async)", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(asyncDoubleOptIt);
    const mockerB = mock(asyncOptNone);
    const o1 = await o.flatMap(mockerA).toPromise();
    const o2 = await o.flatMap(mockerB).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(o1.unwrap()).toBe(4);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });
});

describe("branching zip", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2);
    const mockerA = mock(doubleIt);
    const mockerB = mock(doubleIt);
    const mockerC = mock(noneOptIt);
    const o1 = o.zip(mockerA);
    const o2 = o.zip(mockerB);
    const o3 = o.flatMap(mockerC);

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(expectSyncValue(o1.unwrap())).toEqual([2, 4]);
    expect(expectSyncValue(o2.unwrap())).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation should not affect parent or each other (async)", async () => {
    const o = Option.Some(2);
    const mockerA = mock(asyncDoubleIt);
    const mockerB = mock(asyncDoubleIt);
    const mockerC = mock(asyncOptNone);
    const o1 = await o.zip(mockerA).toPromise();
    const o2 = await o.zip(mockerB).toPromise();
    const o3 = await o.flatMap(mockerC).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(o2.unwrap()).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation starting from Promise should not affect parent or each other", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(doubleIt);
    const mockerB = mock(doubleIt);
    const mockerC = mock(noneOptIt);
    const o1 = await o.zip(mockerA).toPromise();
    const o2 = await o.zip(mockerB).toPromise();
    const o3 = await o.flatMap(mockerC).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(expectSyncValue(o1.unwrap())).toEqual([2, 4]);
    expect(expectSyncValue(o2.unwrap())).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(asyncDoubleIt);
    const mockerB = mock(asyncDoubleIt);
    const mockerC = mock(asyncOptNone);
    const o1 = await o.zip(mockerA).toPromise();
    const o2 = await o.zip(mockerB).toPromise();
    const o3 = await o.flatMap(mockerC).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isSome()).toBeTrue();
    expect(o3.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(expectSyncValue(o1.unwrap())).toEqual([2, 4]);
    expect(expectSyncValue(o2.unwrap())).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });
});

describe("branching flatZip", () => {
  it("two chained branches of computation should not affect parent or each other", () => {
    const o = Option.Some(2);
    const mockerA = mock(doubleOptIt);
    const mockerB = mock(noneOptIt);
    const o1 = o.flatZip(mockerA);
    const o2 = o.flatZip(mockerB);

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation should not affect parent or each other (async)", async () => {
    const o = Option.Some(2);
    const mockerA = mock(asyncDoubleOptIt);
    const mockerB = mock(asyncOptNone);
    const o1 = await o.flatZip(mockerA).toPromise();
    const o2 = await o.flatZip(mockerB).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(o.unwrap()).toBe(2);
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation from Promise should not affect parent or each other", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(doubleOptIt);
    const mockerB = mock(noneOptIt);
    const o1 = await o.flatZip(mockerA).toPromise();
    const o2 = await o.flatZip(mockerB).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("two chained branches of computation from Promise should not affect parent or each other (async)", async () => {
    const o = Option.Some(Promise.resolve(2));
    const mockerA = mock(asyncDoubleOptIt);
    const mockerB = mock(asyncOptNone);
    const o1 = await o.flatZip(mockerA).toPromise();
    const o2 = await o.flatZip(mockerB).toPromise();

    expect(o.isSome()).toBeTrue();
    expect(o1.isSome()).toBeTrue();
    expect(o2.isNone()).toBeTrue();
    expect(await o.unwrap()).toBe(2);
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });
});

describe("Option type inference", () => {
  describe("construction", () => {
    it("should correctly type Some and None constructors", () => {
      expectTypeOf(Option.Some(42)).toEqualTypeOf<Option<number>>();
      expectTypeOf(Option.Some("hello")).toEqualTypeOf<Option<string>>();
      expectTypeOf(Option.None).toEqualTypeOf<Option<never>>();
    });

    it("should correctly type fromNullable", () => {
      const val: string | null = "hello";
      expectTypeOf(Option.fromNullable(val)).toEqualTypeOf<Option<string>>();

      // fromNullable strips null/undefined from the type
      const maybeNull: string | null | undefined = "test";
      expectTypeOf(Option.fromNullable(maybeNull)).toEqualTypeOf<
        Option<string>
      >();
    });

    it("should correctly type fromFalsy", () => {
      const val: string = "hello";
      expectTypeOf(Option.fromFalsy(val)).toEqualTypeOf<Option<string>>();
    });

    it("should correctly type fromPredicate", () => {
      expectTypeOf(Option.fromPredicate(42, (n) => n > 0)).toEqualTypeOf<
        Option<number>
      >();
    });

    it("should correctly type fromPromise", () => {
      const promiseOpt = Promise.resolve(Option.Some(42));
      expectTypeOf(Option.fromPromise(promiseOpt)).toEqualTypeOf<
        Option<Promise<number>>
      >();
    });
  });

  describe("type guards", () => {
    it("should narrow types with isSome", () => {
      const opt: Option<number> = Option.Some(42);

      if (opt.isSome()) {
        // After isSome(), _tag should be "Some"
        expectTypeOf(opt._tag).toEqualTypeOf<"Some">();
      }
    });

    it("should narrow types with isNone", () => {
      const opt: Option<number> = Option.Some(42);

      if (opt.isNone()) {
        // After isNone(), _tag should be "None"
        expectTypeOf(opt._tag).toEqualTypeOf<"None">();
      }
    });
  });

  describe("unwrapping", () => {
    it("should return correct types for unwrap methods", () => {
      const opt = Option.Some(42);

      expectTypeOf(opt.unwrap()).toEqualTypeOf<number>();
      expectTypeOf(opt.safeUnwrap()).toEqualTypeOf<number | null>();
      expectTypeOf(opt.unwrapOr(0)).toEqualTypeOf<number>();
      expectTypeOf(opt.unwrapOrElse(() => 0)).toEqualTypeOf<number>();
    });
  });

  describe("transformations", () => {
    it("should correctly type map with sync mapper", () => {
      const opt = Option.Some(42);

      // Sync mapper: Option<U>
      expectTypeOf(opt.map((n) => n.toString())).toEqualTypeOf<
        Option<string>
      >();
    });

    it("should correctly type map with async mapper", () => {
      const opt = Option.Some(42);

      // Async mapper: Option<Promise<U>>
      expectTypeOf(opt.map(async (n) => n.toString())).toEqualTypeOf<
        Option<Promise<string>>
      >();
    });

    it("should correctly type map on async Option with sync mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // Sync mapper on Promise<T>: Option<Promise<U>>
      expectTypeOf(opt.map((n) => n.toString())).toEqualTypeOf<
        Option<Promise<string>>
      >();
    });

    it("should correctly type map on async Option with async mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // Async mapper on Promise<T>: Option<Promise<U>>
      expectTypeOf(opt.map(async (n) => n.toString())).toEqualTypeOf<
        Option<Promise<string>>
      >();
    });

    it("should correctly type flatMap with sync mapper", () => {
      const opt = Option.Some(42);

      // Sync flatMap: Option<U>
      expectTypeOf(opt.flatMap((n) => Option.Some(n.toString()))).toEqualTypeOf<
        Option<string>
      >();
    });

    it("should correctly type flatMap with async mapper", () => {
      const opt = Option.Some(42);

      // Async flatMap: Option<Promise<U>>
      expectTypeOf(
        opt.flatMap(async (n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Option<Promise<string>>>();
    });

    it("should correctly type flatMap on async Option with sync mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // flatMap on Promise<T>: Option<Promise<U>>
      expectTypeOf(opt.flatMap((n) => Option.Some(n.toString()))).toEqualTypeOf<
        Option<Promise<string>>
      >();
    });

    it("should correctly type flatMap on async Option with async mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // Async flatMap on Promise<T>: Option<Promise<U>>
      expectTypeOf(
        opt.flatMap(async (n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Option<Promise<string>>>();
    });

    it("should correctly type filter with sync predicate", () => {
      const opt = Option.Some(42);

      // Sync predicate: Option<T>
      expectTypeOf(opt.filter((n) => n > 0)).toEqualTypeOf<Option<number>>();
    });

    it("should correctly type filter with async predicate", () => {
      const opt = Option.Some(42);

      // Async predicate: Option<Promise<T>>
      expectTypeOf(opt.filter(async (n) => n > 0)).toEqualTypeOf<
        Option<Promise<number>>
      >();
    });

    it("should correctly type mapOr", () => {
      const opt = Option.Some(42);

      // mapOr returns U directly (not Option<U>)
      expectTypeOf(
        opt.mapOr("default", (n) => n.toString()),
      ).toEqualTypeOf<string>();
    });

    it("should correctly type mapOr on async Option", () => {
      const opt = Option.Some(Promise.resolve(42));

      // mapOr on async Option returns Promise<U>
      expectTypeOf(opt.mapOr("default", (n) => n.toString())).toEqualTypeOf<
        Promise<string>
      >();
    });
  });

  describe("zip operations", () => {
    it("should correctly type zip with sync mapper", () => {
      const opt = Option.Some(42);

      // Sync zip: Option<[T, U]>
      expectTypeOf(opt.zip((n) => n.toString())).toEqualTypeOf<
        Option<[number, string]>
      >();
    });

    it("should correctly type zip with async mapper", () => {
      const opt = Option.Some(42);

      // Async zip: Option<Promise<[T, U]>>
      expectTypeOf(opt.zip(async (n) => n.toString())).toEqualTypeOf<
        Option<Promise<[number, string]>>
      >();
    });

    it("should correctly type zip on async Option with sync mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // Sync zip on Promise<T>: Option<Promise<[T, U]>>
      expectTypeOf(opt.zip((n) => n.toString())).toEqualTypeOf<
        Option<Promise<[number, string]>>
      >();
    });

    it("should correctly type zip on async Option with async mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // Async zip on Promise<T>: Option<Promise<[T, U]>>
      expectTypeOf(opt.zip(async (n) => n.toString())).toEqualTypeOf<
        Option<Promise<[number, string]>>
      >();
    });

    it("should correctly type flatZip with sync mapper", () => {
      const opt = Option.Some(42);

      // Sync flatZip: Option<[T, U]>
      expectTypeOf(opt.flatZip((n) => Option.Some(n.toString()))).toEqualTypeOf<
        Option<[number, string]>
      >();
    });

    it("should correctly type flatZip with async mapper", () => {
      const opt = Option.Some(42);

      // Async flatZip: Option<Promise<[T, U]>>
      expectTypeOf(
        opt.flatZip(async (n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Option<Promise<[number, string]>>>();
    });

    it("should correctly type flatZip on async Option with sync mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // flatZip on Promise<T>: Option<Promise<[T, U]>>
      expectTypeOf(opt.flatZip((n) => Option.Some(n.toString()))).toEqualTypeOf<
        Option<Promise<[number, string]>>
      >();
    });

    it("should correctly type flatZip on async Option with async mapper", () => {
      const opt = Option.Some(Promise.resolve(42));

      // Async flatZip on Promise<T>: Option<Promise<[T, U]>>
      expectTypeOf(
        opt.flatZip(async (n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Option<Promise<[number, string]>>>();
    });
  });

  describe("pattern matching", () => {
    it("should correctly type match with same return types", () => {
      const opt = Option.Some(42);

      // match returns U (the return type of both branches)
      expectTypeOf(
        opt.match({
          Some: (n) => n.toString(),
          None: () => "nothing",
        }),
      ).toEqualTypeOf<string>();
    });

    it("should correctly type match returning numbers", () => {
      const opt = Option.Some(42);

      expectTypeOf(
        opt.match({
          Some: (n) => n * 2,
          None: () => -1,
        }),
      ).toEqualTypeOf<number>();
    });

    it("should correctly type match returning booleans", () => {
      const opt = Option.Some(42);

      expectTypeOf(
        opt.match({
          Some: () => true,
          None: () => false,
        }),
      ).toEqualTypeOf<boolean>();
    });
  });

  describe("static combinators", () => {
    it("should correctly type all with same types", () => {
      const o1 = Option.Some(1);
      const o2 = Option.Some(2);

      expectTypeOf(Option.all(o1, o2)).toEqualTypeOf<
        Option<[number, number]>
      >();
    });

    it("should correctly type all with different types", () => {
      const o1 = Option.Some(1);
      const o2 = Option.Some("hello");

      // all combines into tuple
      expectTypeOf(Option.all(o1, o2)).toEqualTypeOf<
        Option<[number, string]>
      >();
    });

    it("should correctly type all with three options", () => {
      const o1 = Option.Some(1);
      const o2 = Option.Some("hello");
      const o3 = Option.Some(true);

      expectTypeOf(Option.all(o1, o2, o3)).toEqualTypeOf<
        Option<[number, string, boolean]>
      >();
    });

    it("should correctly type any", () => {
      const o1 = Option.Some(1);
      const o2 = Option.Some(2);

      // any returns first Some
      expectTypeOf(Option.any(o1, o2)).toEqualTypeOf<Option<number>>();
    });
  });

  describe("complex chains", () => {
    it("should correctly type chained map and flatMap", () => {
      const opt = Option.Some(42);

      // Chain: map -> flatMap
      const chained = opt
        .map((n) => n * 2)
        .flatMap((n) => Option.Some(n.toString()));

      expectTypeOf(chained).toEqualTypeOf<Option<string>>();
    });

    it("should correctly type chained transformations with zip", () => {
      const opt = Option.Some(42);

      // Chain: map -> flatMap -> zip
      const chained = opt
        .map((n) => n * 2)
        .flatMap((n) => Option.Some(n.toString()))
        .zip((s) => s.length);

      expectTypeOf(chained).toEqualTypeOf<Option<[string, number]>>();
    });

    it("should correctly type async chains with map", async () => {
      const opt = Option.Some(42);

      // Chain with async in the middle
      const chained = opt.map(async (n) => n * 2).map((n) => n.toString());

      expectTypeOf(chained).toEqualTypeOf<Option<Promise<string>>>();

      // After toPromise
      const resolved = await chained.toPromise();
      expectTypeOf(resolved).toEqualTypeOf<Option<string>>();
    });

    it("should correctly type async chains with flatMap", async () => {
      const opt = Option.Some(42);

      const chained = opt
        .flatMap(async (n) => Option.Some(n * 2))
        .map((n) => n.toString());

      expectTypeOf(chained).toEqualTypeOf<Option<Promise<string>>>();
    });

    it("should correctly type branching computations", () => {
      const opt = Option.Some(42);

      // Multiple branches from same source
      const branch1 = opt.map((n) => n * 2);
      const branch2 = opt.flatMap((n) => Option.Some(n.toString()));
      const branch3 = opt.zip((n) => n.toString());

      expectTypeOf(branch1).toEqualTypeOf<Option<number>>();
      expectTypeOf(branch2).toEqualTypeOf<Option<string>>();
      expectTypeOf(branch3).toEqualTypeOf<Option<[number, string]>>();
    });

    it("should correctly type async flatZip chains", async () => {
      const opt = Option.Some(42);

      const chained = opt
        .flatZip(async (n) => Option.Some(n.toString()))
        .map(([num, str]) => `${num}: ${str}`);

      expectTypeOf(chained).toEqualTypeOf<Option<Promise<string>>>();
    });

    it("should correctly type mixed sync and async chains", async () => {
      const opt = Option.Some(42);

      const chained = opt
        .map((n) => n * 2) // sync
        .map(async (n) => n.toString()) // becomes async
        .map((s) => s.length); // stays async

      expectTypeOf(chained).toEqualTypeOf<Option<Promise<number>>>();
    });
  });

  describe("conversions", () => {
    it("should correctly type toResult", () => {
      const opt = Option.Some(42);
      expectTypeOf(opt.toResult(new Error())).toEqualTypeOf<
        Result<number, Error>
      >();
    });

    it("should correctly type toPromise on sync Option", async () => {
      const opt = Option.Some(42);
      expectTypeOf(opt.toPromise()).toEqualTypeOf<Promise<Option<number>>>();
    });

    it("should correctly type toPromise on async Option", async () => {
      const opt = Option.Some(Promise.resolve(42));
      expectTypeOf(opt.toPromise()).toEqualTypeOf<Promise<Option<number>>>();
    });

    it("should correctly type innerMap", () => {
      const opt = Option.Some([1, 2, 3]);
      expectTypeOf(opt.innerMap((n) => n.toString())).toEqualTypeOf<
        Option<string[]>
      >();
    });

    it("should correctly type tap (returns same type)", () => {
      const opt = Option.Some(42);
      expectTypeOf(opt.tap((n) => console.log(n))).toEqualTypeOf<
        Option<number>
      >();
    });
  });

  describe("None behavior", () => {
    it("should correctly type operations on None", () => {
      const none: Option<number> = Option.None;

      // map on None with typed Option returns Option<U>
      expectTypeOf(none.map((n) => n.toString())).toEqualTypeOf<
        Option<string>
      >();

      // flatMap on None returns Option<U>
      expectTypeOf(
        none.flatMap((n) => Option.Some(n.toString())),
      ).toEqualTypeOf<Option<string>>();

      // filter on None returns Option<T>
      expectTypeOf(none.filter((n) => n > 0)).toEqualTypeOf<Option<number>>();
    });

    it("should correctly type unwrapOr on None", () => {
      const none: Option<number> = Option.None;

      // unwrapOr returns the default type
      expectTypeOf(none.unwrapOr(0)).toEqualTypeOf<number>();
    });

    it("should correctly type Option.None singleton", () => {
      // Option.None is Option<never>
      expectTypeOf(Option.None).toMatchTypeOf<Option<never>>();

      // Can be assigned to any Option<T>
      const numOpt: Option<number> = Option.None;
      expectTypeOf(numOpt).toEqualTypeOf<Option<number>>();
    });
  });
});
