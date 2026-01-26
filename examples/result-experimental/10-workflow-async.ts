/**
 * Async Workflow - Process Grocery List Details with Async Operations
 *
 * This example shows different styles of async workflows:
 * 1. Result.asyncGen (simplified, no adapter)
 * 2. Result.asyncGenAdapter (with adapter for better type inference)
 * 3. Using Result<Promise<T>, E> with auto-await
 * 4. Complex multi-step async validation
 */

import { ExperimentalResult as Result } from "../../dist/result-experimental.mjs";
import {
  calculateDetailedStats,
  calculateDetailedStatsAsync,
  ensureListIsActive,
  fetchItemsForListAsync,
  fetchListWithOwnerAsync,
  fetchUserByIdAsync,
  filterActiveItems,
  type GroceryListDetails,
  GroceryListEntity,
  type ItemEntity,
  mockGroceryList,
  mockItems,
  serializeItemsAsync,
  validateItems,
  validateUserPermissionsAsync,
} from "./shared-domain";

console.log("=== Async Workflow: Process Grocery List Details ===\n");

// ============================================================================
// STYLE 1: Result.asyncGen (simplified)
// ============================================================================

async function processListDetailsAsync(
  listId: string,
  userId: string,
): Promise<GroceryListDetails> {
  const result = await Result.asyncGen(async function* () {
    // Fetch list with owner
    const { list, owner } = yield* await fetchListWithOwnerAsync(
      listId,
      userId,
    );

    // Ensure ownership
    yield* list.ensureIsOwner(owner);

    // Validate list is active
    yield* ensureListIsActive(list);

    // Fetch items
    const items = yield* await fetchItemsForListAsync(listId);

    // Validate items
    const validItems = yield* validateItems(items);

    // Serialize
    const listEncoded = list.serialize();
    const ownerEncoded = owner.serialize();
    const itemsEncoded = validItems.map((item) => item.serialize());

    // Calculate stats
    const stats = calculateDetailedStats(validItems);

    return {
      id: listEncoded.id,
      name: listEncoded.name,
      description: listEncoded.description,
      active: listEncoded.active,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    };
  });

  return result.unwrap();
}

// Test asyncGen
console.log("1. Result.asyncGen:");
const asyncGenResult = await processListDetailsAsync("list-456", "user-123");
console.log("   Owner:", asyncGenResult.owner.name);
console.log("   Items:", asyncGenResult.items.length);
console.log("   Stats:", asyncGenResult.stats);

// ============================================================================
// STYLE 2: Result.asyncGenAdapter (with adapter)
// ============================================================================

async function processListDetailsAsyncAdapter(
  listId: string,
  userId: string,
): Promise<GroceryListDetails> {
  const result = await Result.asyncGenAdapter(async function* ($) {
    // Fetch list with owner
    const { list, owner } = yield* $(
      await fetchListWithOwnerAsync(listId, userId),
    );

    // Ensure ownership
    yield* $(list.ensureIsOwner(owner));

    // Async permission validation
    yield* $(await validateUserPermissionsAsync(owner, list));

    // Fetch items
    const items = yield* $(await fetchItemsForListAsync(listId));

    // Validate items
    const validItems = yield* $(validateItems(items));

    // Serialize
    const listEncoded = list.serialize();
    const ownerEncoded = owner.serialize();
    const itemsEncoded = validItems.map((item) => item.serialize());

    // Calculate stats
    const stats = calculateDetailedStats(validItems);

    return {
      id: listEncoded.id,
      name: listEncoded.name,
      description: listEncoded.description,
      active: listEncoded.active,
      owner: ownerEncoded,
      items: itemsEncoded,
      stats,
    };
  });

  return result.unwrap();
}

// Test asyncGenAdapter
console.log("\n2. Result.asyncGenAdapter:");
const asyncAdapterResult = await processListDetailsAsyncAdapter(
  "list-456",
  "user-123",
);
console.log("   Owner:", asyncAdapterResult.owner.name);
console.log("   Items:", asyncAdapterResult.items.length);
console.log("   Stats:", asyncAdapterResult.stats);

// ============================================================================
// STYLE 3: Using async operations directly (no map)
// ============================================================================

async function processListWithAsyncMappers(
  list: GroceryListEntity,
  items: ItemEntity[],
): Promise<GroceryListDetails> {
  const result = await Result.asyncGen(async function* () {
    const itemsValue = yield* Result.Ok(items);
    // Do async operations outside of map
    const itemsSerialized = await serializeItemsAsync(itemsValue);

    // Same for stats calculation
    const stats = await calculateDetailedStatsAsync(itemsValue);

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      active: list.active,
      owner: { id: "user-123", name: "Alice", email: "alice@example.com" },
      items: itemsSerialized,
      stats,
    };
  });

  return result.unwrap();
}

// Test auto-await
console.log("\n3. Direct async operations:");
const autoAwaitResult = await processListWithAsyncMappers(
  new GroceryListEntity(
    "list-456",
    "Weekly Shopping",
    "desc",
    true,
    "user-123",
  ),
  mockItems,
);
console.log("   Items:", autoAwaitResult.items.length);
console.log("   Stats:", autoAwaitResult.stats);

