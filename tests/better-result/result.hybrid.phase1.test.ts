import { describe, expect, it } from "bun:test";
import { UnwrappedErrWithOk, UnwrappedOkWithErr } from "@/errors";
import { ExperimentalResult as Result } from "@/result.experimental";

describe("Core Runtime Scaffolding", () => {
  describe("Basic Construction", () => {
    it("should create synchronous Ok results", () => {
      const result = Result.Ok(42);

      expect(result.toString()).toBe("Result::Ok<42>");
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.safeUnwrap()).toBe(42);
      expect(result.unwrap()).toBe(42);
    });

    it("should create synchronous Err results", () => {
      const error = "something went wrong";
      const result = Result.Err(error);

      expect(result.toString()).toBe("Result::Err<something went wrong>");
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.safeUnwrap()).toBe(null);
      expect(result.unwrapErr()).toBe(error);
    });

    it("should throw when unwrapping Err results", () => {
      const error = "test error";
      const result = Result.Err(error);

      expect(() => result.unwrap()).toThrow(UnwrappedOkWithErr);
      expect(() => result.unwrapErr()).not.toThrow();
    });

    it("should throw when unwrappingErr on Ok results", () => {
      const result = Result.Ok(42);

      expect(() => result.unwrapErr()).toThrow(UnwrappedErrWithOk);
      expect(() => result.unwrap()).not.toThrow();
    });
  });

  describe("Asynchronous Construction", () => {
    it("should create asynchronous Ok results", async () => {
      const result = Result.Ok(Promise.resolve(100));

      expect(result.toString()).toBe("Result::Promise<...>");
      expect(result.isOk()).toBe(false); // Can't determine synchronously
      expect(result.isErr()).toBe(false); // Can't determine synchronously
      expect(result.safeUnwrap()).toBe(null);

      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe(100);
    });

    it("should create asynchronous Err results", async () => {
      const error = "async error";
      const result = Result.Err(Promise.resolve(error));

      expect(result.toString()).toBe("Result::Promise<...>");
      expect(result.isOk()).toBe(false); // Can't determine synchronously
      expect(result.isErr()).toBe(false); // Can't determine synchronously
      expect(result.safeUnwrap()).toBe(null);

      const unwrappedErr = await result.unwrapErr();
      expect(unwrappedErr).toBe(error);

      // Should throw when trying to unwrap an async Err
      try {
        await result.unwrap();
        expect(false).toBe(true); // Should not reach here
      } catch (e) {
        expect(e).toBeInstanceOf(UnwrappedOkWithErr);
      }
    });
  });

  describe("Error Mapping", () => {
    it("should apply global error mapper", () => {
      Result.setErrorMapper((err) => `Mapped: ${err}`);

      const result = Result.Err("original error");
      expect(result.unwrapErr()).toBe("Mapped: original error");

      Result.resetErrorMapper();
    });

    it("should reset error mapper", () => {
      Result.setErrorMapper((err) => `Mapped: ${err}`);
      Result.resetErrorMapper();

      const result = Result.Err("reset error");
      expect(result.unwrapErr()).toBe("reset error");
    });
  });

  describe("Helper Methods", () => {
    it("should handle try() with successful operations", () => {
      const result = Result.try(() => "success");

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("success");
    });

    it("should handle try() with thrown errors", () => {
      const error = new Error("operation failed");
      const result = Result.try(() => {
        throw error;
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it("should handle try() with async operations", async () => {
      const result = Result.try(() => Promise.resolve("async success"));

      expect(result.toString()).toBe("Result::Promise<...>");
      const unwrapped = await result.unwrap();
      expect(unwrapped).toBe("async success");
    });

    it("should handle try() with custom error mapper", () => {
      const result = Result.try(
        () => {
          throw "string error";
        },
        (err) => `Custom: ${err}`,
      );

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe("Custom: string error");
    });

    it("should handle fromPromise() with resolved promises", async () => {
      const promise = Promise.resolve("promise value");
      const result = await Result.fromPromise(promise);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe("promise value");
    });

    it("should handle fromPromise() with rejected promises", async () => {
      const error = new Error("promise rejected");
      const promise = Promise.reject(error);
      const result = await Result.fromPromise(promise);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it("should handle toPromise() conversion", async () => {
      const syncResult = Result.Ok("sync value");
      const asyncResult = await syncResult.toPromise();

      expect(asyncResult.isOk()).toBe(true);
      expect(asyncResult.unwrap()).toBe("sync value");
    });
  });

  describe("UNIT_RESULT", () => {
    it("should provide unit result", () => {
      const unitResult = Result.UNIT_RESULT;

      expect(unitResult.isOk()).toBe(true);
      expect(unitResult.unwrap()).toBeDefined();
    });
  });
});
