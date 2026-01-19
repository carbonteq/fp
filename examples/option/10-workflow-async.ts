/**
 * Async Workflow - Checkout Summary with Async Operations
 *
 * This example shows different styles of async workflows:
 * 1. Option.asyncGen (simplified, no adapter)
 * 2. Option.asyncGenAdapter (with adapter for better type inference)
 * 3. Using Option<Promise<T>> with auto-await
 * 4. Complex multi-step async validation
 *
 * Workflow steps:
 * - Fetch user (async)
 * - Ensure user is active
 * - Fetch cart (async)
 * - Validate cart ownership
 * - Validate cart is not empty (async)
 * - Fetch products for cart items (async)
 * - Validate stock availability (async)
 * - Calculate checkout summary (async)
 */

import { Option } from "../../dist/option.mjs";
import {
  type CartEntity,
  type CheckoutSummary,
  calculateCheckoutSummaryAsync,
  findCartByIdAsync,
  findUserByIdAsync,
  type ProductEntity,
  validateCartNotEmptyAsync,
  validateStockAvailabilityAsync,
} from "./shared-domain";

// Helper to get products for cart (not in shared-domain, defined here for async example)
async function getProductsForCartAsync(
  cart: CartEntity,
): Promise<Option<ProductEntity[]>> {
  await new Promise((resolve) => setTimeout(resolve, 15));

  const { findProductById } = await import("./shared-domain.js");

  const products: ProductEntity[] = [];

  for (const item of cart.items) {
    const product = findProductById(item.productId);
    if (product.isNone()) {
      return Option.None;
    }
    products.push(product.unwrap());
  }

  return products.length > 0 ? Option.Some(products) : Option.None;
}

console.log("=== Async Workflow: Checkout Summary ===\n");

// ============================================================================
// STYLE 1: Option.asyncGen (simplified)
// ============================================================================

async function processCheckoutAsync(
  userId: string,
  cartId: string,
): Promise<Option<CheckoutSummary>> {
  return await Option.asyncGen(async function* () {
    // Step 1: Fetch and validate user
    const user = yield* await findUserByIdAsync(userId);
    yield* user.ensureActive();

    // Step 2: Fetch and validate cart
    const cart = yield* await findCartByIdAsync(cartId);
    yield* cart.ensureOwner(user);

    // Step 3: Validate cart has items
    yield* await validateCartNotEmptyAsync(cart);

    // Step 4: Fetch products for cart items
    const products = yield* await getProductsForCartAsync(cart);

    // Step 5: Validate stock availability
    yield* await validateStockAvailabilityAsync(products, cart.items);

    // Step 6: Calculate and return summary
    return await calculateCheckoutSummaryAsync(user, cart, products);
  });
}

// Test asyncGen
console.log("1. Option.asyncGen:");
const asyncGenResult = await processCheckoutAsync("user-123", "cart-456");
if (asyncGenResult.isSome()) {
  const summary = asyncGenResult.unwrap();
  console.log("   User:", summary.user.name);
  console.log("   Items:", summary.itemCount);
  console.log("   Total:", summary.total);
} else {
  console.log("   No checkout summary available");
}

// ============================================================================
// STYLE 2: Option.asyncGenAdapter (with adapter)
// ============================================================================

async function processCheckoutAsyncAdapter(
  userId: string,
  cartId: string,
): Promise<Option<CheckoutSummary>> {
  const opt = await Option.asyncGenAdapter(async function* ($) {
    // Step 1: Fetch and validate user
    const user = yield* $(await findUserByIdAsync(userId));
    yield* $(user.ensureActive());

    // Step 2: Fetch and validate cart
    const cart = yield* $(await findCartByIdAsync(cartId));
    yield* $(cart.ensureOwner(user));

    // Step 3: Validate cart has items
    yield* $(await validateCartNotEmptyAsync(cart));

    // Step 4: Fetch products for cart items
    const products = yield* $(await getProductsForCartAsync(cart));

    // Step 5: Validate stock availability
    yield* $(await validateStockAvailabilityAsync(products, cart.items));

    // Step 6: Calculate and return summary
    return await calculateCheckoutSummaryAsync(user, cart, products);
  });

  return opt;
}

