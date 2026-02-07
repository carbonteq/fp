import { Result } from "./dist/result.mjs"

// ============================================================================
// DOMAIN MODELS
// ============================================================================

type UserId = string
type GroceryListId = string
type ItemId = string

type SerializedUser = {
  id: UserId
  name: string
  email: string
}

class UserEntity {
  constructor(
    readonly id: UserId,
    readonly name: string,
    readonly email: string,
  ) {}

  serialize(): SerializedUser {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    }
  }
}

type SerializedItem = {
  id: ItemId
  name: string
  quantity: number
  isBought: boolean
}

class ItemEntity {
  constructor(
    readonly id: ItemId,
    readonly name: string,
    readonly quantity: number,
    readonly isBought: boolean,
  ) {}

  serialize(): SerializedItem {
    return {
      id: this.id,
      name: this.name,
      quantity: this.quantity,
      isBought: this.isBought,
    }
  }
}

type SerializedGroceryList = {
  id: GroceryListId
  name: string
  description: string
  active: boolean
  ownerId: UserId
}

class GroceryListEntity {
  constructor(
    readonly id: GroceryListId,
    readonly name: string,
    readonly description: string,
    readonly active: boolean,
    readonly ownerId: UserId,
  ) {}

  serialize(): SerializedGroceryList {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      active: this.active,
      ownerId: this.ownerId,
    }
  }

  ensureIsOwner(user: UserEntity): Result<this, GroceryListOwnershipError> {
    if (this.ownerId !== user.id) {
      return Result.Err(new GroceryListOwnershipError(this.id))
    }
    return Result.Ok(this)
  }
}

interface GroceryListStats {
  totalItems: number
  pendingItems: number
  completedItems: number
  completionPercentage: number
}

interface GroceryListDetails {
  id: GroceryListId
  name: string
  description: string
  active: boolean
  owner: SerializedUser
  items: SerializedItem[]
  stats: GroceryListStats
}

// ============================================================================
// ERROR TYPES
// ============================================================================

class GroceryListOwnershipError {
  readonly _tag = "GroceryListOwnershipError"
  constructor(readonly listId: GroceryListId) {}
}

class ValidationError {
  readonly _tag = "ValidationError"
  constructor(readonly message: string) {}
}

type GroceryListError = GroceryListOwnershipError | ValidationError

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateDetailedStats(items: ItemEntity[]): GroceryListStats {
  const totalItems = items.length
  const pendingItems = items.filter((item) => !item.isBought).length
  const completedItems = items.filter((item) => item.isBought).length

  const completionPercentage =
    totalItems > 0 ? (completedItems / totalItems) * 100 : 0

  return {
    totalItems,
    pendingItems,
    completedItems,
    completionPercentage: Math.round(completionPercentage * 100) / 100,
  }
}

// ============================================================================
// MOCK DATA
// ============================================================================

const mockUser = new UserEntity("user-123", "Alice", "alice@example.com")

const mockDifferentUser = new UserEntity("user-999", "Bob", "bob@example.com")

const mockGroceryList = new GroceryListEntity(
  "list-456",
  "Weekly Shopping",
  "Weekly grocery list",
  true,
  "user-123",
)

const mockItems: ItemEntity[] = [
  new ItemEntity("item-1", "Milk", 2, true),
  new ItemEntity("item-2", "Eggs", 12, false),
  new ItemEntity("item-3", "Bread", 1, false),
]

// ============================================================================
// REPOSITORY/WORKFLOW METHODS - Return Results for composition
// ============================================================================

// SYNC: Fetch user by ID (returns Result)
function fetchUserById(id: UserId): Result<UserEntity, ValidationError> {
  if (id === "user-123") {
    return Result.Ok(mockUser)
  }
  return Result.Err(new ValidationError(`User not found: ${id}`))
}

// SYNC: Validate list is active (returns Result)
function ensureListIsActive(
  list: GroceryListEntity,
): Result<GroceryListEntity, ValidationError> {
  if (list.active) {
    return Result.Ok(list)
  }
  return Result.Err(new ValidationError("List is not active"))
}

// SYNC: Validate items array (returns Result)
function validateItems(
  items: ItemEntity[],
): Result<ItemEntity[], ValidationError> {
  if (items.length === 0) {
    return Result.Err(new ValidationError("Items cannot be empty"))
  }
  const hasInvalidQuantity = items.some((item) => item.quantity <= 0)
  if (hasInvalidQuantity) {
    return Result.Err(
      new ValidationError("All items must have positive quantity"),
    )
  }
  return Result.Ok(items)
}

// SYNC: Filter and sort items (returns Result)
function filterActiveItems(
  items: ItemEntity[],
): Result<ItemEntity[], ValidationError> {
  const filtered = items.filter((item) => !item.isBought)
  if (filtered.length === 0) {
    return Result.Err(new ValidationError("No active items found"))
  }
  return Result.Ok(filtered)
}

