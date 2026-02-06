/**
 * Simple Sync Workflow - Checkout Summary
 *
 * This example shows different styles of implementing the same workflow:
 * 1. flatMap chain style
 * 2. Option.gen style (simplified)
 * 3. Option.genAdapter style (with adapter for better type inference)
 *
 * Workflow steps:
 * - Fetch user
 * - Ensure user is active
 * - Fetch cart
 * - Validate cart ownership
 * - Validate cart is not empty
 * - Fetch products for cart items
 * - Validate stock availability
 * - Calculate checkout summary
 */

import { ExperimentalOption as Option } from "../../dist/option-experimental.mjs"
import {
  type CheckoutSummary,
  calculateCheckoutSummary,
  findCartById,
  findProductById,
  findUserById,
  getProductsForCart,
  validateCartNotEmpty,
  validateStockAvailability,
} from "./shared-domain"

console.log("=== Simple Sync Workflow: Checkout Summary ===\n")

// ============================================================================
// STYLE 1: flatMap chain style
// ============================================================================

function processCheckoutUsingFlatMap(
  userId: string,
  cartId: string,
): Option<CheckoutSummary> {
  return findUserById(userId)
    .flatMap((user) => user.ensureActive())
    .flatMap((_user) => findCartById(cartId))
    .flatMap((cart) =>
      findUserById(userId).flatMap((user) => cart.ensureOwner(user)),
    )
    .flatMap((cart) => validateCartNotEmpty(cart))
    .flatMap((cart) => getProductsForCart(cart))
    .flatMap((products) =>
      findCartById(cartId).flatMap((cart) =>
        validateStockAvailability(products, cart.items),
      ),
    )
    .flatMap((products) =>
      findCartById(cartId).flatMap((cart) =>
        findUserById(userId).map((user) =>
          calculateCheckoutSummary(user, cart, products),
        ),
      ),
    )
}

// Test flatMap style
console.log("1. flatMap chain style:")
const flatMapResult = processCheckoutUsingFlatMap("user-123", "cart-456")
if (flatMapResult.isSome()) {
  const summary = flatMapResult.unwrap()
  console.log("   User:", summary.user.name)
  console.log("   Items:", summary.itemCount)
  console.log("   Total:", summary.total)
} else {
  console.log("   No checkout summary available")
}

// ============================================================================
// STYLE 2: Option.gen style (simplified, no adapter)
// ============================================================================

function processCheckoutUsingGen(
  userId: string,
  cartId: string,
): Option<CheckoutSummary> {
  return Option.gen(function* () {
    // Step 1: Fetch and validate user
    const user = yield* findUserById(userId)
    yield* user.ensureActive()

    // Step 2: Fetch and validate cart
    const cart = yield* findCartById(cartId)
    yield* cart.ensureOwner(user)

    // Step 3: Validate cart has items
    yield* validateCartNotEmpty(cart)

    // Step 4: Fetch products for cart items
    const products = yield* getProductsForCart(cart)

    // Step 5: Validate stock availability
    yield* validateStockAvailability(products, cart.items)

    // Step 6: Calculate and return summary
    return calculateCheckoutSummary(user, cart, products)
  })
}

// Test gen style
console.log("\n2. Option.gen style:")
const genResult = processCheckoutUsingGen("user-123", "cart-456")
if (genResult.isSome()) {
  const summary = genResult.unwrap()
  console.log("   User:", summary.user.name)
  console.log("   Items:", summary.itemCount)
  console.log("   Total:", summary.total)
} else {
  console.log("   No checkout summary available")
}

// ============================================================================
// STYLE 3: Option.genAdapter style (with adapter)
// ============================================================================

function processCheckoutUsingGenAdapter(
  userId: string,
  cartId: string,
): Option<CheckoutSummary> {
  return Option.genAdapter(function* ($) {
    // Step 1: Fetch and validate user
    const user = yield* $(findUserById(userId))
    yield* $(user.ensureActive())

    // Step 2: Fetch and validate cart
    const cart = yield* $(findCartById(cartId))
    yield* $(cart.ensureOwner(user))

    // Step 3: Validate cart has items
    yield* $(validateCartNotEmpty(cart))

    // Step 4: Fetch products for cart items
    const products = yield* $(getProductsForCart(cart))

    // Step 5: Validate stock availability
    yield* $(validateStockAvailability(products, cart.items))

    // Step 6: Calculate and return summary
    return calculateCheckoutSummary(user, cart, products)
  })
}

// Test genAdapter style
console.log("\n3. Option.genAdapter style:")
const genAdapterResult = processCheckoutUsingGenAdapter("user-123", "cart-456")
if (genAdapterResult.isSome()) {
  const summary = genAdapterResult.unwrap()
  console.log("   User:", summary.user.name)
  console.log("   Items:", summary.itemCount)
  console.log("   Total:", summary.total)
} else {
  console.log("   No checkout summary available")
}

