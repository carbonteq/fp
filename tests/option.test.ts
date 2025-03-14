import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
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

    assert.ok(opt !== undefined);
  });

  it("should construct None opt", () => {
    const opt = Option.None;

    assert.ok(opt !== undefined);
  });
});

describe("option unwrapping", () => {
  it("should return value for Some", () => {
    const opt = Option.Some(123456);

    assert.ok(opt !== undefined);
  });

  it("should throw UnwrappedNone on None", () => {
    const opt = Option.None;

    assert.throws(() => opt.unwrap(), UnwrappedNone);
  });

  describe("map behavior", () => {
    it("should double if some", (t) => {
      const opt = Option.Some(2);
      const mockedDouble = t.mock.fn(doubleIt);
      const mapped = opt.map(mockedDouble);

      assert.ok(opt.isSome());
      assert.strictEqual(mockedDouble.mock.callCount(), 1);
      assert.strictEqual(mapped.unwrap(), 4);
    });

    it("should double if some async", async () => {
      const opt = Option.Some(2);
      const mapped = await opt.map(asyncDoubleIt).toPromise();

      assert.ok(mapped.isSome());
      assert.strictEqual(mapped.unwrap(), 4);
    });

    it("should not call mapper if None", (t) => {
      const opt: Option<number> = Option.None;

      const mockedDouble = t.mock.fn(doubleIt);
      const mapped = opt.map(mockedDouble);

      assert.ok(mapped.isNone());

      assert.strictEqual(
        mockedDouble.mock.callCount(),
        0,
        "should not have called map on None",
      );
    });

    it("should not call mapper if starting from None promise", async (t) => {
      const opt: Option<number> = Option.None;

      const mockedDouble = t.mock.fn(asyncDoubleIt);
      const mapped = await opt.map(mockedDouble).toPromise();

      assert.ok(mapped.isNone());

      assert.strictEqual(
        mockedDouble.mock.callCount(),
        0,
        "should not have called map on None",
      );
    });
  });

  describe("flatMap behavior", () => {
    it("should call flatMappers if starting from Some", (t) => {
      const mockerA = t.mock.fn(doubleOptIt);
      const mockerB = t.mock.fn(doubleOptIt);

      const opt = Option.Some(3);
      const mapped = opt.flatMap(mockerA).flatMap(mockerB);

      assert.ok(mapped.isSome());
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mapped.unwrap(), 12);
    });

    it("should not call flatMappers if starting from None", (t) => {
      const mockerA = t.mock.fn(doubleOptIt);
      const mockerB = t.mock.fn(doubleOptIt);

      const opt = Option.None;
      const mapped = opt.flatMap(mockerA).flatMap(mockerB);

      assert.ok(mapped.isNone());
      assert.strictEqual(mockerA.mock.callCount(), 0);
      assert.strictEqual(mockerB.mock.callCount(), 0);
    });

    it("should not call flatMappers after encountering None", (t) => {
      const mockerA = t.mock.fn(noneOptIt);
      const mockerB = t.mock.fn(doubleOptIt);

      const opt = Option.Some(3);
      const mapped = opt.flatMap(mockerA).flatMap(mockerB);

      assert.ok(mapped.isNone());
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(
        mockerB.mock.callCount(),
        0,
        "called flatMap after None",
      );
    });
  });

  describe("branching map", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(doubleIt);
      const mockerC = t.mock.fn(noneOptIt);
      const o1 = o.map(mockerA);
      const o2 = o.map(mockerB);
      const o3 = o.flatMap(mockerC);

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(o2.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(asyncDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);
      const mockerC = t.mock.fn(asyncOptNone);
      const o1 = await o.map(mockerA).toPromise();
      const o2 = await o.map(mockerB).toPromise();
      const o3 = await o.flatMap(mockerC).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(o2.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation starting from Promise should not affect parent or each other", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(doubleIt);
      const mockerC = t.mock.fn(noneOptIt);
      const o1 = await o.map(mockerA).toPromise();
      const o2 = await o.map(mockerB).toPromise();
      const o3 = await o.flatMap(mockerC).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(o2.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(asyncDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);
      const mockerC = t.mock.fn(asyncOptNone);
      const o1 = await o.map(mockerA).toPromise();
      const o2 = await o.map(mockerB).toPromise();
      const o3 = await o.flatMap(mockerC).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(o2.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });
  });

  describe("branching flatMap", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(doubleOptIt);
      const mockerB = t.mock.fn(noneOptIt);
      const o1 = o.flatMap(mockerA);
      const o2 = o.flatMap(mockerB);

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(asyncDoubleOptIt);
      const mockerB = t.mock.fn(asyncOptNone);
      const o1 = await o.flatMap(mockerA).toPromise();
      const o2 = await o.flatMap(mockerB).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(doubleOptIt);
      const mockerB = t.mock.fn(noneOptIt);
      const o1 = await o.flatMap(mockerA).toPromise();
      const o2 = await o.flatMap(mockerB).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(asyncDoubleOptIt);
      const mockerB = t.mock.fn(asyncOptNone);
      const o1 = await o.flatMap(mockerA).toPromise();
      const o2 = await o.flatMap(mockerB).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.strictEqual(o1.unwrap(), 4);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
  });

  describe("branching zip", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(doubleIt);
      const mockerC = t.mock.fn(noneOptIt);
      const o1 = o.zip(mockerA);
      const o2 = o.zip(mockerB);
      const o3 = o.flatMap(mockerC);

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.deepStrictEqual(o2.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(asyncDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);
      const mockerC = t.mock.fn(asyncOptNone);
      const o1 = await o.zip(mockerA).toPromise();
      const o2 = await o.zip(mockerB).toPromise();
      const o3 = await o.flatMap(mockerC).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.deepStrictEqual(o2.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation starting from Promise should not affect parent or each other", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(doubleIt);
      const mockerB = t.mock.fn(doubleIt);
      const mockerC = t.mock.fn(noneOptIt);
      const o1 = await o.zip(mockerA).toPromise();
      const o2 = await o.zip(mockerB).toPromise();
      const o3 = await o.flatMap(mockerC).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.deepStrictEqual(o2.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });

    it("two chained branches of computation starting from Promise should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(asyncDoubleIt);
      const mockerB = t.mock.fn(asyncDoubleIt);
      const mockerC = t.mock.fn(asyncOptNone);
      const o1 = await o.zip(mockerA).toPromise();
      const o2 = await o.zip(mockerB).toPromise();
      const o3 = await o.flatMap(mockerC).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isSome());
      assert.ok(o3.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.deepStrictEqual(o2.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
      assert.strictEqual(mockerC.mock.callCount(), 1);
    });
  });

  describe("branching flatZip", () => {
    it("two chained branches of computation should not affect parent or each other", (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(doubleOptIt);
      const mockerB = t.mock.fn(noneOptIt);
      const o1 = o.flatZip(mockerA);
      const o2 = o.flatZip(mockerB);

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(2);
      const mockerA = t.mock.fn(asyncDoubleOptIt);
      const mockerB = t.mock.fn(asyncOptNone);
      const o1 = await o.flatZip(mockerA).toPromise();
      const o2 = await o.flatZip(mockerB).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(doubleOptIt);
      const mockerB = t.mock.fn(noneOptIt);
      const o1 = await o.flatZip(mockerA).toPromise();
      const o2 = await o.flatZip(mockerB).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });

    it("two chained branches of computation from Promise should not affect parent or each other (async)", async (t) => {
      const o = Option.Some(Promise.resolve(2));
      const mockerA = t.mock.fn(asyncDoubleOptIt);
      const mockerB = t.mock.fn(asyncOptNone);
      const o1 = await o.flatZip(mockerA).toPromise();
      const o2 = await o.flatZip(mockerB).toPromise();

      assert.ok(o.isSome());
      assert.ok(o1.isSome());
      assert.ok(o2.isNone());
      assert.strictEqual(await o.unwrap(), 2);
      assert.deepStrictEqual(o1.unwrap(), [2, 4]);
      assert.strictEqual(mockerA.mock.callCount(), 1);
      assert.strictEqual(mockerB.mock.callCount(), 1);
    });
  });
});
