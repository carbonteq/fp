/**
 * Result.asyncGen() - Async generator for Result composition
 *
 * asyncGen() provides async/await-style code while maintaining
 * functional error handling. Supports both sync Result<T,E> and
 * Promise<Result<T,E>>. Short-circuits on first Err.
 */

import { Result } from "../../dist/result.mjs";

// ============================================================================
// BASIC ASYNC GEN EXAMPLES
// ============================================================================

console.log("=== Result.asyncGen() Examples ===\n");

// Helper to simulate async operations
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Example 1: Simple asyncGen with sync Result
const simple = await Result.asyncGen(async function* () {
  const value = yield* Result.Ok(42);
  return value;
});
console.log("1. Simple asyncGen:", simple.unwrap()); // 42

// Example 2: asyncGen with awaited Promise<Result>
const withAwait = await Result.asyncGen(async function* () {
  const value = yield* await Promise.resolve(Result.Ok(42));
  return value;
});
console.log("2. With await:", withAwait.unwrap()); // 42

// Example 3: Multiple yields with mixed sync/async
const mixed = await Result.asyncGen(async function* () {
  const a = yield* Result.Ok(1);
  const b = yield* await Promise.resolve(Result.Ok(2));
  const c = yield* Result.Ok(3);
  return a + b + c;
});
console.log("3. Mixed sync/async:", mixed.unwrap()); // 6

// Example 4: Short-circuit on Err
const shortCircuit = await Result.asyncGen(async function* () {
  const a = yield* Result.Ok(5);
  const b = yield* await Promise.resolve(Result.Err<string, number>("error"));
  const c = yield* Result.Ok(10); // Never reached
  return a + b + c;
});
console.log("4. Short-circuit:", shortCircuit.unwrapErr()); // "error"

// Example 5: asyncGen with async operations
const withAsyncOps = await Result.asyncGen(async function* () {
  const a = yield* Result.Ok(1);
  await delay(10);
  const b = yield* Result.Ok(2);
  await delay(10);
  return a + b;
});
console.log("5. With async operations:", withAsyncOps.unwrap()); // 3

// Example 6: asyncGen for fetching data
type UserId = number;
type User = { id: UserId; name: string };
type PostId = number;
type Post = { id: PostId; authorId: UserId; title: string };

const fetchUser = async (
  id: UserId,
): Promise<Result<User, "user_not_found">> => {
  await delay(10);
  return Result.Ok({ id, name: `User ${id}` });
};

const fetchPosts = async (
  userId: UserId,
): Promise<Result<Post[], "posts_error">> => {
  await delay(10);
  return Result.Ok([{ id: 1, authorId: userId, title: `${userId}'s Post` }]);
};

const getUserWithPosts = async (userId: UserId) => {
  return Result.asyncGen(async function* () {
    const user = yield* await fetchUser(userId);
    const posts = yield* await fetchPosts(user.id);
    return { user, posts };
  });
};
const userPosts = await getUserWithPosts(1);
console.log("6. User with posts:", userPosts.unwrap()); // { user: { id: 1, name: "User 1" }, posts: [...] }

// Example 7: asyncGen with Result<Promise<T>, E> (auto-await)
const autoAwait = await Result.asyncGen(async function* () {
  // Result.map with async function returns Result<Promise<T>, E>
  const asyncMapped = Result.Ok(5).map(async (x) => {
    await delay(10);
    return x * 2;
  });

  // asyncGen automatically awaits the inner promise
  const value = yield* asyncMapped;

  return value;
});
console.log("7. Auto-await inner promise:", autoAwait.unwrap()); // 10

// Example 8: asyncGen for validation pipeline
const validatePositive = async (
  n: number,
): Promise<Result<number, "not_positive">> => {
  await delay(5);
  return n > 0 ? Result.Ok(n) : Result.Err("not_positive");
};

const validateEven = async (n: number): Promise<Result<number, "not_even">> => {
  await delay(5);
  return n % 2 === 0 ? Result.Ok(n) : Result.Err("not_even");
};

