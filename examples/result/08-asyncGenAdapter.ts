/**
 * Result.asyncGenAdapter() - Async generator with adapter for better type inference
 *
 * asyncGenAdapter() combines asyncGen with an adapter function ($)
 * for improved type inference in complex async workflows.
 */

import { Result } from "../../dist/result.mjs";

// ============================================================================
// BASIC ASYNC GENADAPTER EXAMPLES
// ============================================================================

console.log("=== Result.asyncGenAdapter() Examples ===\n");

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Example 1: Simple asyncGenAdapter
const simple = await Result.asyncGenAdapter(async function* ($) {
  const value = yield* $(Result.Ok(42));
  return value;
});
console.log("1. Simple asyncGenAdapter:", simple.unwrap()); // 42

// Example 2: asyncGenAdapter with Promise<Result>
const withPromise = await Result.asyncGenAdapter(async function* ($) {
  const value = yield* $(await Promise.resolve(Result.Ok(42)));
  return value;
});
console.log("2. With Promise<Result>:", withPromise.unwrap()); // 42

// Example 3: Multiple yields with adapter
const multiple = await Result.asyncGenAdapter(async function* ($) {
  const a = yield* $(Result.Ok(5));
  const b = yield* $(await Promise.resolve(Result.Ok(10)));
  const c = yield* $(Result.Ok(15));
  return a + b + c;
});
console.log("3. Multiple yields:", multiple.unwrap()); // 30

// Example 4: asyncGenAdapter improves type inference
type Error1 = { type: "error1" };
type Error2 = { type: "error2" };

const asyncOp1 = async (): Promise<Result<number, Error1>> => {
  await delay(10);
  return Result.Ok(42);
};

const asyncOp2 = async (n: number): Promise<Result<number, Error2>> => {
  await delay(10);
  return Result.Ok(n * 2);
};

const combined = await Result.asyncGenAdapter(async function* ($) {
  const a = yield* $(await asyncOp1());
  const b = yield* $(await asyncOp2(a));
  return b;
});
// Type is Promise<Result<number, Error1 | Error2>>
console.log("4. Combined error types:", combined.unwrap()); // 84

// Example 5: asyncGenAdapter for API composition
type ApiError = { status: number; message: string };

const fetchUser = async (
  id: number,
): Promise<Result<{ id: number; name: string }, ApiError>> => {
  await delay(10);
  return Result.Ok({ id, name: `User ${id}` });
};

const fetchPosts = async (
  _userId: number,
): Promise<Result<{ id: number; title: string }[], ApiError>> => {
  await delay(10);
  return Result.Ok([{ id: 1, title: "Post 1" }]);
};

const fetchSettings = async (
  _userId: number,
): Promise<Result<{ theme: string }, ApiError>> => {
  await delay(10);
  return Result.Ok({ theme: "dark" });
};

const fetchAllUserData = async (userId: number) => {
  return Result.asyncGenAdapter(async function* ($) {
    const user = yield* $(await fetchUser(userId));
    const posts = yield* $(await fetchPosts(user.id));
    const settings = yield* $(await fetchSettings(user.id));

    return { user, posts, settings };
  });
};
const allData = await fetchAllUserData(1);
console.log("5. Fetch all user data:", allData.unwrap()); // { user: { id: 1, name: "User 1" }, posts: [...], settings: { theme: "dark" } }

// Example 6: asyncGenAdapter with async transformation
const doubleAsync = async (n: number): Promise<number> => {
  await delay(10);
  return n * 2;
};

const autoAwait = (async () => {
  const gen = Result.asyncGenAdapter(async function* ($) {
    const value = yield* $(Result.Ok(5));
    const doubled = await doubleAsync(value);
    return doubled;
  });
  return gen;
})();
console.log("6. Async transformation:", (await autoAwait).unwrap()); // 10

// Example 7: asyncGenAdapter with complex validation
type ValidationError =
  | { field: "email"; code: "INVALID" | "REQUIRED" }
  | { field: "password"; code: "WEAK" | "REQUIRED" }
  | { field: "age"; code: "TOO_YOUNG" };

const validateEmailAsync = async (
  email: string,
): Promise<Result<string, ValidationError>> => {
  await delay(5);
  if (!email) return Result.Err({ field: "email", code: "REQUIRED" });
  if (!email.includes("@"))
    return Result.Err({ field: "email", code: "INVALID" });
  return Result.Ok(email);
};

