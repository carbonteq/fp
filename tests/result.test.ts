import * as assert from "node:assert";
import { describe, it } from "node:test";
import { Result, UnwrappedErrWithOk, UnwrappedOkWithErr } from "@/result.js";

class DummyError extends Error {
  constructor() {
    super("dummyErr");
    this.name = "DummyError";
  }
}

describe("Result construction", () => {
  it("ok result", () => {
    const r = Result.Ok("dummy");

    assert.strictEqual(r.toString(), "Result::Ok<dummy>");
  });

  it("err result", () => {
    const r = Result.Err(new DummyError());

    assert.strictEqual(r.toString(), "Result::Err<DummyError: dummyErr>");
  });
});

describe("unwrapping value from result", () => {
  it("on Ok should be...ok", () => {
    const r = Result.Ok(42);

    assert.strictEqual(r.unwrap(), 42);
  });

  it("on Err should throw an error", () => {
    const r = Result.Err(new DummyError());

    assert.throws(() => r.unwrap(), DummyError);
  });

  it("on non-Error Err val should throw UnwrappedOkWithErr", () => {
    const r = Result.Err(3);

    assert.throws(() => r.unwrap(), UnwrappedOkWithErr);
  });
});

describe("unwrapping error from result", () => {
  it("on Err should be...ok", () => {
    const r = Result.Err(42);

    assert.strictEqual(r.unwrapErr(), 42);
  });

  it("on Ok should throw UnwrappedErrWithOk", () => {
    const r = Result.Ok(3);

    assert.throws(() => r.unwrapErr(), UnwrappedErrWithOk);
  });
});

describe("unwrapping value from result safetly", () => {
  it("on Ok should return a non null value", () => {
    const r = Result.Ok(42);

    assert.strictEqual(r.safeUnwrap(), 42);
  });

  it("on Err should return null", () => {
    const r = Result.Err(new DummyError());

    assert.strictEqual(r.safeUnwrap(), null);
  });
});

describe.skip("unwrapping err from result safetly", () => {
  // it("on Err should return a non null value", () => {
  //   const r = Result.Err(42);
  //   assert.strictEqual(r.safeUnwrapErr(), 42);
  // });
  // it("on Ok should return null", () => {
  //   const r = Result.Ok(91);
  //   assert.strictEqual(r.safeUnwrapErr(), null);
  // });
});