// Test asyncGenAdapter
console.log("\n2. Option.asyncGenAdapter:");
const asyncAdapterResult = await processCheckoutAsyncAdapter(
  "user-123",
  "cart-456",
);
if (asyncAdapterResult.isSome()) {
  const summary = asyncAdapterResult.unwrap();
  console.log("   User:", summary.user.name);
  console.log("   Items:", summary.itemCount);
  console.log("   Total:", summary.total);
} else {
  console.log("   No checkout summary available");
}

// ============================================================================
// STYLE 3: Using Option<Promise<T>> with auto-await
// ============================================================================

async function processWithAsyncMappers(
  userId: string,
  cartId: string,
): Promise<Option<CheckoutSummary>> {
  return await Option.asyncGen(async function* () {
    // Option.map with async function returns Option<Promise<T>>
    const userOption = await findUserByIdAsync(userId);
    const user = yield* userOption; // Auto-awaits inner promise

    yield* user.ensureActive();

    const cartOption = await findCartByIdAsync(cartId);
    const cart = yield* cartOption;

    yield* cart.ensureOwner(user);

    const products = yield* await getProductsForCartAsync(cart);
    yield* await validateStockAvailabilityAsync(products, cart.items);

    return await calculateCheckoutSummaryAsync(user, cart, products);
  });
}

// Test auto-await
console.log("\n3. Auto-await inner promises:");
const autoAwaitResult = await processWithAsyncMappers("user-123", "cart-456");
if (autoAwaitResult.isSome()) {
  const summary = autoAwaitResult.unwrap();
  console.log("   Items:", summary.itemCount);
  console.log("   Total:", summary.total);
}

// ============================================================================
// STYLE 4: Complex multi-step async validation
// ============================================================================

async function processWithFullValidationAsync(userId: string, cartId: string) {
  return await Option.asyncGenAdapter(async function* ($) {
    // Step 1: Fetch user
    const user = yield* $(await findUserByIdAsync(userId));

    // Step 2: Ensure user is active
    yield* $(user.ensureActive());

    // Step 3: Fetch cart
    const cart = yield* $(await findCartByIdAsync(cartId));

    // Step 4: Validate ownership
    yield* $(cart.ensureOwner(user));

    // Step 5: Validate cart not empty
    yield* $(await validateCartNotEmptyAsync(cart));

    // Step 6: Fetch products
    const products = yield* $(await getProductsForCartAsync(cart));

    // Step 7: Validate stock availability
    yield* $(await validateStockAvailabilityAsync(products, cart.items));

    // Step 8: Calculate summary
    const summary = await calculateCheckoutSummaryAsync(user, cart, products);

    return {
      ...summary,
      validatedAt: new Date().toISOString(),
    };
  });
}

console.log("\n4. Complex async validation:");
const complexResult = await processWithFullValidationAsync(
  "user-123",
  "cart-456",
);
if (complexResult.isSome()) {
  const summary = complexResult.unwrap();
  console.log("   Result:", summary.user.name);
  console.log("   Items:", summary.itemCount);
  console.log("   Total:", summary.total);
}

// ============================================================================
// ERROR HANDLING COMPARISON
// ============================================================================

console.log("\n=== Error Handling Comparison ===\n");

// Test with invalid user
const invalidUserResult = await Option.asyncGen(async function* () {
  const user = yield* await findUserByIdAsync("invalid");
  yield* user.ensureActive();
  return "success";
});
console.log("1. Invalid user (asyncGen):", invalidUserResult._tag); // "None"

