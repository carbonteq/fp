/**
 * Complex Backend Example - User Enrichment Service
 *
 * Demonstrates:
 * - Orchestrating multiple async services (Database, External APIs)
 * - Error handling with custom typed errors
 * - Mixing Result (fallible) and Option (nullable) types
 * - Using Flow.asyncGenAdapter for clean, declarative control flow
 * - Uses stable Option and Result
 */

import { Flow, Option, Result } from "../../dist/index.mjs"

// ============================================================================
// 1. Domain Types & Errors
// ============================================================================

type UserID = number

interface User {
  id: UserID
  username: string
  email: string
  isActive: boolean
}

interface UserPreferences {
  theme: "light" | "dark" | "system"
  notificationsEnabled: boolean
}

interface Order {
  id: string
  total: number
  status: "pending" | "completed"
}

interface EnrichedUser {
  user: User
  preferences: UserPreferences
  recentOrders: Order[]
  lifetimeValue: number
}

// Custom Errors
class NotFoundError extends Error {
  readonly _tag = "NotFoundError"
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

class ValidationError extends Error {
  readonly _tag = "ValidationError"
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

class ServiceUnavailableError extends Error {
  readonly _tag = "ServiceUnavailableError"
  constructor(service: string) {
    super(`${service} unavailable`)
    this.name = "ServiceUnavailableError"
  }
}

// ============================================================================
// 2. Mock Services
// ============================================================================

const DB = {
  users: new Map<UserID, User>([
    [
      1,
      {
        id: 1,
        username: "alice_w",
        email: "alice@example.com",
        isActive: true,
      },
    ],
    [
      2,
      {
        id: 2,
        username: "bob_builder",
        email: "bob@example.com",
        isActive: false,
      },
    ],
  ]),
  prefs: new Map<UserID, UserPreferences>([
    [1, { theme: "dark", notificationsEnabled: true }],
  ]),
}

const UserRepository = {
  findById: async (id: UserID): Promise<Result<User, NotFoundError>> => {
    // Simulate DB latency
    await new Promise((r) => setTimeout(r, 10))

    const user = DB.users.get(id)
    return user
      ? Result.Ok(user)
      : Result.Err(new NotFoundError(`User ${id} not found`))
  },
}

const PreferencesService = {
  getPreferences: async (id: UserID): Promise<Option<UserPreferences>> => {
    await new Promise((r) => setTimeout(r, 10))
    return Option.fromNullable(DB.prefs.get(id))
  },
}

const OrderService = {
  getRecentOrders: async (
    id: UserID,
  ): Promise<Result<Order[], ServiceUnavailableError>> => {
    await new Promise((r) => setTimeout(r, 20))

    // Simulate random service failure for demo
    if (Math.random() < 0.1) {
      return Result.Err(new ServiceUnavailableError("OrderService"))
    }

    if (id === 1) {
      return Result.Ok([
        { id: "ord_123", total: 100, status: "completed" },
        { id: "ord_456", total: 49.99, status: "pending" },
      ])
    }
    return Result.Ok([])
  },
}

// ============================================================================
// 3. Main Logic: Enriched User Fow
// ============================================================================

// Default preferences if none found
const DEFAULT_PREFS: UserPreferences = {
  theme: "system",
  notificationsEnabled: false,
}

const enrichUser = (userId: number) =>
  Flow.asyncGenAdapter(async function* ($) {
    // 1. Validation Logic (Synchronous Result)
    if (userId <= 0) {
      yield* $(Result.Err(new ValidationError("User ID must be positive")))
    }

    // 2. Fetch User (Async Result)
    // The adapter automatically awaits the Promise and unwraps the Result
    console.log(`[Flow] Fetching user ${userId}...`)
    const user = yield* $(UserRepository.findById(userId))

    // 3. Early exit if inactive
    if (!user.isActive) {
      yield* $(Result.Err(new ValidationError("User is inactive")))
    }

    // 4. Fetch Preferences (Async Option) & Orders (Async Result) in parallel
    // We can use Promise.all to fetch them concurrently, then yield* to unwrap
    console.log(`[Flow] Fetching details for ${user.username}...`)

    const [prefsOpt, ordersRes] = await Promise.all([
      PreferencesService.getPreferences(user.id),
      OrderService.getRecentOrders(user.id),
    ])

    // Unwrap Orders (Result) - will bubble up ServiceUnavailableError if failed
    const orders = yield* $(ordersRes)

    // Unwrap Preferences (Option) - we want to provide a default if None,
    // rather than halting the flow (which yielding a None would do).
    // So we DON'T use yield* on the Option directly here.
    const preferences = prefsOpt.unwrapOr(DEFAULT_PREFS)

    // 5. Aggregate Data
    const lifetimeValue = orders.reduce(
      (sum, ord) => (ord.status === "completed" ? sum + ord.total : sum),
      0,
    )

    const enriched: EnrichedUser = {
      user,
      preferences,
      recentOrders: orders,
      lifetimeValue,
    }

    return enriched
  })

// ============================================================================
// 4. Execution Examples
// ============================================================================

async function runDemo() {
  console.log("--- Scenario 1: Happy Path (Alice) ---")
  const res1 = await enrichUser(1)
  /*
   * We can match on the final result to handle success/failure
   */
  res1.match({
    Ok: (data) => console.log("SUCCESS:", JSON.stringify(data, null, 2)),
    Err: (err) => console.error("FAILURE:", err.message),
  })

  console.log("\n--- Scenario 2: User Not Found (ID 99) ---")
  const res2 = await enrichUser(99)
  console.log(
    "Result:",
    res2.isErr() ? `Left(${res2.unwrapErr().message})` : "Ok",
  )

  console.log("\n--- Scenario 3: Validation Error (ID -5) ---")
  const res3 = await enrichUser(-5)
  console.log(
    "Result:",
    res3.isErr() ? `Left(${res3.unwrapErr().message})` : "Ok",
  )

  console.log("\n--- Scenario 4: Logical Validation (Bob - Inactive) ---")
  const res4 = await enrichUser(2)
  console.log(
    "Result:",
    res4.isErr() ? `Left(${res4.unwrapErr().message})` : "Ok",
  )
}

runDemo().catch(console.error)
