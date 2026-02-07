/**
 * Complex Backend Example - User Enrichment Service
 *
 * Demonstrates:
 * - Orchestrating multiple async services (Database, External APIs)
 * - Error handling with custom typed errors using FlowError
 * - Mixing Result (fallible) and Option (nullable) types
 * - Using Flow.asyncGen with direct error yielding via FlowError
 * - Uses stable Option and Result
 */

import { Flow, FlowError, Option, Result } from "../../src/index.js"

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

// Custom Errors - extend FlowError for direct yielding in Flow generators
class NotFoundError extends FlowError {
  readonly _tag = "NotFoundError"
  constructor(message: string) {
    super(message)
    Object.defineProperty(this, "name", { value: "NotFoundError" })
  }
}

class ValidationError extends FlowError {
  readonly _tag = "ValidationError"
  constructor(message: string) {
    super(message)
    Object.defineProperty(this, "name", { value: "ValidationError" })
  }
}

class ServiceUnavailableError extends FlowError {
  readonly _tag = "ServiceUnavailableError"
  constructor(service: string) {
    super(`${service} unavailable`)
    Object.defineProperty(this, "name", { value: "ServiceUnavailableError" })
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

const enrichUser = async (userId: number) => {
  return await Flow.asyncGen(async function* () {
    // Direct error yielding with FlowError - no Result.Err wrapper needed!
    if (userId <= 0) {
      yield* new ValidationError("UserID must be positive")
    }

    console.log(`[Flow] Fetching user ${userId}...`)
    const user = yield* await UserRepository.findById(userId)

    if (!user.isActive) {
      yield* new ValidationError("User account is inactive")
    }

    console.log(`[Flow] Fetching details for ${user.username}...`)

    const orders = yield* await OrderService.getRecentOrders(user.id)

    const prefsOpt = await PreferencesService.getPreferences(user.id)
    const preferences = prefsOpt.unwrapOr(DEFAULT_PREFS)

    const lifetimeValue = orders.reduce(
      (sum, order) => (order.status === "completed" ? sum + order.total : sum),
      0,
    )

    const enrichedUser: EnrichedUser = {
      user,
      preferences,
      recentOrders: orders,
      lifetimeValue,
    }

    return enrichedUser
  })
}

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
    Err: (err) => console.error("FAILURE:", (err as Error).message),
  })

  console.log("\n--- Scenario 2: User Not Found (ID 99) ---")
  const res2 = await enrichUser(99)
  console.log(
    "Result:",
    res2.isErr() ? `Left(${(res2.unwrapErr() as Error).message})` : "Ok",
  )

  console.log("\n--- Scenario 3: Validation Error (ID -5) ---")
  const res3 = await enrichUser(-5)
  console.log(
    "Result:",
    res3.isErr() ? `Left(${(res3.unwrapErr() as Error).message})` : "Ok",
  )

  console.log("\n--- Scenario 4: Logical Validation (Bob - Inactive) ---")
  const res4 = await enrichUser(2)
  console.log(
    "Result:",
    res4.isErr() ? `Left(${(res4.unwrapErr() as Error).message})` : "Ok",
  )
}

runDemo().catch(console.error)