// Test with empty cart
const emptyCartResult = await Option.asyncGenAdapter(async function* ($) {
  const user = yield* $(await findUserByIdAsync("user-123"));
  yield* $(user.ensureActive());

  const cart = yield* $(await findCartByIdAsync("cart-789"));
  yield* $(cart.ensureOwner(user));

  yield* $(await validateCartNotEmptyAsync(cart));

  return "success";
});
console.log("2. Empty cart (asyncGenAdapter):", emptyCartResult._tag); // "None"

// ============================================================================
// PERFORMANCE: Sequential async operations
// ============================================================================

async function fetchAllDataSequential(userId: string, cartId: string) {
  return await Option.asyncGen(async function* () {
    // All fetches happen sequentially but cleanly
    const user = yield* await findUserByIdAsync(userId);
    const cart = yield* await findCartByIdAsync(cartId);

    yield* cart.ensureOwner(user);

    return { user, cart, hasPermission: true };
  });
}

console.log("\n3. Sequential fetches:");
const sequentialResult = await fetchAllDataSequential("user-123", "cart-456");
console.log("   Result:", sequentialResult._tag);

// ============================================================================
// USING TOPROMISE FOR CONVERSION
// ============================================================================

async function processWithToPromise(userId: string, cartId: string) {
  return await Option.asyncGen(async function* () {
    const user = yield* await findUserByIdAsync(userId);
    yield* user.ensureActive();

    const cart = yield* await findCartByIdAsync(cartId);
    yield* cart.ensureOwner(user);

    const products = yield* await getProductsForCartAsync(cart);

    return await calculateCheckoutSummaryAsync(user, cart, products);
  });
}

console.log("\n4. Using toPromise:");
const toPromiseResult = await processWithToPromise("user-123", "cart-456");

if (toPromiseResult.isNone()) {
  console.log("   No checkout summary");
} else {
  const summary = toPromiseResult.unwrap();
  console.log("   Items:", summary.itemCount);
  console.log("   Total:", summary.total);
}

// ============================================================================
// MIXED SYNC AND ASYNC OPERATIONS
// ============================================================================

async function processMixedOperations(userId: string, cartId: string) {
  return await Option.asyncGenAdapter(async function* ($) {
    // Async: fetch user
    const user = yield* $(await findUserByIdAsync(userId));

    // Sync: validate active
    yield* $(user.ensureActive());

    // Async: fetch cart
    const cart = yield* $(await findCartByIdAsync(cartId));

    // Sync: validate ownership
    yield* $(cart.ensureOwner(user));

    // Async: validate cart not empty
    yield* $(await validateCartNotEmptyAsync(cart));

    // Sync: get item count
    const itemCount = cart.items.length;

    // Async: fetch products
    const products = yield* $(await getProductsForCartAsync(cart));

    // Return mixed sync/async data
    return {
      itemCount, // sync
      products, // from async
      total: cart.getTotal(), // sync
    };
  });
}

console.log("\n5. Mixed sync/async operations:");
const mixedResult = await processMixedOperations("user-123", "cart-456");
if (mixedResult.isSome()) {
  const data = mixedResult.unwrap();
  console.log("   Items:", data.itemCount);
  console.log("   Products:", data.products.length);
  console.log("   Total:", data.total);
}

// ============================================================================
// READABILITY COMPARISON
// ============================================================================

console.log("\n=== Readability Comparison ===\n");

console.log("asyncGen:");
console.log("  - yield* await Promise<Option<T>>");
console.log("  - Auto-awaits Option<Promise<T>>");
console.log("  - Clean, linear async code");
console.log("  - Implicit adapter handling");

console.log("\nasyncGenAdapter:");
console.log("  - yield* $(await Promise<Option<T>>)");
console.log("  - Explicit adapter function ($)");
console.log("  - Better type inference");
console.log("  - Clearer Option operation boundaries");

console.log("\nBoth support:");
console.log("  - Mixed sync/async operations");
console.log("  - Automatic None short-circuiting");
console.log("  - Async mappers via Option<Promise<T>>");
console.log("  - toPromise conversion");

console.log("\n=== All async workflow examples completed ===");