const validateAsync = await Result.asyncGen(async function* () {
  const input = yield* Result.Ok(4);
  const positive = yield* await validatePositive(input);
  const even = yield* await validateEven(positive);
  return even * 2;
});
console.log("8. Async validation:", validateAsync.unwrap()); // 8

// Example 9: asyncGen with error recovery
const withFallback = await Result.asyncGen(async function* () {
  const primary = yield* await Promise.resolve(
    Result.Err<string, number>("failed"),
  );
  return primary;
});

const final = withFallback.orElse(() => Result.Ok(0));
console.log("9. With fallback:", final.unwrap()); // 0

// Example 10: asyncGen for sequential API calls
type Config = { apiKey: string; endpoint: string };
const fetchConfig = async (): Promise<Result<Config, "config_error">> => {
  await delay(10);
  return Result.Ok({ apiKey: "secret", endpoint: "/api" });
};

const validateConfig = async (
  config: Config,
): Promise<Result<Config, "invalid_config">> => {
  await delay(10);
  return config.apiKey.length > 0
    ? Result.Ok(config)
    : Result.Err("invalid_config");
};

const initialize = await Result.asyncGen(async function* () {
  const config = yield* await fetchConfig();
  const validated = yield* await validateConfig(config);
  return { initialized: true, config: validated };
});
console.log("10. Initialize:", initialize.unwrap()); // { initialized: true, config: { apiKey: "secret", endpoint: "/api" } }

// Example 11: asyncGen with concurrent-like pattern (but sequential)
const multipleFetches = await Result.asyncGen(async function* () {
  const user = yield* await fetchUser(1);
  await delay(10);
  const posts = yield* await fetchPosts(user.id);
  await delay(10);
  const settings = yield* await Promise.resolve(Result.Ok({ theme: "dark" }));
  return { user, posts, settings };
});
console.log("11. Multiple fetches:", multipleFetches.unwrap()); // { user: ..., posts: [...], settings: { theme: "dark" } }

// Example 12: asyncGen with async map chains
const mapChain = await Result.asyncGen(async function* () {
  const step1 = yield* Result.Ok(5).map(async (x) => {
    await delay(5);
    return x * 2;
  });

  const step2 = yield* Result.Ok(step1).map(async (x) => {
    await delay(5);
    return x + 10;
  });

  return step2;
});
console.log("12. Map chain:", mapChain.unwrap()); // 20 (5 * 2 + 10)

// Example 13: asyncGen with complex workflow
type Order = { id: number; total: number };
type Payment = { orderId: number; amount: number; status: string };
type Receipt = { orderId: number; paymentId: number };

const fetchOrder = async (
  orderId: number,
): Promise<Result<Order, "order_not_found">> => {
  await delay(10);
  return Result.Ok({ id: orderId, total: 100 });
};

const processPayment = async (
  order: Order,
): Promise<Result<Payment, "payment_failed">> => {
  await delay(10);
  return Result.Ok({ orderId: order.id, amount: order.total, status: "paid" });
};

const generateReceipt = async (
  payment: Payment,
): Promise<Result<Receipt, "receipt_error">> => {
  await delay(10);
  return Result.Ok({ orderId: payment.orderId, paymentId: 1 });
};

const completeOrder = async (orderId: number) => {
  return Result.asyncGen(async function* () {
    const order = yield* await fetchOrder(orderId);
    const payment = yield* await processPayment(order);
    const receipt = yield* await generateReceipt(payment);
    return { order, payment, receipt };
  });
};
const orderResult = await completeOrder(123);
console.log("13. Complete order:", orderResult.unwrap()); // { order: { id: 123, total: 100 }, payment: { ... }, receipt: { ... } }

// Example 14: asyncGen with toPromise conversion
const withToPromise = await Result.asyncGen(async function* () {
  const asyncMapped = Result.Ok([1, 2, 3]).map(async (arr) => {
    await delay(5);
    return arr.map((x) => x * 2);
  });

  // toPromise resolves the inner Result<Promise<T>, E>
  const resolved = yield* await asyncMapped.toPromise();

  return resolved;
});
console.log("14. With toPromise:", withToPromise.unwrap()); // [2, 4, 6]

