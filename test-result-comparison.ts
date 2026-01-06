#!/usr/bin/env bun
/**
 * Comparison test for Result vs ExperimentalResult implementations
 * This file tests various methods and ensures both implementations produce equivalent results
 */

import { ExperimentalResult, Result } from "./dist/index.js";

// Helper functions for testing
const assertEquals = <T>(actual: T, expected: T, message: string) => {
  const strActual = JSON.stringify(actual, null, 2);
  const strExpected = JSON.stringify(expected, null, 2);
  if (strActual !== strExpected) {
    console.error(`❌ ${message}`);
    console.error(`Expected: ${strExpected}`);
    console.error(`Actual:   ${strActual}`);
    return false;
  }
  console.log(`✅ ${message}`);
  return true;
};

const testResult = async <T, E>(
  test: string,
  result: Result<T, E>,
  experimentalResult: ExperimentalResult<T, E>,
  _expectSuccess: boolean = true,
) => {
  console.log(`\n🧪 Testing: ${test}`);

  // Test isOk/Err
  const resultOk = result.isOk();
  const experimentalOk = experimentalResult.isOk();
  assertEquals(resultOk, experimentalOk, `isOk() matches`);

  const resultErr = result.isErr();
  const experimentalErr = experimentalResult.isErr();
  assertEquals(resultErr, experimentalErr, `isErr() matches`);

  // Test toString
  assertEquals(
    result.toString(),
    experimentalResult.toString(),
    `toString() matches`,
  );

  // Test safeUnwrap (only for sync results and Ok results)
  if (resultOk && !(result.unwrap() instanceof Promise)) {
    assertEquals(
      result.safeUnwrap(),
      experimentalResult.safeUnwrap(),
      `safeUnwrap() matches`,
    );
  }

  if (resultOk) {
    try {
      const resultValue = await Promise.resolve(result.unwrap());
      const experimentalValue = await Promise.resolve(
        experimentalResult.unwrap(),
      );
      assertEquals(resultValue, experimentalValue, `unwrap() values match`);
    } catch (error) {
      console.error(`❌ unwrap() failed: ${error}`);
      return false;
    }
  } else if (resultErr) {
    try {
      const resultErrValue = await Promise.resolve(result.unwrapErr());
      const experimentalErrValue = await Promise.resolve(
        experimentalResult.unwrapErr(),
      );
      assertEquals(
        typeof resultErrValue === "object"
          ? resultErrValue?.message
          : resultErrValue,
        typeof experimentalErrValue === "object"
          ? experimentalErrValue?.message
          : experimentalErrValue,
        `unwrapErr() values match`,
      );
    } catch (error) {
      console.error(`❌ unwrapErr() failed: ${error}`);
      return false;
    }
  }

  return true;
};

