import * as assert from "node:assert";
import { describe, it } from "node:test";
import { Result } from "@/result.hybrid.js";

class DummyError extends Error {
  constructor(message = "dummyErr") {
    super(message);
    this.name = "DummyError";
  }
}

describe("Hybrid Result.all", () => {
  it("combines synchronous Ok results", () => {
    const combined = Result.all(Result.Ok(1), Result.Ok(2), Result.Ok(3));

    assert.deepStrictEqual(combined.unwrap(), [1, 2, 3]);
  });

  it("returns Err when any result fails", () => {
    const err = new DummyError();
    const combined = Result.all(Result.Ok(1), Result.Err(err), Result.Ok(3));

    assert.deepStrictEqual(combined.unwrapErr(), [err]);
  });

  it("handles async participants without rejecting", async () => {
    const err = new DummyError();
    const combined = Result.all(
      Result.Ok(1),
      Result.Ok(Promise.resolve(2)),
      Result.Err(err),
    );

    const settled = combined.unwrap();
    assert.ok(settled instanceof Promise);
    await assert.rejects(async () => settled, (received) => {
      assert.ok(received instanceof DummyError || Array.isArray(received));
      return true;
    });

    const aggregated = await combined.toPromise();
    assert.ok(aggregated.isErr());
    assert.deepStrictEqual(aggregated.unwrapErr(), [err]);
  });
});

describe("Hybrid Result.validate", () => {
  const valueValidator = (value: number) =>
    value > 0 ? Result.Ok(value) : Result.Err("invalid");

  const asyncValidator = async (value: number) =>
    value % 2 === 0 ? Result.Ok(value) : Result.Err("odd");

  it("returns original value when all validators pass", () => {
    const res = Result.Ok(10).validate([valueValidator, asyncValidator]);

    assert.strictEqual(res.unwrap(), 10);
  });

  it("collects validation errors", () => {
    const res = Result.Ok(-5).validate([valueValidator, asyncValidator]);

    assert.ok(res.isErr());
    assert.deepStrictEqual(res.unwrapErr(), ["invalid"]);
  });
});