const validatePasswordAsync = async (
  password: string,
): Promise<Result<string, ValidationError>> => {
  await delay(5);
  if (!password) return Result.Err({ field: "password", code: "REQUIRED" });
  if (password.length < 8)
    return Result.Err({ field: "password", code: "WEAK" });
  return Result.Ok(password);
};

const validateAgeAsync = async (
  age: number,
): Promise<Result<number, ValidationError>> => {
  await delay(5);
  if (age < 18) return Result.Err({ field: "age", code: "TOO_YOUNG" });
  return Result.Ok(age);
};

const registerUserAsync = async (
  email: string,
  password: string,
  age: number,
) => {
  return Result.asyncGenAdapter(async function* ($) {
    const validEmail = yield* $(await validateEmailAsync(email));
    const validPassword = yield* $(await validatePasswordAsync(password));
    const validAge = yield* $(await validateAgeAsync(age));

    return {
      email: validEmail,
      password: validPassword,
      age: validAge,
      registered: true,
    };
  });
};
const registered = await registerUserAsync(
  "user@example.com",
  "password123",
  25,
);
console.log("7. Register user:", registered.unwrap()); // { email: "user@example.com", password: "password123", age: 25, registered: true }

// Example 8: asyncGenAdapter for transaction workflow
type TransactionError =
  | { type: "insufficient_funds"; balance: number }
  | { type: "account_not_found" }
  | { type: "network_error" };

interface Account {
  id: number;
  balance: number;
}

const getAccountAsync = async (
  id: number,
): Promise<Result<Account, TransactionError>> => {
  await delay(10);
  if (id === 999) return Result.Err({ type: "account_not_found" });
  return Result.Ok({ id, balance: 100 });
};

const debitAsync = async (
  account: Account,
  amount: number,
): Promise<Result<Account, TransactionError>> => {
  await delay(10);
  if (account.balance < amount) {
    return Result.Err({ type: "insufficient_funds", balance: account.balance });
  }
  return Result.Ok({ ...account, balance: account.balance - amount });
};

const creditAsync = async (
  account: Account,
  amount: number,
): Promise<Result<Account, TransactionError>> => {
  await delay(10);
  return Result.Ok({ ...account, balance: account.balance + amount });
};

const transferAsync = async (fromId: number, toId: number, amount: number) => {
  return Result.asyncGenAdapter(async function* ($) {
    const fromAccount = yield* $(await getAccountAsync(fromId));
    const toAccount = yield* $(await getAccountAsync(toId));

    const debited = yield* $(await debitAsync(fromAccount, amount));
    const credited = yield* $(await creditAsync(toAccount, amount));

    return {
      from: debited,
      to: credited,
      amount,
    };
  });
};
const transferResult = await transferAsync(1, 2, 50);
console.log("8. Transfer async:", transferResult.unwrap()); // { from: { id: 1, balance: 50 }, to: { id: 2, balance: 150 }, amount: 50 }

// Example 9: asyncGenAdapter with sequential fallback (using orElse)
const fetchWithRetryAsync = async (
  url: string,
  retries = 3,
): Promise<Result<string, "fetch_failed">> => {
  for (let i = 0; i < retries; i++) {
    await delay(10);
    if (url === "https://api.example.com/data") {
      return Result.Ok("response data");
    }
  }
  return Result.Err("fetch_failed");
};

// Fallback pattern using orElse for error recovery
const fetchWithFallbackAsync = async (
  primaryUrl: string,
  fallbackUrls: string[],
) => {
  // Try primary first
  let result = await fetchWithRetryAsync(primaryUrl);

  // Try fallbacks in sequence (orElse is synchronous)
  for (const url of fallbackUrls) {
    if (result.isErr()) {
      result = await fetchWithRetryAsync(url);
    }
  }

  return result;
};
const fallbackResult = await fetchWithFallbackAsync("https://invalid.com", [
  "https://backup.com/data",
  "https://api.example.com/data",
]);
console.log("9. Fetch with fallback:", fallbackResult.unwrap()); // "response data"

// Example 10: asyncGenAdapter for data processing pipeline
type RawData = { input: string };
type ParsedData = { value: number };
type ValidatedData = { value: number; valid: true };
type EnrichedData = { value: number; valid: true; timestamp: number };

const parseAsync = async (
  data: RawData,
): Promise<Result<ParsedData, "parse_error">> => {
  await delay(5);
  const num = Number(data.input);
  return Number.isNaN(num)
    ? Result.Err("parse_error")
    : Result.Ok({ value: num });
};