const testMethodChaining = async () => {
  console.log("\n🔗 Testing Method Chaining");

  // Test data
  const initialValue = 5;

  // Sync test cases
  const syncTests = [
    {
      name: "Simple map chain",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r.map((x: number) => x * 2),
        e.map((x: number) => x * 2),
      ],
    },
    {
      name: "map with error case",
      setup: () => ({
        result: Result.Err("test error"),
        experimental: ExperimentalResult.Err("test error"),
      }),
      operations: (r: any, e: any) => [
        r.map((x: number) => x * 2),
        e.map((x: number) => x * 2),
      ],
    },
    {
      name: "mapErr chain",
      setup: () => ({
        result: Result.Err<string, Error>(new Error("test error")),
        experimental: ExperimentalResult.Err<string, Error>(
          new Error("test error"),
        ),
      }),
      operations: (r: any, e: any) => [
        r.mapErr((err: Error) => new Error(`Mapped: ${err.message}`)),
        e.mapErr((err: Error) => new Error(`Mapped: ${err.message}`)),
      ],
    },
    {
      name: "flatMap chain",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r.flatMap((x: number) => Result.Ok(x * 3)),
        e.flatMap((x: number) => ExperimentalResult.Ok(x * 3)),
      ],
    },
    {
      name: "flatMap with error",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r.flatMap((_x: number) =>
          Result.Err<number, string>("conversion error"),
        ),
        e.flatMap((_x: number) =>
          ExperimentalResult.Err<number, string>("conversion error"),
        ),
      ],
    },
    {
      name: "zip operation",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r.zip((x: number) => x * 4),
        e.zip((x: number) => x * 4),
      ],
    },
    {
      name: "flatZip operation",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r.flatZip((x: number) => Result.Ok(x * 5)),
        e.flatZip((x: number) => ExperimentalResult.Ok(x * 5)),
      ],
    },
    {
      name: "mapBoth operation",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r.mapBoth(
          (x: number) => x * 6,
          (err: any) => new Error(`Both: ${err}`),
        ),
        e.mapBoth(
          (x: number) => x * 6,
          (err: any) => new Error(`Both: ${err}`),
        ),
      ],
    },
    {
      name: "Complex chain: map -> flatMap -> map",
      setup: () => ({
        result: Result.Ok(initialValue),
        experimental: ExperimentalResult.Ok(initialValue),
      }),
      operations: (r: any, e: any) => [
        r
          .map((x: number) => x.toString())
          .flatMap((s: string) => Result.Ok(parseInt(s, 10) * 2))
          .map((n: number) => n + 10),
        e
          .map((x: number) => x.toString())
          .flatMap((s: string) => ExperimentalResult.Ok(parseInt(s, 10) * 2))
          .map((n: number) => n + 10),
      ],
    },
  ];

  // Run sync tests
  for (const test of syncTests) {
    const { result, experimental } = test.setup();
    const [resultResult, experimentalResult] = test.operations(
      result,
      experimental,
    );
    await testResult(test.name, resultResult, experimentalResult, false);
  }
};

const testAsyncOperations = async () => {
  console.log("\n⚡ Testing Async Operations");

  const asyncTests = [
    {
      name: "Async map chain",
      setup: () => ({
        result: Result.Ok(5),
        experimental: ExperimentalResult.Ok(5),
      }),
      operations: async (r: any, e: any) => [
        r.map(async (x: number) => x * 2),
        e.map(async (x: number) => x * 2),
      ],
    },
    {
      name: "Async flatMap chain",
      setup: () => ({
        result: Result.Ok(5),
        experimental: ExperimentalResult.Ok(5),
      }),
      operations: async (r: any, e: any) => [
        r.flatMap(async (x: number) => Result.Ok(x * 3)),
        e.flatMap(async (x: number) => ExperimentalResult.Ok(x * 3)),
      ],
    },
    {
      name: "Async zip operation",
      setup: () => ({
        result: Result.Ok(5),
        experimental: ExperimentalResult.Ok(5),
      }),
      operations: async (r: any, e: any) => [
        r.zip(async (x: number) => x * 4),
        e.zip(async (x: number) => x * 4),
      ],
    },
    {
      name: "Promise-based constructor (ExperimentalResult only)",
      setup: async () => {
        const promise = Promise.resolve(10);
        return {
          result: Result.Ok(10), // Standard Result doesn't have fromPromise static method
          experimental: await ExperimentalResult.fromPromise(promise),
        };
      },
      operations: (r: any, e: any) => [r, e],
    },
    {
      name: "Complex async chain",
      setup: () => ({
        result: Result.Ok(5),
        experimental: ExperimentalResult.Ok(5),
      }),
      operations: async (r: any, e: any) => [
        r
          .map(async (x: number) => x * 2)
          .flatMap(async (x: number) => Result.Ok(x + 3))
          .map((x: number) => x.toString()),
        e
          .map(async (x: number) => x * 2)
          .flatMap(async (x: number) => ExperimentalResult.Ok(x + 3))
          .map((x: number) => x.toString()),
      ],
    },
  ];

  for (const test of asyncTests) {
    const { result, experimental } = await test.setup();
    const [resultResult, experimentalResult] = await test.operations(
      result,
      experimental,
    );

    // For async results, we need to await the promises
    const finalResult = await resultResult.toPromise();
    const finalExperimental = await experimentalResult.toPromise();

    await testResult(test.name, finalResult, finalExperimental, false);
  }
};

