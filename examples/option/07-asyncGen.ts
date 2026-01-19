/**
 * Option.asyncGen() - Async generator-based syntax for Option composition
 *
 * Option.asyncGen() provides imperative-style async code while maintaining
 * functional optional handling. Short-circuits on first None.
 * Auto-awaits Option<Promise<T>> inner promises.
 */

import { Option } from "../../dist/option.mjs";

// ============================================================================
// BASIC ASYNC GEN EXAMPLES
// ============================================================================

console.log("=== Option.asyncGen() Examples ===\n");

// Example 1: Simple asyncGen with single yield
const simple = await Option.asyncGen(async function* () {
  const value = yield* Option.Some(42);
  return value;
});
console.log("1. Simple asyncGen:", simple.unwrap()); // 42

// Example 2: Multiple yields with async operations
const multiple = await Option.asyncGen(async function* () {
  const a = yield* Option.Some(5);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const b = yield* Option.Some(10);
  return a + b;
});
console.log("2. Multiple yields with delay:", multiple.unwrap()); // 15

// Example 3: Short-circuit on first None
const shortCircuit = await Option.asyncGen(async function* () {
  const a = yield* Option.Some(5);
  await new Promise((resolve) => setTimeout(resolve, 5));
  const b = yield* Option.None; // This causes None to return
  const c = yield* Option.Some(10); // This is never reached
  return a + b + c;
});
console.log("3. Short-circuit:", shortCircuit._tag); // "None"

// Example 4: asyncGen with async function calls
const fetchValue = async (key: string): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  if (key === "valid") return Option.Some(42);
  return Option.None;
};

const withFetch = await Option.asyncGen(async function* () {
  const a = yield* await fetchValue("valid");
  const b = yield* await fetchValue("valid");
  return a + b;
});
console.log("4. With async fetch:", withFetch.unwrap()); // 84

// Example 5: asyncGen for async validation pipeline
const validatePositive = async (n: number): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return n > 0 ? Option.Some(n) : Option.None;
};

const validateEven = async (n: number): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return n % 2 === 0 ? Option.Some(n) : Option.None;
};

const validate = await Option.asyncGen(async function* () {
  const input = yield* Option.Some(4);
  const positive = yield* await validatePositive(input);
  const even = yield* await validateEven(positive);
  return even * 2;
});
console.log("5. Async validation pipeline:", validate.unwrap()); // 8

// Example 6: Mixed sync and async yields
const mixed = await Option.asyncGen(async function* () {
  const a = yield* Option.Some(5); // sync
  const b = yield* Option.Some(Promise.resolve(10)); // async, auto-awaited
  return a + b;
});
console.log("6. Mixed sync/async:", mixed.unwrap()); // 15

// Example 7: Auto-awaiting Option<Promise<T>>
const autoAwait = await Option.asyncGen(async function* () {
  // Option<Promise<number>> - inner promise is auto-awaited
  const value = yield* Option.Some(Promise.resolve(42));
  // value is number, not Promise<number>
  return value * 2;
});
console.log("7. Auto-await inner promise:", autoAwait.unwrap()); // 84

// Example 8: asyncGen for dependent async lookups
type UserId = number;
type User = { id: UserId; name: string };
type PostId = number;
type Post = { id: PostId; authorId: UserId; title: string };

const getUserAsync = async (id: UserId): Promise<Option<User>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some({ id, name: `User ${id}` });
};

const getPostAsync = async (id: PostId): Promise<Option<Post>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some({ id, authorId: 1, title: `Post ${id}` });
};

const getPostAuthorAsync = async (postId: PostId) => {
  return await Option.asyncGen(async function* () {
    const post = yield* await getPostAsync(postId);
    const author = yield* await getUserAsync(post.authorId);
    return { post, author };
  });
};
const res = await getPostAuthorAsync(101);
console.log("8. Post with author:", res.unwrap()); // { post: {...}, author: {...} }

// Example 9: asyncGen with Option<Promise<T>> in chain
const promiseChain = await Option.asyncGen(async function* () {
  // First value is sync
  const a = yield* Option.Some(5);
  // Second value wraps a promise
  const b = yield* Option.Some(Promise.resolve(10));
  // Third value is sync
  const c = yield* Option.Some(15);
  return a + b + c;
});
console.log("9. Promise in chain:", promiseChain.unwrap()); // 30

// Example 10: asyncGen for fetching data patterns
const fetchUser = async (
  id: number,
): Promise<Option<{ id: number; name: string }>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some({ id, name: `User ${id}` });
};

const fetchUserPosts = async (
  _userId: number,
): Promise<Option<{ title: string }[]>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some([{ title: "Post 1" }, { title: "Post 2" }]);
};

const getUserWithPostsAsync = async (userId: number) => {
  return await Option.asyncGen(async function* () {
    const user = yield* await fetchUser(userId);
    const posts = yield* await fetchUserPosts(user.id);
    return { user, posts };
  });
};
console.log("10. User with posts:", (await getUserWithPostsAsync(1)).unwrap());

// Example 11: asyncGen with async transformation
const asyncTransform = async (arr: number[]): Promise<number[]> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return arr.map((n) => n * 2);
};

const asyncMapChain = await Option.asyncGen(async function* () {
  const arr = yield* Option.Some([1, 2, 3]);
  // Do async transformation outside of Option wrapper
  const result = await asyncTransform(arr);
  return result.reduce((sum, n) => sum + n, 0);
});
console.log("11. Async transformation:", asyncMapChain.unwrap()); // 12

// Example 12: asyncGen for complex async workflows
type Order = { id: number; total: number };
type Payment = { orderId: number; amount: number; status: string };
type Receipt = { orderId: number; paymentId: number };

const fetchOrder = async (orderId: number): Promise<Option<Order>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some({ id: orderId, total: 100 });
};

