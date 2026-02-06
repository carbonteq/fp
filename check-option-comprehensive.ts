import { Option } from "./dist/option.mjs"

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
// REPOSITORY/WORKFLOW METHODS - Return Options for composition
// ============================================================================

// SYNC: Find user by ID (returns Option)
function findUserById(id: UserId): Option<UserEntity> {
  if (id === "user-123") {
    return Option.Some(mockUser)
  }
  return Option.None
}

// SYNC: Find active list (returns Option)
function findActiveList(list: GroceryListEntity): Option<GroceryListEntity> {
  if (list.active) {
    return Option.Some(list)
  }
  return Option.None
}

// SYNC: Find non-empty items (returns Option)
function findNonEmptyItems(items: ItemEntity[]): Option<ItemEntity[]> {
  if (items.length === 0) {
    return Option.None
  }
  return Option.Some(items)
}

// SYNC: Find first pending item (returns Option)
function findFirstPendingItem(items: ItemEntity[]): Option<ItemEntity> {
  const pending = items.find((item) => !item.isBought)
  return Option.fromNullable(pending)
}

// ASYNC: Find user by ID from "database" (returns Promise<Option>)
async function findUserByIdAsync(id: UserId): Promise<Option<UserEntity>> {
  await new Promise((resolve) => setTimeout(resolve, 10))
  return findUserById(id)
}

