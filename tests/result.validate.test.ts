import assert from "node:assert";
import { describe, it } from "node:test";
import { Result } from "@/result.js";

const validateOk = (_n: number): Result<string, string> => Result.Ok("Success");
const validatePromiseOk = (_n: number): Promise<Result<string, string>> =>
  Promise.resolve(Result.Ok("Success"));
const validateOkPromise = (_n: number): Result<Promise<string>, string> =>
  Result.Ok(Promise.resolve("Success"));
const validateErr = (_n: number): Result<string, string> =>
  Result.Err("Failure");
const validatePromiseErr = (_n: number): Promise<Result<string, string>> =>
  Promise.resolve(Result.Err("Failure"));
const validateErrPromise = (_n: number): Result<string, Promise<string>> =>
  Result.Err(Promise.resolve("Failure"));

const asyncErrResIt = async (_n: number): Promise<Result<number, string>> =>
  Result.Err("Failure");

describe("Result.validate behavior", () => {
  it("should return original value if success validating Result<T, E>", (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validateOk);

    const r = Result.Ok(2);

    const validated = r.validate([mockerA, mockerB]);

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return original value if success validating Promise<Result<T, E>>", async (t) => {
    const mockerA = t.mock.fn(validatePromiseOk);
    const mockerB = t.mock.fn(validatePromiseOk);

    const r = Result.Ok(2);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return original value if success validating Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateOkPromise);
    const mockerB = t.mock.fn(validateOkPromise);

    const r = Result.Ok(2);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if failure validating Result<T, E>", (t) => {
    const mockerA = t.mock.fn(validateErr);
    const mockerB = t.mock.fn(validateErr);

    const r = Result.Ok(2);

    const validated = r.validate([mockerA, mockerB]);

    assert.ok(validated.isErr());
    assert.deepStrictEqual(validated.unwrapErr(), ["Failure", "Failure"]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if failure validating Promise<Result<T, E>>", async (t) => {
    const mockerA = t.mock.fn(validatePromiseErr);
    const mockerB = t.mock.fn(validatePromiseErr);

    const r = Result.Ok(2);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.deepStrictEqual(validated.unwrapErr(), ["Failure", "Failure"]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if failure validating Result<T, Promise<E>>", async (t) => {
    const mockerA = t.mock.fn(validateErrPromise);
    const mockerB = t.mock.fn(validateErrPromise);

    const r = Result.Ok(2);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.strictEqual(validated.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return original value if success validating Result<T, E> starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validateOk);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return original value if success validating Promise<Result<T, E>> starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validatePromiseOk);
    const mockerB = t.mock.fn(validatePromiseOk);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return original value if success validating Result<Promise<T>, E> starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateOkPromise);
    const mockerB = t.mock.fn(validateOkPromise);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if failure validating Result<T, E> starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateErr);
    const mockerB = t.mock.fn(validateErr);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.deepStrictEqual(validated.unwrapErr(), ["Failure", "Failure"]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if failure validating Promise<Result<T, E>> starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validatePromiseErr);
    const mockerB = t.mock.fn(validatePromiseErr);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.deepStrictEqual(validated.unwrapErr(), ["Failure", "Failure"]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if failure validating Result<T, Promise<E>> starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateErrPromise);
    const mockerB = t.mock.fn(validateErrPromise);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.strictEqual(validated.safeUnwrap(), null);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
  });

  it("should return errors if even one failure starting from Result<T, E>", (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validateErr);
    const mockerC = t.mock.fn(validateOk);

    const r = Result.Ok(2);

    const validated = r.validate([mockerA, mockerB, mockerC]);

    assert.ok(validated.isErr());
    assert.deepStrictEqual(validated.unwrapErr(), ["Failure"]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
    assert.strictEqual(mockerC.mock.callCount(), 1);
  });

  it("should return errors if even one failure starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validateErr);
    const mockerC = t.mock.fn(validateOk);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB, mockerC]).toPromise();

    assert.ok(validated.isErr());
    assert.deepStrictEqual(validated.unwrapErr(), ["Failure"]);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
    assert.strictEqual(mockerC.mock.callCount(), 1);
  });

  it("should short circuit if input settles into error state", async (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validateOk);

    const r = Result.Ok(2).flatMap(asyncErrResIt);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.strictEqual(validated.unwrapErr(), "Failure");
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should short circuit if input settles into error state even if validators error", async (t) => {
    const mockerA = t.mock.fn(validateErr);
    const mockerB = t.mock.fn(validateErr);

    const r = Result.Ok(2).flatMap(asyncErrResIt);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    assert.ok(validated.isErr());
    assert.strictEqual(validated.unwrapErr(), "Failure");
    assert.strictEqual(mockerA.mock.callCount(), 0);
    assert.strictEqual(mockerB.mock.callCount(), 0);
  });

  it("should handle all validator signatures", async (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validatePromiseOk);
    const mockerC = t.mock.fn(validateOkPromise);

    const r = Result.Ok(2);

    const validated = await r.validate([mockerA, mockerB, mockerC]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
    assert.strictEqual(mockerC.mock.callCount(), 1);
  });

  it("should handle all validator signatures starting from Result<Promise<T>, E>", async (t) => {
    const mockerA = t.mock.fn(validateOk);
    const mockerB = t.mock.fn(validatePromiseOk);
    const mockerC = t.mock.fn(validateOkPromise);

    const r = Result.Ok(Promise.resolve(2));

    const validated = await r.validate([mockerA, mockerB, mockerC]).toPromise();

    assert.ok(validated.isOk());
    assert.strictEqual(validated.unwrap(), 2);
    assert.strictEqual(mockerA.mock.callCount(), 1);
    assert.strictEqual(mockerB.mock.callCount(), 1);
    assert.strictEqual(mockerC.mock.callCount(), 1);
  });
});