// ASYNC: Fetch user by ID from "database" (returns Promise<Result>)
async function fetchUserByIdAsync(
  id: UserId,
): Promise<Result<UserEntity, ValidationError>> {
  await new Promise((resolve) => setTimeout(resolve, 10))
  return fetchUserById(id)
}

// ASYNC: Fetch items for a list (returns Promise<Result>)
async function fetchItemsForListAsync(
  listId: GroceryListId,
): Promise<Result<ItemEntity[], ValidationError>> {
  await new Promise((resolve) => setTimeout(resolve, 10))
  if (listId === "list-456") {
    return Result.Ok(mockItems)
  }
  return Result.Err(new ValidationError(`Items not found for list: ${listId}`))
}

// ASYNC: Serialize items with some processing (returns Promise, use as mapper)
async function serializeItemsAsync(
  items: ItemEntity[],
): Promise<SerializedItem[]> {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return items.map((item) => item.serialize())
}

// ASYNC: Calculate stats with simulated work (returns Promise, use as mapper)
async function calculateDetailedStatsAsync(
  items: ItemEntity[],
): Promise<GroceryListStats> {
  await new Promise((resolve) => setTimeout(resolve, 5))
  return calculateDetailedStats(items)
}

// ASYNC: Validate user permissions (returns Promise<Result>)
async function validateUserPermissionsAsync(
  user: UserEntity,
  list: GroceryListEntity,
): Promise<Result<UserEntity, ValidationError>> {
  await new Promise((resolve) => setTimeout(resolve, 5))
  if (user.id === list.ownerId) {
    return Result.Ok(user)
  }
  return Result.Err(new ValidationError("User lacks permission"))
}

// ASYNC: Fetch and enrich list with owner (returns Promise<Result>)
async function fetchListWithOwnerAsync(
  listId: GroceryListId,
  userId: UserId,
): Promise<
  Result<{ list: GroceryListEntity; owner: UserEntity }, ValidationError>
> {
  const owner = await fetchUserByIdAsync(userId)
  if (owner.isErr()) {
    return Result.Err(owner.unwrapErr())
  }

  // In real code, would fetch list from DB. Here we use mock
  if (listId !== "list-456") {
    return Result.Err(new ValidationError(`List not found: ${listId}`))
  }

  return Result.Ok({ list: mockGroceryList, owner: owner.unwrap() })
}

// ============================================================================
// IMPLEMENTATION STYLES - Implement processListDetails here
// ============================================================================

// Style 1: flatMap chain
function processListDetailsUsingFlatMap(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  const r = list
    .ensureIsOwner(owner)
    .map((_) => list.serialize())
    .zip((_) => owner.serialize())
    .map(([listEncoded, ownerEncoded]) => {
      const itemsEncoded = items.map((item) => item.serialize())

      return {
        owner: ownerEncoded,
        list: listEncoded,
        items: itemsEncoded,
      }
    })
    .map(({ list, owner, items: itemsSerialized }) => {
      const stats = calculateDetailedStats(items)

      return {
        ...list,
        items: itemsSerialized,
        owner,
        stats,
      }
    })

  return r
}

const result1_ok = processListDetailsUsingFlatMap(
  mockGroceryList,
  mockUser,
  mockItems,
)
const result1_err = processListDetailsUsingFlatMap(
  mockGroceryList,
  mockDifferentUser,
  mockItems,
)

console.log("---------------------- Using normal composition ---------------")
console.log(result1_ok._tag, result1_ok.safeUnwrap())
console.log(result1_err._tag, result1_err.safeUnwrap())

// Style 2: Result.gen (simplified)
function processListDetailsUsingGen(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  const r = Result.gen(function* () {
    yield* list.ensureIsOwner(owner)

    const listEncoded = list.serialize()
    const ownerEncoded = owner.serialize()
    const itemsEncoded = items.map((item) => item.serialize())

    const stats = calculateDetailedStats(items)

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    }
  })

  return r
}

const result2_ok = processListDetailsUsingGen(
  mockGroceryList,
  mockUser,
  mockItems,
)
const result2_err = processListDetailsUsingGen(
  mockGroceryList,
  mockDifferentUser,
  mockItems,
)

console.log("---------------------- Using Result.gen ---------------")
console.log(result2_ok._tag, result2_ok.safeUnwrap())
console.log(result2_err._tag, result2_err.safeUnwrap())