// ASYNC: Find items for a list (returns Promise<Option>)
async function findItemsForListAsync(
  listId: GroceryListId,
): Promise<Option<ItemEntity[]>> {
  await new Promise((resolve) => setTimeout(resolve, 10))
  if (listId === "list-456") {
    return Option.Some(mockItems)
  }
  return Option.None
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

// ============================================================================
// IMPLEMENTATION STYLES
// ============================================================================

// Style 1: flatMap chain
function processListDetailsUsingFlatMap(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Option<GroceryListDetails> {
  return findActiveList(list)
    .flatMap((_) => Option.Some(owner))
    .flatMap((_owner) => Option.Some(items))
    .map((items) => {
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
}

const result1_ok = processListDetailsUsingFlatMap(
  mockGroceryList,
  mockUser,
  mockItems,
)
const inactiveList = new GroceryListEntity(
  "list-inactive",
  "Inactive",
  "Not active",
  false,
  "user-123",
)
const result1_none = processListDetailsUsingFlatMap(
  inactiveList,
  mockUser,
  mockItems,
)

console.log(
  "---------------------- Using normal composition (flatMap chain) ---------------",
)
console.log(result1_ok._tag, result1_ok.safeUnwrap())
console.log(result1_none._tag, result1_none.safeUnwrap())

// Style 2: Option.gen (simplified)
function processListDetailsUsingGen(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Option<GroceryListDetails> {
  return Option.gen(function* () {
    const _activeList = yield* findActiveList(list)

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
}

const result2_ok = processListDetailsUsingGen(
  mockGroceryList,
  mockUser,
  mockItems,
)
const result2_none = processListDetailsUsingGen(
  inactiveList,
  mockUser,
  mockItems,
)

console.log("\n---------------------- Using Option.gen ---------------")
console.log(result2_ok._tag, result2_ok.safeUnwrap())
console.log(result2_none._tag, result2_none.safeUnwrap())

// Style 3: Option.genAdapter
function processListDetailsUsingGenAdapter(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Option<GroceryListDetails> {
  return Option.genAdapter(function* ($) {
    const _activeList = yield* $(findActiveList(list))

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
}

const result3_ok = processListDetailsUsingGenAdapter(
  mockGroceryList,
  mockUser,
  mockItems,
)
const result3_none = processListDetailsUsingGenAdapter(
  inactiveList,
  mockUser,
  mockItems,
)

console.log("\n---------------------- Using Option.genAdapter ---------------")
console.log(result3_ok._tag, result3_ok.safeUnwrap())
console.log(result3_none._tag, result3_none.safeUnwrap())

// Style 4: Option.asyncGen
async function processListDetailsAsync(
  listId: GroceryListId,
  userId: UserId,
): Promise<Option<GroceryListDetails>> {
  return Option.asyncGen(async function* () {
    const owner = yield* await findUserByIdAsync(userId)

    const list = yield* await findItemsForListAsync(listId)
    const activeList = yield* findActiveList(mockGroceryList)

    const itemsSerialized = yield* Option.Some(list).map(serializeItemsAsync)
    const stats = yield* Option.Some(list).map(calculateDetailedStatsAsync)

    const listEncoded = activeList.serialize()
    const ownerEncoded = owner.serialize()

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsSerialized,
      stats,
    }
  })
}

console.log("\n---------------------- Option.asyncGen ---------------")
const asyncResult = await processListDetailsAsync("list-456", "user-123")
console.log(asyncResult._tag, asyncResult.safeUnwrap()?.owner?.name)

const asyncResultNone = await processListDetailsAsync(
  "unknown-list",
  "unknown-user",
)
console.log(asyncResultNone._tag, asyncResultNone.safeUnwrap())

// Style 5: Option.asyncGenAdapter
async function processListDetailsAsyncAdapter(
  listId: GroceryListId,
  userId: UserId,
): Promise<Option<GroceryListDetails>> {
  return Option.asyncGenAdapter(async function* ($) {
    const owner = yield* $(await findUserByIdAsync(userId))
    const items = yield* $(await findItemsForListAsync(listId))
    const _activeList = yield* $(findActiveList(mockGroceryList))

    const itemsSerialized = yield* $(
      Option.Some(items).map(serializeItemsAsync),
    )
    const stats = yield* $(Option.Some(items).map(calculateDetailedStatsAsync))

    const listEncoded = mockGroceryList.serialize()
    const ownerEncoded = owner.serialize()

    return {
      ...listEncoded,
      owner: ownerEncoded,
      items: itemsSerialized,
      stats,
    }
  })
}

console.log("\n---------------------- Option.asyncGenAdapter ---------------")
const adapterResult = await processListDetailsAsyncAdapter(
  "list-456",
  "user-123",
)
console.log(adapterResult._tag, adapterResult.safeUnwrap()?.stats)

// ============================================================================
// ADDITIONAL COMPOSITION EXAMPLES
// ============================================================================

// Example 1: Multiple validation steps
function processListWithValidations(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): Option<GroceryListDetails> {
  return Option.gen(function* () {
    yield* findActiveList(list)
    yield* findNonEmptyItems(items)

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
}

console.log(
  "\n---------------------- Multi-step validation (sync) ---------------",
)
const validResult = processListWithValidations(
  mockGroceryList,
  mockUser,
  mockItems,
)
console.log("Valid:", validResult._tag, validResult.safeUnwrap()?.owner?.name)

const emptyItems: ItemEntity[] = []
const invalidResult = processListWithValidations(
  mockGroceryList,
  mockUser,
  emptyItems,
)
console.log("Invalid (empty items):", invalidResult._tag)

// Example 2: Finding and transforming user
function findAndSerializeUser(userId: UserId): Option<SerializedUser> {
  return findUserById(userId).map((user) => user.serialize())
}

console.log("\n---------------------- Find and serialize user ---------------")
const foundUser = findAndSerializeUser("user-123")
console.log("Found:", foundUser._tag, foundUser.safeUnwrap()?.name)

const notFoundUser = findAndSerializeUser("unknown")
console.log("Not found:", notFoundUser._tag)

// Example 3: Chaining with flatMap to find pending item
function getFirstPendingItemDetails(
  list: GroceryListEntity,
  items: ItemEntity[],
): Option<{ item: SerializedItem; listName: string }> {
  return findFirstPendingItem(items).flatMap((item) =>
    findActiveList(list).map(() => ({
      item: item.serialize(),
      listName: list.name,
    })),
  )
}

console.log("\n---------------------- Chaining flatMap ---------------")
const pendingItem = getFirstPendingItemDetails(mockGroceryList, mockItems)
console.log("Pending item:", pendingItem._tag, pendingItem.safeUnwrap())

const allBoughtItems = [
  new ItemEntity("item-1", "Milk", 2, true),
  new ItemEntity("item-2", "Eggs", 12, true),
]
const noPendingItem = getFirstPendingItemDetails(
  mockGroceryList,
  allBoughtItems,
)
console.log("No pending item:", noPendingItem._tag)

// Example 4: Using zip to preserve original value
function getListWithContext(
  list: GroceryListEntity,
  items: ItemEntity[],
): Option<{ list: GroceryListEntity; itemCount: number }> {
  return findActiveList(list).flatZip((list) =>
    findNonEmptyItems(items).map((items) => ({
      list,
      itemCount: items.length,
    })),
  )
}

console.log(
  "\n---------------------- flatZip for context preservation ---------------",
)
const contextResult = getListWithContext(mockGroceryList, mockItems)
console.log("Context result:", contextResult._tag, contextResult.safeUnwrap())

const contextResultNone = getListWithContext(inactiveList, mockItems)
console.log("Context result (inactive):", contextResultNone._tag)

// Example 5: Using all() to combine multiple Options
function getListOwnerAndItems(
  userId: UserId,
  listId: GroceryListId,
  items: ItemEntity[],
): Option<{ user: UserEntity; hasList: boolean; itemCount: number }> {
  return Option.all(
    findUserById(userId),
    Option.Some(listId === "list-456"),
    findNonEmptyItems(items),
  ).map(([user, hasList, items]) => ({
    user,
    hasList,
    itemCount: items.length,
  }))
}

console.log("\n---------------------- Option.all() ---------------")
const allResult = getListOwnerAndItems("user-123", "list-456", mockItems)
console.log("All result:", allResult._tag, allResult.safeUnwrap())

const allResultNone = getListOwnerAndItems("unknown", "list-456", mockItems)
console.log("All result (unknown user):", allResultNone._tag)

// Example 6: Using any() to get first Some
function findAnyUser(...ids: UserId[]): Option<UserEntity> {
  return Option.any(...ids.map((id) => findUserById(id)))
}

console.log("\n---------------------- Option.any() ---------------")
const anyResult = findAnyUser("unknown", "user-123", "another-unknown")
console.log("Any result:", anyResult._tag, anyResult.safeUnwrap()?.name)

const anyResultNone = findAnyUser("unknown", "another-unknown")
console.log("Any result (none found):", anyResultNone._tag)

// Example 7: Using mapOr to provide default value
function getListNameOrElse(
  list: GroceryListEntity,
  defaultName: string,
): string {
  return findActiveList(list).mapOr(defaultName, (list) => list.name)
}

console.log(
  "\n---------------------- mapOr() for default value ---------------",
)
const mapOrResult = getListNameOrElse(mockGroceryList, "Default List")
console.log("mapOr (active):", mapOrResult)

const mapOrResultNone = getListNameOrElse(inactiveList, "Default List")
console.log("mapOr (inactive):", mapOrResultNone)

// Example 8: Using match for pattern matching
function describeUser(userId: UserId): string {
  return findUserById(userId).match({
    Some: (user) => `Found user: ${user.name} (${user.email})`,
    None: () => "User not found",
  })
}

console.log("\n---------------------- match() pattern matching ---------------")
const matchResult1 = describeUser("user-123")
console.log(matchResult1)

const matchResult2 = describeUser("unknown")
console.log(matchResult2)

// Example 9: Using filter with predicate
function getLargeQuantityItems(
  items: ItemEntity[],
  minQuantity: number,
): Option<ItemEntity[]> {
  return findNonEmptyItems(items).filter((items) =>
    items.some((item) => item.quantity >= minQuantity),
  )
}

console.log("\n---------------------- filter() with predicate ---------------")
const filteredItems = getLargeQuantityItems(mockItems, 10)
console.log("Has large quantity items:", filteredItems._tag)

const smallItems = [
  new ItemEntity("item-1", "Milk", 2, true),
  new ItemEntity("item-2", "Eggs", 5, false),
]
const filteredItemsNone = getLargeQuantityItems(smallItems, 10)
console.log("No large quantity items:", filteredItemsNone._tag)

// Example 10: Async workflow with Option<Promise<T>>
async function processListWithAsyncMappers(
  list: GroceryListEntity,
  items: ItemEntity[],
): Promise<Option<GroceryListDetails>> {
  return Option.asyncGen(async function* () {
    const _activeList = yield* findActiveList(list)

    const owner = Option.Some(mockUser)
    const itemsSerialized = yield* Option.Some(items).map(serializeItemsAsync)
    const stats = yield* Option.Some(items).map(calculateDetailedStatsAsync)

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      active: list.active,
      owner: owner.unwrap()?.serialize(),
      items: itemsSerialized,
      stats,
    }
  })
}

console.log("\n---------------------- Async workflow ---------------")
const asyncWorkflowResult = await processListWithAsyncMappers(
  mockGroceryList,
  mockItems,
)
console.log(
  "Async workflow:",
  asyncWorkflowResult._tag,
  asyncWorkflowResult.safeUnwrap()?.stats,
)

// Example 11: Using fromNullable for safe property access
function getUserEmail(user: UserEntity | null): Option<string> {
  return Option.fromNullable(user?.email)
}

console.log(
  "\n---------------------- fromNullable() for safe access ---------------",
)
const emailResult1 = getUserEmail(mockUser)
console.log("Email from user:", emailResult1._tag, emailResult1.safeUnwrap())

const emailResult2 = getUserEmail(null)
console.log("Email from null:", emailResult2._tag, emailResult2.safeUnwrap())

// Example 12: Using fromFalsy for truthy values
function getPositiveNumber(value: number | string | null): Option<number> {
  return Option.fromFalsy(Number(value)).filter((n) => n > 0)
}

console.log("\n---------------------- fromFalsy() with filter ---------------")
const falsyResult1 = getPositiveNumber(42)
console.log("Positive number:", falsyResult1._tag, falsyResult1.safeUnwrap())

const falsyResult2 = getPositiveNumber(0)
console.log("Zero (falsy):", falsyResult2._tag, falsyResult2.safeUnwrap())

const falsyResult3 = getPositiveNumber(null)
console.log("Null (falsy):", falsyResult3._tag, falsyResult3.safeUnwrap())

// Example 13: Using fromPredicate
function getAdultAge(age: number): Option<number> {
  return Option.fromPredicate(age, (n) => n >= 18)
}

console.log("\n---------------------- fromPredicate() ---------------")
const predicateResult1 = getAdultAge(25)
console.log("Adult (25):", predicateResult1._tag, predicateResult1.safeUnwrap())

const predicateResult2 = getAdultAge(15)
console.log("Minor (15):", predicateResult2._tag, predicateResult2.safeUnwrap())

// Example 14: Using tap for side effects
function findUserWithLogging(userId: UserId): Option<UserEntity> {
  return findUserById(userId).tap((user) => {
    console.log(`[LOG] Found user: ${user.name}`)
  })
}

console.log("\n---------------------- tap() for side effects ---------------")
const tappedUser = findUserWithLogging("user-123")
console.log("Tapped user:", tappedUser._tag)

const tappedUserNone = findUserWithLogging("unknown")
console.log("Tapped user (none):", tappedUserNone._tag)

// Example 15: Using innerMap for array operations
function getAllItemNames(items: ItemEntity[]): Option<string[]> {
  return findNonEmptyItems(items).innerMap((item) => item.name)
}

console.log("\n---------------------- innerMap() for arrays ---------------")
const innerMapResult = getAllItemNames(mockItems)
console.log("Item names:", innerMapResult._tag, innerMapResult.safeUnwrap())

const innerMapResultNone = getAllItemNames([])
console.log("Empty items:", innerMapResultNone._tag)

// Example 16: Converting to Result
function findUserAsResult(userId: UserId) {
  return findUserById(userId).toResult(`User not found: ${userId}`)
}

console.log("\n---------------------- toResult() conversion ---------------")
// Would need to import Result to fully demonstrate
const resultConversion1 = findUserAsResult("user-123")
console.log("toResult (found):", resultConversion1._tag)

const resultConversion2 = findUserAsResult("unknown")
console.log("toResult (not found):", resultConversion2._tag)
