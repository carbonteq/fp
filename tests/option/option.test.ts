import { describe, expect, it, mock } from "bun:test";
import { Option, UnwrappedNone } from "@/option.js";

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
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(o2.unwrap()).toEqual([2, 4]);
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
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(o2.unwrap()).toEqual([2, 4]);
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
    expect(o1.unwrap()).toEqual([2, 4]);
    expect(o2.unwrap()).toEqual([2, 4]);
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