// ============================================================================
// COMPARISON: Multi-step validation
// ============================================================================

console.log("\n=== Multi-step Validation Comparison ===\n")

// flatMap version
function validateWithFlatMap(userId: string, cartId: string) {
  return findUserById(userId)
    .flatMap((user) => user.ensureActive())
    .flatZip((_user) => findCartById(cartId))
    .flatMap(([user, cart]) => cart.ensureOwner(user))
    .flatMap((cart) => validateCartNotEmpty(cart))
}

// gen version
function validateWithGen(userId: string, cartId: string) {
  return Option.gen(function* () {
    const user = yield* findUserById(userId)
    yield* user.ensureActive()

    const cart = yield* findCartById(cartId)
    yield* cart.ensureOwner(user)

    yield* validateCartNotEmpty(cart)

    return { user, cart }
  })
}

// genAdapter version
function validateWithGenAdapter(userId: string, cartId: string) {
  return Option.genAdapter(function* ($) {
    const user = yield* $(findUserById(userId))
    yield* $(user.ensureActive())

    const cart = yield* $(findCartById(cartId))
    yield* $(cart.ensureOwner(user))

    yield* $(validateCartNotEmpty(cart))

    return { user, cart }
  })
}

console.log(
  "1. flatMap validation:",
  validateWithFlatMap("user-123", "cart-456")._tag,
)
console.log("2. gen validation:", validateWithGen("user-123", "cart-456")._tag)
console.log(
  "3. genAdapter validation:",
  validateWithGenAdapter("user-123", "cart-456")._tag,
)

// ============================================================================
// COMPARISON: Failure scenarios
// ============================================================================

console.log("\n=== Failure Scenarios ===\n")

// Inactive user
console.log("1. Inactive user:")
console.log(
  "   flatMap:",
  processCheckoutUsingFlatMap("user-999", "cart-456")._tag,
) // "None"
console.log("   gen:", processCheckoutUsingGen("user-999", "cart-456")._tag) // "None"
console.log(
  "   genAdapter:",
  processCheckoutUsingGenAdapter("user-999", "cart-456")._tag,
) // "None"

// Empty cart
console.log("\n2. Empty cart:")
console.log(
  "   flatMap:",
  processCheckoutUsingFlatMap("user-123", "cart-789")._tag,
) // "None"
console.log("   gen:", processCheckoutUsingGen("user-123", "cart-789")._tag) // "None"
console.log(
  "   genAdapter:",
  processCheckoutUsingGenAdapter("user-123", "cart-789")._tag,
) // "None"

// Non-existent cart
console.log("\n3. Non-existent cart:")
console.log(
  "   flatMap:",
  processCheckoutUsingFlatMap("user-123", "cart-invalid")._tag,
) // "None"
console.log("   gen:", processCheckoutUsingGen("user-123", "cart-invalid")._tag) // "None"
console.log(
  "   genAdapter:",
  processCheckoutUsingGenAdapter("user-123", "cart-invalid")._tag,
) // "None"

// ============================================================================
// COMPARISON: Individual product lookup with validation
// ============================================================================

console.log("\n=== Product Lookup with Validation ===\n")

const findAndValidateProduct = (productId: string, quantity: number) => {
  return findProductById(productId)
    .flatMap((product) => product.ensureInStock())
    .flatMap((product) => product.ensureQuantityAvailable(quantity))
}

console.log(
  "1. Valid product (prod-1, qty 1):",
  findAndValidateProduct("prod-1", 1)._tag,
) // "Some"
console.log(
  "2. Out of stock (prod-3, qty 1):",
  findAndValidateProduct("prod-3", 1)._tag,
) // "None"
console.log(
  "3. Insufficient stock (prod-1, qty 100):",
  findAndValidateProduct("prod-1", 100)._tag,
) // "None"

// Using gen for the same
const findAndValidateProductGen = (productId: string, quantity: number) => {
  return Option.gen(function* () {
    const product = yield* findProductById(productId)
    yield* product.ensureInStock()
    yield* product.ensureQuantityAvailable(quantity)
    return product
  })
}

console.log(
  "\n4. Using gen (prod-1, qty 1):",
  findAndValidateProductGen("prod-1", 1)._tag,
) // "Some"

// ============================================================================
// READABILITY COMPARISON
// ============================================================================

console.log("\n=== Readability Comparison ===\n")

console.log("flatMap chain:")
console.log("  - Nested structure with callbacks")
console.log("  - Harder to read with many steps")
console.log("  - Need to pass values through explicitly")

console.log("\ngen:")
console.log("  - Linear, imperative style")
console.log("  - Easy to read and follow")
console.log("  - Automatic value threading")
console.log("  - Clear step-by-step flow")

console.log("\ngenAdapter:")
console.log("  - Same readability as gen")
console.log("  - Adapter ($) makes Option operations explicit")
console.log("  - Better type inference for complex cases")

console.log("\n=== All sync workflow examples completed ===")
