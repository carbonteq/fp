/**
 * Option.asyncGenAdapter() - Async generator with adapter
 *
 * Option.asyncGenAdapter() provides the same imperative-style async code
 * as asyncGen(), but with an adapter function ($) for improved type inference
 * when working with Promise<Option<T>> and Option<Promise<T>>.
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs"

// ============================================================================
// BASIC ASYNC GENADAPTER EXAMPLES
// ============================================================================

console.log("=== Option.asyncGenAdapter() Examples ===\n")

// Example 1: Simple asyncGenAdapter with single yield
const simple = await Option.asyncGenAdapter(async function* ($) {
  const value = yield* $(Option.Some(42))
  return value
})
console.log("1. Simple asyncGenAdapter:", simple.unwrap()) // 42

// Example 2: Multiple yields with async operations
const multiple = await Option.asyncGenAdapter(async function* ($) {
  const a = yield* $(Option.Some(5))
  await new Promise((resolve) => setTimeout(resolve, 10))
  const b = yield* $(Option.Some(10))
  return a + b
})
console.log("2. Multiple yields with delay:", multiple.unwrap()) // 15

// Example 3: Short-circuit on first None
const shortCircuit = await Option.asyncGenAdapter(async function* ($) {
  const a = yield* $(Option.Some(5))
  await new Promise((resolve) => setTimeout(resolve, 5))
  const b = yield* $(Option.None) // This causes None to return
  const c = yield* $(Option.Some(10)) // This is never reached
  return a + b + c
})
console.log("3. Short-circuit:", shortCircuit._tag) // "None"

// Example 4: asyncGenAdapter with Promise<Option<T>>
const fetchValue = async (key: string): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 10))
  if (key === "valid") return Option.Some(42)
  return Option.None
}

const withFetch = await Option.asyncGenAdapter(async function* ($) {
  const a = yield* $(await fetchValue("valid"))
  const b = yield* $(await fetchValue("valid"))
  return a + b
})
console.log("4. With Promise<Option>:", withFetch.unwrap()) // 84

// Example 5: asyncGenAdapter with Option<Promise<T>>
const autoAwait = await Option.asyncGenAdapter(async function* ($) {
  // Option<Promise<number>> - inner promise is auto-awaited
  const value = yield* $(Option.Some(Promise.resolve(42)))
  return value * 2
})
console.log("5. Auto-await inner promise:", autoAwait.unwrap()) // 84

// Example 6: Mixed Promise<Option> and Option<Promise>
const mixed = await Option.asyncGenAdapter(async function* ($) {
  const a = yield* $(Option.Some(5)) // sync
  const b = yield* $(await Promise.resolve(Option.Some(10))) // Promise<Option>
  const c = yield* $(Option.Some(Promise.resolve(15))) // Option<Promise>
  return a + b + c
})
console.log("6. Mixed sync/async:", mixed.unwrap()) // 30

// Example 7: asyncGenAdapter for API composition
type UserId = number
type User = { id: UserId; name: string }
type PostId = number
type Post = { id: PostId; authorId: UserId; title: string }

const getUserAsync = async (id: UserId): Promise<Option<User>> => {
  await new Promise((resolve) => setTimeout(resolve, 10))
  return Option.Some({ id, name: `User ${id}` })
}

const getPostAsync = async (id: PostId): Promise<Option<Post>> => {
  await new Promise((resolve) => setTimeout(resolve, 10))
  return Option.Some({ id, authorId: 1, title: `Post ${id}` })
}

const getPostWithAuthorAsync = async (postId: PostId) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const post = yield* $(await getPostAsync(postId))
    const author = yield* $(await getUserAsync(post.authorId))
    return { post, author }
  })
}
console.log("7. API composition:", (await getPostWithAuthorAsync(101)).unwrap())

// Example 8: asyncGenAdapter for complex async validation
const validateEmailAsync = async (email: string): Promise<Option<string>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return email.includes("@") ? Option.Some(email) : Option.None
}

const validatePasswordAsync = async (
  password: string,
): Promise<Option<string>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return password.length >= 8 ? Option.Some(password) : Option.None
}

const validateAgeAsync = async (age: number): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return age >= 18 ? Option.Some(age) : Option.None
}

const validateUserAsync = async (data: {
  email: string
  password: string
  age: number
}) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const validEmail = yield* $(await validateEmailAsync(data.email))
    const validPassword = yield* $(await validatePasswordAsync(data.password))
    const validAge = yield* $(await validateAgeAsync(data.age))

    return {
      email: validEmail,
      password: validPassword,
      age: validAge,
    }
  })
}
console.log(
  "8. Valid user:",
  (
    await validateUserAsync({
      email: "test@example.com",
      password: "password123",
      age: 25,
    })
  ).unwrap(),
)

// Example 9: asyncGenAdapter for transaction workflows
type Account = { balance: number }
type TransferResult = { fromBalance: number; toBalance: number }

const getAccountAsync = async (id: number): Promise<Option<Account>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  const accounts = new Map<number, Account>([
    [1, { balance: 100 }],
    [2, { balance: 50 }],
  ])
  return Option.fromNullable(accounts.get(id))
}

const debitAsync = async (
  account: Account,
  amount: number,
): Promise<Option<Account>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return account.balance >= amount
    ? Option.Some({ balance: account.balance - amount })
    : Option.None
}

const creditAsync = async (
  account: Account,
  amount: number,
): Promise<Option<Account>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some({ balance: account.balance + amount })
}

const transferAsync = async (fromId: number, toId: number, amount: number) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const fromAccount = yield* $(await getAccountAsync(fromId))
    const toAccount = yield* $(await getAccountAsync(toId))

    const debited = yield* $(await debitAsync(fromAccount, amount))
    const credited = yield* $(await creditAsync(toAccount, amount))

    return {
      fromBalance: debited.balance,
      toBalance: credited.balance,
    } as TransferResult
  })
}
console.log("9. Transfer:", (await transferAsync(1, 2, 30)).unwrap()) // { fromBalance: 70, toBalance: 80 }

// Example 10: asyncGenAdapter demonstrating proper async fallback
// Note: For retry logic, it's often better to handle retries outside the generator
// since None values cause immediate short-circuiting
const fetchWithFallbackAsync = async (
  url: string,
  fallback: string,
): Promise<string> => {
  const tryFetchAsync = async (attempt: number): Promise<Option<string>> => {
    await new Promise((resolve) => setTimeout(resolve, 10))
    // Simulate success on 3rd attempt
    if (attempt >= 3) {
      return Option.Some(`Data from ${url} (attempt ${attempt})`)
    }
    return Option.None // Simulate failure
  }

  // Manual retry loop outside asyncGenAdapter
  for (let i = 1; i <= 3; i++) {
    const result = await tryFetchAsync(i)
    if (result.isSome()) {
      return result.unwrap()
    }
  }
  return fallback // Return fallback if all attempts fail
}

console.log(
  "10. Retry with fallback:",
  await fetchWithFallbackAsync("/api/data", "fallback data"),
) // Should succeed on 3rd attempt

// Example 11: asyncGenAdapter for data processing pipelines
type RawData = { value: string }
type ParsedData = { value: number }
type ValidatedData = { value: number; valid: true }
type EnrichedData = { value: number; valid: true; timestamp: number }

const parseAsync = async (data: RawData): Promise<Option<ParsedData>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  const num = Number(data.value)
  return Number.isNaN(num) ? Option.None : Option.Some({ value: num })
}

const validateAsync = async (
  data: ParsedData,
): Promise<Option<ValidatedData>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return data.value > 0
    ? Option.Some({ value: data.value, valid: true })
    : Option.None
}

const enrichAsync = async (
  data: ValidatedData,
): Promise<Option<EnrichedData>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some({ ...data, timestamp: Date.now() })
}

const processPipelineAsync = async (raw: RawData) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const parsed = yield* $(await parseAsync(raw))
    const validated = yield* $(await validateAsync(parsed))
    const enriched = yield* $(await enrichAsync(validated))
    return enriched
  })
}
console.log(
  "11. Processing pipeline:",
  (await processPipelineAsync({ value: "42" })).unwrap(),
)

// Example 12: asyncGenAdapter for batch operations
const fetchItemAsync = async (
  id: number,
): Promise<Option<{ id: number; name: string }>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return id > 0 ? Option.Some({ id, name: `Item ${id}` }) : Option.None
}

const fetchBatchAsync = async (ids: number[]) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const items = []
    for (const id of ids) {
      const item = yield* $(await fetchItemAsync(id))
      items.push(item)
    }
    return items
  })
}
console.log(
  "12. Batch operations:",
  (await fetchBatchAsync([1, 2, 3])).unwrap(),
)

// Example 13: asyncGenAdapter for parallel-like patterns (sequential)
const fetchMultipleAsync = async (...ids: number[]) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const results = []
    for (const id of ids) {
      const result = yield* $(await fetchItemAsync(id))
      results.push(result)
    }
    return results
  })
}
console.log(
  "13. Multiple fetches:",
  (await fetchMultipleAsync(1, 2, 3)).unwrap(),
)

// Example 14: asyncGenAdapter with async transformation
const transformItemsAsync = async (
  items: number[],
): Promise<Option<number[]>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some(items.map((n) => n * 2))
}

const toPromiseExample = await Option.asyncGenAdapter(async function* ($) {
  const arr = yield* $(Option.Some([1, 2, 3]))
  const items = yield* $(await transformItemsAsync(arr))
  return items.reduce((sum, n) => sum + n, 0)
})
console.log("14. Async transformation:", toPromiseExample.unwrap()) // 12

// Example 15: asyncGenAdapter for complex workflows
type Order = { id: number; total: number }
type Payment = { orderId: number; amount: number }
type Shipment = { orderId: number; tracking: string }
type Invoice = { orderId: number; paymentId: number }

const fetchOrderAsync = async (orderId: number): Promise<Option<Order>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some({ id: orderId, total: 100 })
}

const processPaymentAsync = async (order: Order): Promise<Option<Payment>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some({ orderId: order.id, amount: order.total })
}

const arrangeShipmentAsync = async (
  payment: Payment,
): Promise<Option<Shipment>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some({ orderId: payment.orderId, tracking: "TRACK-123" })
}

const generateInvoiceAsync = async (
  shipment: Shipment,
): Promise<Option<Invoice>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some({ orderId: shipment.orderId, paymentId: 56789 })
}

const processOrderFullAsync = async (orderId: number) => {
  return await Option.asyncGenAdapter(async function* ($) {
    const order = yield* $(await fetchOrderAsync(orderId))
    const payment = yield* $(await processPaymentAsync(order))
    const shipment = yield* $(await arrangeShipmentAsync(payment))
    const invoice = yield* $(await generateInvoiceAsync(shipment))

    return { order, payment, shipment, invoice }
  })
}
console.log(
  "15. Full order workflow:",
  (await processOrderFullAsync(1)).unwrap(),
)

// Example 16: asyncGenAdapter with conditional logic
const conditionalAsync = await Option.asyncGenAdapter(async function* ($) {
  const input = yield* $(Option.Some(5))
  if (input > 0) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    return input * 2
  }
  return input
})
console.log("16. Conditional async:", conditionalAsync.unwrap()) // 10

// Example 17: asyncGenAdapter with error recovery
const riskyOperationAsync = async (value: number): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  // Simulate 50% failure rate
  return Math.random() > 0.5 ? Option.Some(value * 2) : Option.None
}

const withRecoveryAsync = async (value: number) => {
  const opt = await Option.asyncGenAdapter(async function* ($) {
    const result = yield* $(await riskyOperationAsync(value))
    return result
  })

  return opt.unwrapOr(value) // Fallback to original value
}
console.log("17. With recovery (may vary):", await withRecoveryAsync(5)) // Either 10 or 5

// Example 18: asyncGenAdapter for nested operations
const nestedAsync = await Option.asyncGenAdapter(async function* ($) {
  const outer = yield* $(Option.Some(5))

  const inner = await Option.asyncGenAdapter(async function* ($) {
    const doubled = yield* $(Option.Some(outer * 2))
    await new Promise((resolve) => setTimeout(resolve, 5))
    const tripled = yield* $(Option.Some(outer * 3))
    return { doubled, tripled }
  })

  return yield* $(inner)
})
console.log("18. Nested operations:", nestedAsync.unwrap()) // { doubled: 10, tripled: 15 }

// Example 19: asyncGenAdapter with streaming-like patterns
type StreamItem = { index: number; value: string }
const streamItemsAsync = async function* (): AsyncGenerator<
  Option<StreamItem>
> {
  const items = ["a", "b", "c"]
  for (let i = 0; i < items.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 5))
    // biome-ignore lint/style/noNonNullAssertion: no need
    yield Option.Some({ index: i, value: items[i]! })
  }
}

const processStreamAsync = async () => {
  return await Option.asyncGenAdapter(async function* ($) {
    const results = []
    for await (const item of streamItemsAsync()) {
      const value = yield* $(item)
      results.push(value)
    }
    return results
  })
}
console.log("19. Stream processing:", (await processStreamAsync()).unwrap()) // [{ index: 0, value: "a" }, ...]

// Example 20: asyncGenAdapter for aggregating data
const fetchMetricAsync = async (name: string): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  const metrics: Record<string, number> = {
    cpu: 75,
    memory: 60,
    disk: 45,
  }
  return Option.fromNullable(metrics[name])
}

const getAverageMetricAsync = async (...names: string[]) => {
  return await Option.asyncGenAdapter(async function* ($) {
    let sum = 0
    let count = 0

    for (const name of names) {
      const value = yield* $(await fetchMetricAsync(name))
      sum += value
      count++
    }

    return count > 0 ? sum / count : 0
  })
}
console.log(
  "20. Average metric:",
  (await getAverageMetricAsync("cpu", "memory", "disk")).unwrap(),
) // 60

// Example 21: asyncGenAdapter comparing with asyncGen
console.log("\n=== asyncGen vs asyncGenAdapter Comparison ===\n")

console.log("asyncGen:")
console.log("  - yield* Option.Some(value)")
console.log("  - yield* await Promise<Option<T>>")
console.log("  - Auto-awaits Option<Promise<T>>")

console.log("\nasyncGenAdapter:")
console.log("  - yield* $(Option.Some(value))")
console.log("  - yield* $(await Promise<Option<T>>)")
console.log("  - yield* $(Option<Promise<T>>)")
console.log("  - Better type inference")
console.log("  - Adapter ($) makes yields explicit")

console.log("\nBoth support:")
console.log("  - Mixed sync/async operations")
console.log("  - Automatic None short-circuiting")
console.log("  - Promise<Option<T>> and Option<Promise<T>>")

// Example 22: asyncGenAdapter with complex state management
type State = {
  users: number
  posts: number
  comments: number
}

const fetchUsersCountAsync = async (): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some(100)
}

const fetchPostsCountAsync = async (): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some(500)
}

const fetchCommentsCountAsync = async (): Promise<Option<number>> => {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return Option.Some(2000)
}

const buildDashboardStateAsync = async () => {
  return await Option.asyncGenAdapter(async function* ($) {
    const users = yield* $(await fetchUsersCountAsync())
    const posts = yield* $(await fetchPostsCountAsync())
    const comments = yield* $(await fetchCommentsCountAsync())

    return { users, posts, comments } as State
  })
}
console.log("22. Dashboard state:", (await buildDashboardStateAsync()).unwrap()) // { users: 100, posts: 500, comments: 2000 }

console.log("\n=== All asyncGenAdapter examples completed ===")