// Style 3: Result.genAdapter
function processListDetailsUsingGenAdapter(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  const r = Result.genAdapter(function* ($) {
    yield* $(list.ensureIsOwner(owner))

    const listEncoded = list.serialize()
    const ownerEncoded = owner.serialize()
    const itemsEncoded = items.map((item) => item.serialize())

    const stats = calculateDetailedStats(items)

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    }
  })

  return r
}
const result3_ok = processListDetailsUsingGenAdapter(
  mockGroceryList,
  mockUser,
  mockItems,
)
const result3_err = processListDetailsUsingGenAdapter(
  mockGroceryList,
  mockDifferentUser,
  mockItems,
)
console.log("---------------------- Using Result.genAdapter ---------------")
console.log(result3_ok._tag, result3_ok.safeUnwrap())
console.log(result3_err._tag, result3_err.safeUnwrap())

// Style 4: Result.asyncGen
async function _processListDetailsAsync(
  _list: GroceryListEntity,
  _owner: UserEntity,
  _items: ItemEntity[],
): Promise<Result<GroceryListDetails, GroceryListError>> {
  // TODO: Implement
  throw new Error("Not implemented")
}

// Style 5: Result.asyncGenAdapter
async function _processListDetailsAsyncAdapter(
  _list: GroceryListEntity,
  _owner: UserEntity,
  _items: ItemEntity[],
): Promise<Result<GroceryListDetails, GroceryListError>> {
  // TODO: Implement
  throw new Error("Not implemented")
}

// ============================================================================
// ADDITIONAL COMPOSITION EXAMPLES - Using repository methods
// ============================================================================

// Example 1: Multiple validation steps with sync Result-returning functions
function processListWithValidations(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<GroceryListDetails, GroceryListError> {
  return Result.gen(function* () {
    // Step 1: Ensure ownership
    yield* list.ensureIsOwner(owner)

    // Step 2: Validate list is active
    yield* ensureListIsActive(list)

    // Step 3: Validate items
    const validItems = yield* validateItems(items)

    // Step 4: Serialize everything
    const listEncoded = list.serialize()
    const ownerEncoded = owner.serialize()
    const itemsEncoded = validItems.map((item) => item.serialize())

    // Step 5: Calculate stats
    const stats = calculateDetailedStats(validItems)

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    }
  })
}

console.log(
  "---------------------- Multi-step validation (sync) ---------------",
)
const validResult = processListWithValidations(
  mockGroceryList,
  mockUser,
  mockItems,
)
console.log("Valid:", validResult._tag, validResult.safeUnwrap()?.owner?.name)

// Test with invalid items
const invalidItems: ItemEntity[] = []
const invalidResult = processListWithValidations(
  mockGroceryList,
  mockUser,
  invalidItems,
)
console.log(
  "Invalid items:",
  invalidResult._tag,
  invalidResult.unwrapErr()?._tag,
)

// Example 2: Fetching user and validating in one flow
function fetchAndValidateUser(
  userId: UserId,
): Result<SerializedUser, ValidationError> {
  return fetchUserById(userId).map((user) => user.serialize())
}

console.log("\n---------------------- Fetch and validate user ---------------")
const fetchedUser = fetchAndValidateUser("user-123")
console.log("Found:", fetchedUser._tag, fetchedUser.safeUnwrap()?.name)

const notFoundUser = fetchAndValidateUser("unknown")
console.log("Not found:", notFoundUser._tag, notFoundUser.unwrapErr()?.message)

// Example 3: Chaining multiple Result-returning functions with flatMap
function getActiveItemsStats(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<{ stats: GroceryListStats; activeCount: number }, GroceryListError> {
  return list
    .ensureIsOwner(owner)
    .map((_) => items)
    .flatMap((items) => filterActiveItems(items))
    .map((activeItems) => ({
      stats: calculateDetailedStats(items),
      activeCount: activeItems.length,
    }))
}

console.log("\n---------------------- Chaining flatMap ---------------")
const activeStats = getActiveItemsStats(mockGroceryList, mockUser, mockItems)
console.log("Active stats:", activeStats._tag, activeStats.safeUnwrap())

// Example 4: asyncGen with async fetch methods
async function processListAsyncFetch(
  listId: GroceryListId,
  userId: UserId,
): Promise<Result<GroceryListDetails, GroceryListError>> {
  return Result.asyncGen(async function* () {
    // Fetch list with owner
    const { list, owner } = yield* await fetchListWithOwnerAsync(listId, userId)

    // Ensure ownership
    yield* list.ensureIsOwner(owner)

    // Fetch items
    const items = yield* await fetchItemsForListAsync(listId)

    // Validate list is active
    yield* ensureListIsActive(list)

    // Use async mappers for serialization and stats
    const itemsSerialized = yield* Result.Ok(items).map(serializeItemsAsync)
    const stats = yield* Result.Ok(items).map(calculateDetailedStatsAsync)

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      active: list.active,
      owner: owner.serialize(),
      items: itemsSerialized,
      stats,
    }
  })
}