const processPayment = async (order: Order): Promise<Option<Payment>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some({
    orderId: order.id,
    amount: order.total,
    status: "paid",
  });
};

const generateReceipt = async (payment: Payment): Promise<Option<Receipt>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  return Option.Some({ orderId: payment.orderId, paymentId: 12345 });
};

const processOrderAsync = async (orderId: number) => {
  return await Option.asyncGen(async function* () {
    const order = yield* await fetchOrder(orderId);
    const payment = yield* await processPayment(order);
    const receipt = yield* await generateReceipt(payment);
    return { order, payment, receipt };
  });
};
console.log("12. Complex workflow:", (await processOrderAsync(1)).unwrap());

// Example 13: asyncGen with async transformation
const transformItems = async (items: number[]): Promise<Option<number[]>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return Option.Some(items.map((n) => n * 2));
};

const toPromiseExample = await Option.asyncGen(async function* () {
  const arr = yield* Option.Some([1, 2, 3]);
  const items = yield* await transformItems(arr);
  return items.reduce((sum, n) => sum + n, 0);
});
console.log("13. Async transform pattern:", toPromiseExample.unwrap()); // 12

// Example 14: asyncGen short-circuits on first None - demonstrates early termination
const tryFetch = async (
  url: string,
  attempt: number,
): Promise<Option<string>> => {
  await new Promise((resolve) => setTimeout(resolve, 10));
  // Simulate success on second attempt
  if (attempt === 2) {
    return Option.Some(`Data from ${url} (attempt ${attempt})`);
  }
  return Option.None;
};

const _fetchWithRetry = async (url: string) => {
  return await Option.asyncGen(async function* () {
    // Note: asyncGen short-circuits on first None, so retry logic
    // needs to be structured differently. This example shows
    // successful fetch on second attempt.
    const result1 = yield* await tryFetch(url, 1); // Returns None, short-circuits
    // Never reached because of short-circuit above
    return result1;
  });
};

// Since the above short-circuits, let's demonstrate a successful case:
const fetchSuccess = async (url: string) => {
  return await Option.asyncGen(async function* () {
    const result = yield* await tryFetch(url, 2); // Returns Some on attempt 2
    return `Fetched: ${result}`;
  });
};
console.log(
  "14. Successful fetch:",
  (await fetchSuccess("/api/data")).unwrap(),
);

// Example 15: asyncGen for batch processing
const fetchItem = async (
  id: number,
): Promise<Option<{ id: number; name: string }>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return id > 0 ? Option.Some({ id, name: `Item ${id}` }) : Option.None;
};

const fetchBatch = async (ids: number[]) => {
  return await Option.asyncGen(async function* () {
    const items = [];
    for (const id of ids) {
      const item = yield* await fetchItem(id);
      items.push(item);
    }
    return items;
  });
};
console.log("15. Batch processing:", (await fetchBatch([1, 2, 3])).unwrap()); // [{ id: 1, name: "Item 1" }, ...]

// Example 16: asyncGen with conditional async operations
const conditionalAsync = await Option.asyncGen(async function* () {
  const input = yield* Option.Some(5);
  if (input > 0) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return input * 2;
  }
  return input;
});
console.log("16. Conditional async:", conditionalAsync.unwrap()); // 10

// Example 17: asyncGen for async data transformation
type RawData = { value: string };
type ParsedData = { value: number };
type EnrichedData = { value: number; metadata: { timestamp: number } };

const parseAsync = async (data: RawData): Promise<Option<ParsedData>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  const num = Number(data.value);
  return Number.isNaN(num) ? Option.None : Option.Some({ value: num });
};

const enrichAsync = async (data: ParsedData): Promise<Option<EnrichedData>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return Option.Some({
    value: data.value,
    metadata: { timestamp: Date.now() },
  });
};

const processDataAsync = async (raw: RawData) => {
  return await Option.asyncGen(async function* () {
    const parsed = yield* await parseAsync(raw);
    const enriched = yield* await enrichAsync(parsed);
    return enriched;
  });
};
console.log(
  "17. Async data processing:",
  (await processDataAsync({ value: "42" })).unwrap(),
);

// Example 18: asyncGen for sequential API calls
const fetchConfig = async (): Promise<Option<{ apiEndpoint: string }>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return Option.Some({ apiEndpoint: "https://api.example.com" });
};

const fetchDataFromApi = async (_config: {
  apiEndpoint: string;
}): Promise<Option<{ data: string }>> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
  return Option.Some({ data: "sample data" });
};

const fetchSequential = async () => {
  return await Option.asyncGen(async function* () {
    const config = yield* await fetchConfig();
    const data = yield* await fetchDataFromApi(config);
    return { endpoint: config.apiEndpoint, data: data.data };
  });
};
console.log("18. Sequential API calls:", (await fetchSequential()).unwrap());

// Example 19: asyncGen with Promise<Option<T>>
const promiseOptionResult = await Option.asyncGen(async function* () {
  // Promise<Option<T>> - await before yielding
  const value = yield* await Promise.resolve(Option.Some(42));
  return value * 2;
});
console.log("19. Promise<Option<T>>:", promiseOptionResult.unwrap()); // 84

// Example 20: asyncGen handles Option<Promise<None>> correctly
const promiseNoneResult = await Option.asyncGen(async function* () {
  // Option<Promise<T>> where T resolves to a value that makes the inner operation return None
  const value = yield* Option.Some(Promise.resolve(5));
  // If we have a filter that fails
  const filtered = yield* Option.fromPredicate(value, (n) => n > 10);
  return filtered * 2;
});
console.log("20. Filter returns None:", promiseNoneResult._tag); // "None"

console.log("\n=== All asyncGen examples completed ===");