const validateAsync = async (
  data: ParsedData,
): Promise<Result<ValidatedData, "validation_error">> => {
  await delay(5);
  return data.value > 0
    ? Result.Ok({ value: data.value, valid: true })
    : Result.Err("validation_error");
};

const enrichAsync = async (
  data: ValidatedData,
): Promise<Result<EnrichedData, "enrich_error">> => {
  await delay(5);
  return Result.Ok({ ...data, timestamp: Date.now() });
};

const processDataPipelineAsync = async (raw: RawData) => {
  return Result.asyncGenAdapter(async function* ($) {
    const parsed = yield* $(await parseAsync(raw));
    const validated = yield* $(await validateAsync(parsed));
    const enriched = yield* $(await enrichAsync(validated));
    return enriched;
  });
};
const pipelineResult = await processDataPipelineAsync({ input: "42" });
console.log("10. Data pipeline:", pipelineResult.unwrap()); // { value: 42, valid: true, timestamp: ... }

// Example 11: asyncGenAdapter with array operations
const doubleArrayAsync = async (arr: number[]): Promise<number[]> => {
  await delay(5);
  return arr.map((x) => x * 2);
};

const filterArrayAsync = async (arr: number[]): Promise<number[]> => {
  await delay(5);
  return arr.filter((x) => x > 5);
};

const sumArrayAsync = async (arr: number[]): Promise<number> => {
  await delay(5);
  return arr.reduce((a, b) => a + b, 0);
};

const processItemsAsync = async (items: number[]) => {
  const gen = Result.asyncGenAdapter(async function* ($) {
    const arr = yield* $(Result.Ok(items));
    const doubled = await doubleArrayAsync(arr);
    const filtered = await filterArrayAsync(doubled);
    const sum = await sumArrayAsync(filtered);
    return sum;
  });
  return gen;
};
const itemsResult = await processItemsAsync([1, 2, 3, 4, 5]);
console.log("11. Process items:", (await itemsResult).unwrap()); // 24 (6 + 8 + 10)

// Example 12: asyncGenAdapter with conditional logic
const conditionalAsync = (async () => {
  const gen = Result.asyncGenAdapter(async function* ($) {
    const input = yield* $(Result.Ok(5));

    if (input > 0) {
      const result = await (async (x: number) => {
        await delay(5);
        return x * 2;
      })(input);
      return { value: result, source: "doubled" as const };
    }

    return { value: input, source: "original" as const };
  });
  return gen;
})();
console.log("12. Conditional async:", (await conditionalAsync).unwrap()); // { value: 10, source: "doubled" }

// Example 13: asyncGenAdapter for batch operations
const batchFetchAsync = async (ids: number[]) => {
  return Result.asyncGenAdapter(async function* ($) {
    const results: { id: number; name: string }[] = [];

    for (const id of ids) {
      const user = yield* $(await fetchUser(id));
      results.push(user);
    }

    return results;
  });
};
const batchResult = await batchFetchAsync([1, 2, 3]);
console.log("13. Batch fetch:", batchResult.unwrap()); // [{ id: 1, name: "User 1" }, ...]

// Example 14: asyncGenAdapter with parallel-like pattern (sequential but clean)
const fetchUserProfile = async (userId: number) => {
  return Result.asyncGenAdapter(async function* ($) {
    const user = yield* $(await fetchUser(userId));
    const posts = yield* $(await fetchPosts(user.id));
    const settings = yield* $(await fetchSettings(user.id));
    const notifications = yield* $(
      await Promise.resolve(Result.Ok({ unread: 5 })),
    );

    return {
      user,
      posts,
      settings,
      notifications,
    };
  });
};
const profile = await fetchUserProfile(1);
console.log("14. User profile:", profile.unwrap()); // { user: ..., posts: [...], settings: { theme: "dark" }, notifications: { unread: 5 } }

// Example 15: asyncGenAdapter with async transformation
const transformItemsAsync = async (
  items: number[],
): Promise<Result<number[], "transform_error">> => {
  await delay(5);
  return Result.Ok(items.map((x) => x * 2));
};

const withToPromise = await Result.asyncGenAdapter(async function* ($) {
  const arr = yield* $(Result.Ok([1, 2, 3]));
  const resolved = yield* $(await transformItemsAsync(arr));
  return resolved;
});
console.log("15. Async transformation:", withToPromise.unwrap()); // [2, 4, 6]

// Example 16: asyncGenAdapter for complex workflow
type Order = { id: number; items: string[]; total: number };
type Payment = { orderId: number; amount: number; method: string };
type Shipment = { orderId: number; tracking: string };
type Invoice = { orderId: number; paid: boolean };