console.log(
  "\n---------------------- asyncGen with async fetch ---------------",
)
const asyncFetchResult = await processListAsyncFetch("list-456", "user-123")
console.log(
  "Async fetch:",
  asyncFetchResult._tag,
  asyncFetchResult.safeUnwrap()?.owner?.name,
)

// Example 5: asyncGenAdapter with async operations
async function processListAsyncAdapterWithValidations(
  listId: GroceryListId,
  userId: UserId,
): Promise<Result<GroceryListDetails, GroceryListError>> {
  return Result.asyncGenAdapter(async function* ($) {
    // Fetch and validate in one flow
    const { list, owner } = yield* $(
      await fetchListWithOwnerAsync(listId, userId),
    )

    // Ensure ownership
    yield* $(list.ensureIsOwner(owner))

    // Async permission validation
    yield* $(await validateUserPermissionsAsync(owner, list))

    // Fetch items
    const items = yield* $(await fetchItemsForListAsync(listId))

    // Validate items
    const validItems = yield* $(validateItems(items))

    // Use async mappers
    const itemsSerialized = yield* $(
      Result.Ok(validItems).map(serializeItemsAsync),
    )
    const stats = yield* $(
      Result.Ok(validItems).map(calculateDetailedStatsAsync),
    )

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      active: list.active,
      owner: owner.serialize(),
      items: itemsSerialized,
      stats,
    }
  })
}

console.log(
  "\n---------------------- asyncGenAdapter with validations ---------------",
)
const adapterResult = await processListAsyncAdapterWithValidations(
  "list-456",
  "user-123",
)
console.log(
  "Adapter result:",
  adapterResult._tag,
  adapterResult.safeUnwrap()?.stats,
)

// Example 6: Error recovery with orElse
function processListWithFallback(
  listId: GroceryListId,
  userId: UserId,
): Result<GroceryListDetails, GroceryListError> {
  return fetchUserById(userId)
    .flatMap((_user) => {
      if (listId !== "list-456") {
        return Result.Err(new ValidationError("List not found"))
      }
      return Result.Ok(mockGroceryList)
    })
    .flatMap((list) => list.ensureIsOwner(mockUser))
    .orElse((err) => {
      // Provide fallback on error
      console.log("Error, using fallback:", err._tag || err.message)
      return Result.Ok(mockGroceryList)
    })
}

console.log(
  "\n---------------------- Error recovery with orElse ---------------",
)
const fallbackResult = processListWithFallback("unknown-list", "user-123")
console.log("Fallback result:", fallbackResult._tag)

// Example 7: Using validate() for collecting multiple errors
function validateListComprehensive(
  list: GroceryListEntity,
  items: ItemEntity[],
): Result<GroceryListEntity, ValidationError[]> {
  return Result.Ok(list).validate([
    (list) => ensureListIsActive(list),
    (list) => validateItems(items).map(() => list),
  ])
}

console.log(
  "\n---------------------- validate() for error collection ---------------",
)
const validated = validateListComprehensive(mockGroceryList, mockItems)
console.log("Validated:", validated._tag)

const inactiveList = new GroceryListEntity(
  "list-inactive",
  "Inactive",
  "Not active",
  false,
  "user-123",
)
const invalidValidated = validateListComprehensive(inactiveList, [])
console.log(
  "Invalid validated:",
  invalidValidated._tag,
  invalidValidated.unwrapErr(),
)

// Example 8: Complex workflow - flatZip to preserve original value
function processListWithContext(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Result<
  { list: GroceryListEntity; owner: UserEntity; items: ItemEntity[] },
  GroceryListError
> {
  return list
    .ensureIsOwner(owner)
    .flatZip((list) =>
      validateItems(items).map((items) => ({ list, owner, items })),
    )
}

console.log(
  "\n---------------------- flatZip for context preservation ---------------",
)
const contextResult = processListWithContext(
  mockGroceryList,
  mockUser,
  mockItems,
)
console.log("Context result:", contextResult._tag, contextResult.safeUnwrap())

// Example 9: Async workflow with toPromise conversion
async function processListWithToPromise(
  list: GroceryListEntity,
  items: ItemEntity[],
): Promise<Result<GroceryListDetails, GroceryListError>> {
  return Result.Ok(items)
    .flatMap(serializeItemsAsync)
    .flatMap((itemsSerialized) => Result.Ok(itemsSerialized))
    .map((itemsSerialized) => {
      const stats = calculateDetailedStats(items)
      return {
        id: list.id,
        name: list.name,
        description: list.description,
        active: list.active,
        owner: mockUser.serialize(),
        items: itemsSerialized,
        stats,
      }
    })
}

console.log("\n---------------------- toPromise conversion ---------------")
const toPromiseResult = await processListWithToPromise(
  mockGroceryList,
  mockItems,
)
console.log(
  "toPromise result:",
  toPromiseResult._tag,
  toPromiseResult.safeUnwrap()?.items?.length,
)