// ============================================================================
// STYLE 4: Complex multi-step async validation
// ============================================================================

async function processListWithFullValidationAsync(
  listId: string,
  userId: string,
) {
  return Result.asyncGenAdapter(async function* ($) {
    // Step 1: Fetch list and owner
    const { list, owner } = yield* $(
      await fetchListWithOwnerAsync(listId, userId),
    );

    // Step 2: Ensure ownership
    yield* $(list.ensureIsOwner(owner));

    // Step 3: Async permission validation
    yield* $(await validateUserPermissionsAsync(owner, list));

    // Step 4: Validate list is active
    yield* $(ensureListIsActive(list));

    // Step 5: Fetch items
    const items = yield* $(await fetchItemsForListAsync(listId));

    // Step 6: Validate items
    const validItems = yield* $(validateItems(items));

    // Step 7: Filter active items
    const activeItems = yield* $(filterActiveItems(validItems));

    // Step 8: Async serialization
    const itemsSerialized = await serializeItemsAsync(activeItems);

    // Step 9: Async stats calculation
    const stats = await calculateDetailedStatsAsync(activeItems);

    return {
      id: list.id,
      name: list.name,
      description: list.description,
      active: list.active,
      owner: owner.serialize(),
      items: itemsSerialized,
      stats,
      activeItemCount: activeItems.length,
    };
  });
}

console.log("\n4. Complex async validation:");
const complexResult = await processListWithFullValidationAsync(
  "list-456",
  "user-123",
);
console.log("   Result:", complexResult._tag);
if (complexResult.isOk()) {
  const details = complexResult.unwrap();
  console.log("   Owner:", details.owner.name);
  console.log("   Active items:", details.activeItemCount);
  console.log("   Stats:", details.stats);
}

// ============================================================================
// ERROR HANDLING COMPARISON
// ============================================================================

console.log("\n=== Error Handling Comparison ===\n");

// Test with invalid user
const invalidUserResult = await Result.asyncGen(async function* () {
  const { list, owner } = yield* await fetchListWithOwnerAsync(
    "list-456",
    "invalid",
  );
  yield* list.ensureIsOwner(owner);
  return "success";
});
console.log("1. Invalid user (asyncGen):", invalidUserResult.unwrapErr()._tag);

// Test with invalid items
const invalidItemsResult = await Result.asyncGenAdapter(async function* ($) {
  const { list, owner } = yield* $(
    await fetchListWithOwnerAsync("list-456", "user-123"),
  );
  yield* $(list.ensureIsOwner(owner));

  // Create empty items array for testing
  const emptyItems: ItemEntity[] = [];
  yield* $(validateItems(emptyItems));

  return "success";
});
console.log(
  "2. Invalid items (asyncGenAdapter):",
  invalidItemsResult.unwrapErr()._tag,
);

// ============================================================================
// PERFORMANCE: Parallel-like pattern (but sequential)
// ============================================================================

async function fetchAllDataSequential(userId: string) {
  const r = await Result.asyncGen(async function* () {
    // All fetches happen sequentially but cleanly
    const user = yield* await fetchUserByIdAsync(userId);
    const items = yield* await fetchItemsForListAsync("list-456");

    yield* await validateUserPermissionsAsync(user, mockGroceryList);

    return { user, items, hasPermission: true };
  });

  return r;
}

console.log("\n5. Sequential fetches:");
const sequentialResult = await fetchAllDataSequential("user-123");
console.log("   Result:", sequentialResult._tag);

// ===========================================================================
// USING DIRECT ASYNC OPERATIONS
// ============================================================================

async function processWithDirectAsync(items: ItemEntity[]) {
  return Result.asyncGen(async function* () {
    const itemsValue = yield* Result.Ok(items);
    // Do async operations directly
    const itemsSerialized = await serializeItemsAsync(itemsValue);
    const stats = await calculateDetailedStatsAsync(itemsValue);

    return { items: itemsSerialized, stats };
  });
}

console.log("\n6. Direct async operations:");
const toPromiseResult = await processWithDirectAsync(mockItems);

if (toPromiseResult.isErr()) {
  console.log("   Error:", toPromiseResult.unwrapErr());
} else {
  const data = toPromiseResult.unwrap();
  console.log("   Items:", data.items.length);
  console.log("   Stats:", data.stats);
}

// ============================================================================
// READABILITY COMPARISON
// ============================================================================

console.log("\n=== Readability Comparison ===\n");

console.log("asyncGen:");
console.log("  - yield* await Promise<Result<T,E>>");
console.log("  - Clean, linear async code");
console.log("  - Do async operations outside Result wrappers");

console.log("\nasyncGenAdapter:");
console.log("  - yield* $(await Promise<Result<T,E>>)");
console.log("  - Better type inference");
console.log("  - Explicit adapter makes yields clear");

console.log("\nBoth support:");
console.log("  - Mixed sync/async operations");
console.log("  - Automatic error short-circuiting");
console.log("  - Direct async functions (no map(async fn))");

console.log("\n=== All async workflow examples completed ===");