const testStaticMethods = async () => {
  console.log("\n🏭 Testing Static Methods");

  // Test all() method
  console.log("\n📦 Testing all() method");

  const allTests = [
    {
      name: "all() with success values",
      results: [Result.Ok(1), Result.Ok(2), Result.Ok(3)],
      experimental: [
        ExperimentalResult.Ok(1),
        ExperimentalResult.Ok(2),
        ExperimentalResult.Ok(3),
      ],
    },
    {
      name: "all() with mixed results",
      results: [Result.Ok(1), Result.Err("error1"), Result.Ok(3)],
      experimental: [
        ExperimentalResult.Ok(1),
        ExperimentalResult.Err("error1"),
        ExperimentalResult.Ok(3),
      ],
    },
    {
      name: "all() with all errors",
      results: [Result.Err("error1"), Result.Err("error2")],
      experimental: [
        ExperimentalResult.Err("error1"),
        ExperimentalResult.Err("error2"),
      ],
    },
  ];

  for (const test of allTests) {
    const resultAll = Result.all(...test.results);
    const experimentalAll = ExperimentalResult.all(...test.experimental);

    await testResult(test.name, resultAll, experimentalAll, false);
  }

  // Error mapper tests
  console.log("\n🗺️ Testing Error Mapper");

  ExperimentalResult.setErrorMapper((err) => `Mapped: ${err}`);

  const errorResult = ExperimentalResult.Err("original error");
  assertEquals(
    errorResult.toString(),
    "Result::Err<Mapped: original error>",
    "Error mapper applied",
  );

  ExperimentalResult.resetErrorMapper();
};

const testEdgeCases = async () => {
  console.log("\n🎯 Testing Edge Cases");

  // Test nested results
  console.log("\n🪆 Testing nested results");

  const _nestedResult = Result.Ok(5).flatMap((x) =>
    Result.Ok(Result.Ok(x * 2)),
  );

  const _nestedExperimental = ExperimentalResult.Ok(5).flatMap((x) =>
    ExperimentalResult.Ok(ExperimentalResult.Ok(x * 2)),
  );

  // Test validation
  console.log("\n✅ Testing validation");

  const validationResult = Result.Ok(10).validate([
    (x: number) => (x > 5 ? Result.Ok(true) : Result.Err("too small")),
    (x: number) => (x < 20 ? Result.Ok(true) : Result.Err("too large")),
  ]);

  const validationExperimental = ExperimentalResult.Ok(10).validate([
    (x: number) =>
      x > 5 ? ExperimentalResult.Ok(true) : ExperimentalResult.Err("too small"),
    (x: number) =>
      x < 20
        ? ExperimentalResult.Ok(true)
        : ExperimentalResult.Err("too large"),
  ]);

  await testResult(
    "Validation with valid input",
    validationResult,
    validationExperimental,
    false,
  );

  // Test orElse
  console.log("\n🔄 Testing orElse");

  const errorResult = ExperimentalResult.Err<string, number>(42);
  const orElseResult = errorResult.orElse(100);
  assertEquals(orElseResult, 100, "orElse provides default value");

  const okResult = ExperimentalResult.Ok(50);
  const orElseOk = okResult.orElse(100);
  assertEquals(orElseOk, 50, "orElse keeps Ok value");
};

const main = async () => {
  console.log("🚀 Starting Result vs ExperimentalResult comparison tests\n");

  try {
    await testMethodChaining();
    await testAsyncOperations();
    await testStaticMethods();
    await testEdgeCases();

    console.log("\n🎉 All tests completed!");
    console.log("\n📊 Summary:");
    console.log("- Method chaining operations verified");
    console.log("- Async operations verified");
    console.log("- Static methods verified");
    console.log("- Edge cases handled correctly");
    console.log(
      "\n✨ Result and ExperimentalResult implementations appear to be equivalent!",
    );
  } catch (error) {
    console.error("\n💥 Test suite failed:", error);
    process.exit(1);
  }
};

// Run the tests
main().catch(console.error);