// Example 15: asyncGen for data transformation pipeline
type RawData = { value: string };
type ParsedData = { value: number };
type EnrichedData = { value: number; timestamp: number };

const parseAsync = async (
  data: RawData,
): Promise<Result<ParsedData, "parse_error">> => {
  await delay(5);
  const num = Number(data.value);
  return Number.isNaN(num)
    ? Result.Err("parse_error")
    : Result.Ok({ value: num });
};

const enrichAsync = async (
  data: ParsedData,
): Promise<Result<EnrichedData, "enrich_error">> => {
  await delay(5);
  return Result.Ok({ value: data.value, timestamp: Date.now() });
};

const processRawDataAsync = async (raw: RawData) => {
  return Result.asyncGen(async function* () {
    const parsed = yield* await parseAsync(raw);
    const enriched = yield* await enrichAsync(parsed);
    return enriched;
  });
};
const processedData = await processRawDataAsync({ value: "42" });
console.log("15. Process raw data:", processedData.unwrap()); // { value: 42, timestamp: ... }

// Example 16: Using orElse for fallback pattern (proper way)
// Note: asyncGen short-circuits on Err, so fallbacks should use orElse instead
const fetchWithRetry = async (
  url: string,
): Promise<Result<string, "fetch_error">> => {
  await delay(10);
  if (url === "https://api.example.com/data") {
    return Result.Ok("response data");
  }
  return Result.Err("fetch_error");
};

const fetchWithFallback = async (primaryUrl: string, fallbackUrl: string) => {
  // Use orElse for proper fallback handling
  const primary = await fetchWithRetry(primaryUrl);

  return primary.orElse(async () => await fetchWithRetry(fallbackUrl));
};

const fallbackResult = await fetchWithFallback(
  "https://api.example.com/invalid",
  "https://api.example.com/data",
);
console.log("16. Fetch with fallback:", fallbackResult.unwrap()); // "response data"

// Example 17: asyncGen with array processing
const processItemsAsync = async (items: number[]) => {
  return Result.asyncGen(async function* () {
    const doubled = yield* Result.Ok(items).map(async (arr) => {
      await delay(5);
      return arr.map((x) => x * 2);
    });

    const filtered = yield* Result.Ok(doubled).map(async (arr) => {
      await delay(5);
      return arr.filter((x) => x > 5);
    });

    const sum = yield* Result.Ok(filtered).map(async (arr) => {
      await delay(5);
      return arr.reduce((a, b) => a + b, 0);
    });

    return sum;
  });
};
const itemsResult = await processItemsAsync([1, 2, 3, 4, 5]);
console.log("17. Process items:", itemsResult.unwrap()); // 24 (6 + 8 + 10)

// Example 18: asyncGen with conditional async operations
const conditionalAsync = await Result.asyncGen(async function* () {
  const input = yield* Result.Ok(5);

  if (input > 0) {
    const result = yield* Result.Ok(input).map(async (x) => {
      await delay(5);
      return x * 2;
    });
    return { value: result, source: "doubled" as const };
  }

  return { value: input, source: "original" as const };
});
console.log("18. Conditional async:", conditionalAsync.unwrap()); // { value: 10, source: "doubled" }

// Example 19: asyncGen for batch operations
const batchFetch = async (ids: number[]) => {
  return Result.asyncGen(async function* () {
    const results: User[] = [];

    for (const id of ids) {
      const user = yield* await fetchUser(id);
      results.push(user);
    }

    return results;
  });
};
const batchResult = await batchFetch([1, 2, 3]);
console.log("19. Batch fetch:", batchResult.unwrap()); // [{ id: 1, name: "User 1" }, { id: 2, name: "User 2" }, { id: 3, name: "User 3" }]

// Example 20: asyncGen with early return on error
const earlyReturn = await Result.asyncGen(async function* () {
  const a = yield* Result.Ok(5);
  const b = yield* await validatePositive(a);
  const c = yield* await validateEven(b);

  // If we reach here, all validations passed
  return c;
});
console.log("20. Early return:", earlyReturn.unwrapErr()); // "not_even" (5 is not even)

console.log("\n=== All asyncGen examples completed ===");
