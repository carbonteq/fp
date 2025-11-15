import { describe, expect, it, mock } from "bun:test";
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
  it("should return original value if success validating Result<T, E>", () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validateOk);

    const r = Result.Ok(2);
    const validated = r.validate([mockerA, mockerB]);

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return original value if success validating Promise<Result<T, E>>", async () => {
    const mockerA = mock(validatePromiseOk);
    const mockerB = mock(validatePromiseOk);

    const r = Result.Ok(2);
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return original value if success validating Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateOkPromise);
    const mockerB = mock(validateOkPromise);

    const r = Result.Ok(2);
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if failure validating Result<T, E>", () => {
    const mockerA = mock(validateErr);
    const mockerB = mock(validateErr);

    const r = Result.Ok(2);
    const validated = r.validate([mockerA, mockerB]);

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toEqual(["Failure", "Failure"]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if failure validating Promise<Result<T, E>>", async () => {
    const mockerA = mock(validatePromiseErr);
    const mockerB = mock(validatePromiseErr);

    const r = Result.Ok(2);
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toEqual(["Failure", "Failure"]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if failure validating Result<T, Promise<E>>", async () => {
    const mockerA = mock(validateErrPromise);
    const mockerB = mock(validateErrPromise);

    const r = Result.Ok(2);
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return original value if success validating Result<T, E> starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validateOk);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return original value if success validating Promise<Result<T, E>> starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validatePromiseOk);
    const mockerB = mock(validatePromiseOk);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return original value if success validating Result<Promise<T>, E> starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateOkPromise);
    const mockerB = mock(validateOkPromise);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if failure validating Result<T, E> starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateErr);
    const mockerB = mock(validateErr);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toEqual(["Failure", "Failure"]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if failure validating Promise<Result<T, E>> starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validatePromiseErr);
    const mockerB = mock(validatePromiseErr);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toEqual(["Failure", "Failure"]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if failure validating Result<T, Promise<E>> starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateErrPromise);
    const mockerB = mock(validateErrPromise);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.safeUnwrap()).toBeNull();
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
  });

  it("should return errors if even one failure starting from Result<T, E>", () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validateErr);
    const mockerC = mock(validateOk);

    const r = Result.Ok(2);
    const validated = r.validate([mockerA, mockerB, mockerC]);

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toEqual(["Failure"]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("should return errors if even one failure starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validateErr);
    const mockerC = mock(validateOk);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB, mockerC]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toEqual(["Failure"]);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("should short circuit if input settles into error state", async () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validateOk);

    const r = Result.Ok(2).flatMap(asyncErrResIt);

    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toBe("Failure");
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should short circuit if input settles into error state even if validators error", async () => {
    const mockerA = mock(validateErr);
    const mockerB = mock(validateErr);

    const r = Result.Ok(2).flatMap(asyncErrResIt);
    const validated = await r.validate([mockerA, mockerB]).toPromise();

    expect(validated.isErr()).toBeTrue();
    expect(validated.unwrapErr()).toBe("Failure");
    expect(mockerA).not.toHaveBeenCalled();
    expect(mockerB).not.toHaveBeenCalled();
  });

  it("should handle all validator signatures", async () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validatePromiseOk);
    const mockerC = mock(validateOkPromise);

    const r = Result.Ok(2);
    const validated = await r.validate([mockerA, mockerB, mockerC]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });

  it("should handle all validator signatures starting from Result<Promise<T>, E>", async () => {
    const mockerA = mock(validateOk);
    const mockerB = mock(validatePromiseOk);
    const mockerC = mock(validateOkPromise);

    const r = Result.Ok(Promise.resolve(2));
    const validated = await r.validate([mockerA, mockerB, mockerC]).toPromise();

    expect(validated.isOk()).toBeTrue();
    expect(validated.unwrap()).toBe(2);
    expect(mockerA).toHaveBeenCalledTimes(1);
    expect(mockerB).toHaveBeenCalledTimes(1);
    expect(mockerC).toHaveBeenCalledTimes(1);
  });
});