const createOrderAsync = async (
  items: string[],
): Promise<Result<Order, "order_error">> => {
  await delay(10);
  return Result.Ok({ id: 1, items, total: 100 });
};

const processPaymentAsync = async (
  order: Order,
): Promise<Result<Payment, "payment_error">> => {
  await delay(10);
  return Result.Ok({
    orderId: order.id,
    amount: order.total,
    method: "credit_card",
  });
};

const arrangeShipmentAsync = async (
  order: Order,
): Promise<Result<Shipment, "shipment_error">> => {
  await delay(10);
  return Result.Ok({ orderId: order.id, tracking: "TRACK123" });
};

const generateInvoiceAsync = async (
  payment: Payment,
): Promise<Result<Invoice, "invoice_error">> => {
  await delay(10);
  return Result.Ok({ orderId: payment.orderId, paid: true });
};

const completeOrderWorkflow = async (items: string[]) => {
  return Result.asyncGenAdapter(async function* ($) {
    const order = yield* $(await createOrderAsync(items));
    const payment = yield* $(await processPaymentAsync(order));
    const shipment = yield* $(await arrangeShipmentAsync(order));
    const invoice = yield* $(await generateInvoiceAsync(payment));

    return {
      order,
      payment,
      shipment,
      invoice,
    };
  });
};
const workflowResult = await completeOrderWorkflow(["item1", "item2"]);
console.log("16. Complete workflow:", workflowResult.unwrap()); // { order: { ... }, payment: { ... }, shipment: { ... }, invoice: { ... } }

// Example 17: asyncGenAdapter with error aggregation pattern
type ConfigError = { key: string; message: string };

const fetchConfigAsync = async (
  key: string,
): Promise<Result<string, ConfigError>> => {
  await delay(5);
  const configs: Record<string, string> = {
    api_key: "secret123",
    timeout: "5000",
  };
  const value = configs[key];
  return value ? Result.Ok(value) : Result.Err({ key, message: "Not found" });
};

const fetchAllConfigsAsync = async (keys: string[]) => {
  return Result.asyncGenAdapter(async function* ($) {
    const configs: Record<string, string> = {};

    for (const key of keys) {
      const value = yield* $(await fetchConfigAsync(key));
      configs[key] = value;
    }

    return configs;
  });
};
const configsResult = await fetchAllConfigsAsync(["api_key", "timeout"]);
console.log("17. Fetch all configs:", configsResult.unwrap()); // { api_key: "secret123", timeout: "5000" }

// Example 18: asyncGenAdapter with nested operations
const nested = (async () => {
  const gen = Result.asyncGenAdapter(async function* ($) {
    const outer = yield* $(Result.Ok(5));

    // Nested asyncGenAdapter call - returns a Result, so we yield* to flatten it
    const inner = yield* $(
      await Result.asyncGenAdapter(async function* ($) {
        const a = yield* $(Result.Ok(outer));
        const b = await (async (x: number) => {
          await delay(5);
          return x * 2;
        })(a);
        return b;
      }),
    );

    return inner;
  });
  return gen;
})();
console.log("18. Nested:", (await nested).unwrap()); // 10

// Example 19: asyncGenAdapter vs asyncGen - same result
const asyncGenResult = await Result.asyncGen(async function* () {
  const a = yield* await Promise.resolve(Result.Ok(1));
  const b = yield* await Promise.resolve(Result.Ok(2));
  return a + b;
});

const adapterResult = await Result.asyncGenAdapter(async function* ($) {
  const a = yield* $(await Promise.resolve(Result.Ok(1)));
  const b = yield* $(await Promise.resolve(Result.Ok(2)));
  return a + b;
});

console.log("19. asyncGen:", asyncGenResult.unwrap()); // 3
console.log("    asyncGenAdapter:", adapterResult.unwrap()); // 3

// Example 20: asyncGenAdapter for streaming-like pattern
const processStreamAsync = async (chunks: string[]) => {
  // biome-ignore lint/correctness/useYield: no worries
  return Result.asyncGenAdapter(async function* (_$) {
    // oxlint-disable-next-line require-yield
    let buffer = "";

    for (const chunk of chunks) {
      await delay(5);
      buffer += chunk;
    }

    return buffer;
  });
};
const streamResult = await processStreamAsync(["Hello", " ", "World", "!"]);
console.log("20. Process stream:", streamResult.unwrap()); // "Hello World!"

console.log("\n=== All asyncGenAdapter examples completed ===");
