/**
 * Simple Sync Workflow - Process Grocery List Details
 *
 * This example shows different styles of implementing the same workflow:
 * 1. flatMap chain style
 * 2. Result.gen style (simplified)
 * 3. Result.genAdapter style (with adapter for better type inference)
 */

import { Result } from "../../dist/result.mjs";
import {
  calculateDetailedStats,
  ensureListIsActive,
  fetchUserById,
  type GroceryListDetails,
  type GroceryListEntity,
  type ItemEntity,
  mockGroceryList,
  mockItems,
  mockUser,
  type UserEntity,
  validateItems,
} from "./shared-domain";

console.log("=== Simple Sync Workflow: Process Grocery List Details ===\n");

// ============================================================================
// STYLE 1: flatMap chain style
// ============================================================================

function processListDetailsUsingFlatMap(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): GroceryListDetails | never {
  const r = list
    .ensureIsOwner(owner)
    .map((_) => list.serialize())
    .zip((_) => owner.serialize())
    .map(([listEncoded, ownerEncoded]) => {
      const itemsEncoded = items.map((item) => item.serialize());
      return {
        owner: ownerEncoded,
        list: listEncoded,
        items: itemsEncoded,
      };
    })
    .map(({ list, owner, items: itemsSerialized }) => {
      const stats = calculateDetailedStats(items);
      return {
        ...list,
        items: itemsSerialized,
        owner,
        stats,
      };
    });

  return r.unwrap();
}

// Test flatMap style
console.log("1. flatMap chain style:");
const flatMapResult = processListDetailsUsingFlatMap(
  mockGroceryList,
  mockUser,
  mockItems,
);
console.log("   Owner:", flatMapResult.owner.name);
console.log("   Items:", flatMapResult.items.length);
console.log("   Stats:", flatMapResult.stats);

// ============================================================================
// STYLE 2: Result.gen style (simplified, no adapter)
// ============================================================================

function processListDetailsUsingGen(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): GroceryListDetails | never {
  const r = Result.gen(function* () {
    // Step 1: Ensure ownership
    yield* list.ensureIsOwner(owner);

    // Step 2: Serialize data
    const listEncoded = list.serialize();
    const ownerEncoded = owner.serialize();
    const itemsEncoded = items.map((item) => item.serialize());

    // Step 3: Calculate stats
    const stats = calculateDetailedStats(items);

    // Step 4: Return combined result
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

  return r.unwrap();
}

// Test gen style
console.log("\n2. Result.gen style:");
const genResult = processListDetailsUsingGen(
  mockGroceryList,
  mockUser,
  mockItems,
);
console.log("   Owner:", genResult.owner.name);
console.log("   Items:", genResult.items.length);
console.log("   Stats:", genResult.stats);

// ============================================================================
// STYLE 3: Result.genAdapter style (with adapter)
// ============================================================================

function processListDetailsUsingGenAdapter(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
): GroceryListDetails | never {
  const r = Result.genAdapter(function* ($) {
    // Step 1: Ensure ownership
    yield* $(list.ensureIsOwner(owner));

    // Step 2: Serialize data
    const listEncoded = list.serialize();
    const ownerEncoded = owner.serialize();
    const itemsEncoded = items.map((item) => item.serialize());

    // Step 3: Calculate stats
    const stats = calculateDetailedStats(items);

    // Step 4: Return combined result
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

  return r.unwrap();
}

// Test genAdapter style
console.log("\n3. Result.genAdapter style:");
const genAdapterResult = processListDetailsUsingGenAdapter(
  mockGroceryList,
  mockUser,
  mockItems,
);
console.log("   Owner:", genAdapterResult.owner.name);
console.log("   Items:", genAdapterResult.items.length);
console.log("   Stats:", genAdapterResult.stats);

// ============================================================================
// COMPARISON: Multi-step validation
// ============================================================================

console.log("\n=== Multi-step Validation Comparison ===\n");

// flatMap version
function processWithValidationsFlatMap(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
) {
  return list
    .ensureIsOwner(owner)
    .flatMap((_) => ensureListIsActive(list))
    .flatMap((_) => validateItems(items))
    .map((validItems) => {
      const stats = calculateDetailedStats(validItems);
      return {
        ...list.serialize(),
        owner: owner.serialize(),
        items: validItems.map((i) => i.serialize()),
        stats,
      };
    });
}

// gen version
function processWithValidationsGen(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
) {
  return Result.gen(function* () {
    yield* list.ensureIsOwner(owner);
    yield* ensureListIsActive(list);
    const validItems = yield* validateItems(items);

    const stats = calculateDetailedStats(validItems);
    return {
      ...list.serialize(),
      owner: owner.serialize(),
      items: validItems.map((i) => i.serialize()),
      stats,
    };
  });
}

// genAdapter version
function processWithValidationsGenAdapter(
  list: GroceryListEntity,
  owner: UserEntity,
  items: ItemEntity[],
) {
  return Result.genAdapter(function* ($) {
    yield* $(list.ensureIsOwner(owner));
    yield* $(ensureListIsActive(list));
    const validItems = yield* $(validateItems(items));

    const stats = calculateDetailedStats(validItems);
    return {
      ...list.serialize(),
      owner: owner.serialize(),
      items: validItems.map((i) => i.serialize()),
      stats,
    };
  });
}

console.log(
  "1. flatMap validation:",
  processWithValidationsFlatMap(mockGroceryList, mockUser, mockItems)._tag,
);
console.log(
  "2. gen validation:",
  processWithValidationsGen(mockGroceryList, mockUser, mockItems)._tag,
);
console.log(
  "3. genAdapter validation:",
  processWithValidationsGenAdapter(mockGroceryList, mockUser, mockItems)._tag,
);

// ============================================================================
// COMPARISON: Fetching and chaining
// ============================================================================

console.log("\n=== Fetching and Chaining Comparison ===\n");

// flatMap version
function fetchAndProcessFlatMap(userId: string) {
  return fetchUserById(userId)
    .flatMap((user) => mockGroceryList.ensureIsOwner(user))
    .map((_) => mockGroceryList.serialize());
}

// gen version
function fetchAndProcessGen(userId: string) {
  return Result.gen(function* () {
    const user = yield* fetchUserById(userId);
    yield* mockGroceryList.ensureIsOwner(user);
    return mockGroceryList.serialize();
  });
}

// genAdapter version
function fetchAndProcessGenAdapter(userId: string) {
  return Result.genAdapter(function* ($) {
    const user = yield* $(fetchUserById(userId));
    yield* $(mockGroceryList.ensureIsOwner(user));
    return mockGroceryList.serialize();
  });
}

console.log("1. flatMap fetch:", fetchAndProcessFlatMap("user-123")._tag);
console.log("2. gen fetch:", fetchAndProcessGen("user-123")._tag);
console.log("3. genAdapter fetch:", fetchAndProcessGenAdapter("user-123")._tag);

// ============================================================================
// READABILITY COMPARISON
// ============================================================================

console.log("\n=== Readability Comparison ===\n");

console.log("flatMap chain:");
console.log("  - Nested structure");
console.log("  - Harder to read with many steps");
console.log("  - Explicit threading of values");

console.log("\ngen:");
console.log("  - Linear, imperative style");
console.log("  - Easy to read");
console.log("  - Automatic value threading");

console.log("\ngenAdapter:");
console.log("  - Same readability as gen");
console.log("  - Better type inference for complex error types");
console.log("  - Adapter ($) makes yields explicit");

console.log("\n=== All sync workflow examples completed ===");
