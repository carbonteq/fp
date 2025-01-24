import * as assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Option, UnwrappedNone } from "@/option.js";

const doubleIt = (n: number) => n * 2;
const doubleOptIt = (n: number) => Option.Some(n * 2);
const noneOptIt = (n: number): Option<number> => Option.None;

const asyncDoubleIt = async (n: number) => n * 2;
const asyncDoubleOptIt = async (n: number) => Option.Some(n * 2);
const asyncOptNone = async (n: number): Promise<Option<number>> => Option.None;

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

    it.todo("should double if some async", () => {
      const opt = Option.Some(2);
      const mapped = opt.map(doubleIt);

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

    it.todo("should not call mapper if starting from None promise", (t) => {
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
});
