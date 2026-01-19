/**
 * Option Examples Index
 *
 * This file lists all available examples and demonstrates different
 * patterns for working with Option types.
 *
 * Run examples with:
 *   bun run examples/option/01-map.ts
 *   bun run examples/option/02-flatMap.ts
 *   etc.
 */

// ============================================================================
// BASIC OPERATIONS (files 01-04)
// ============================================================================

/**
 * 01-map.ts - Transform the Some value
 *
 * Topics covered:
 * - Basic map usage
 * - Map on None (mapper not called)
 * - Chaining multiple maps
 * - Map with object transformation
 * - Map with async functions (returns Option<Promise<T>>)
 * - Map with array operations
 * - Type transformations
 * - mapOr for default values
 * - Async mapOr
 *
 * Run: bun run examples/option/01-map.ts
 */

/**
 * 02-flatMap.ts - Chain Option-returning functions
 *
 * Topics covered:
 * - Basic flatMap chains
 * - Short-circuit on None
 * - Chaining multiple flatMaps
 * - Dependent lookups (user → posts)
 * - Validation pipelines
 * - Async flatMap
 * - flatMap vs map comparison
 * - Practical user lookup chain
 * - Nested object access
 * - Safe array element access
 * - flatMap with Option.all
 * - JSON parsing and validation
 * - Configuration lookup
 *
 * Run: bun run examples/option/02-flatMap.ts
 */

/**
 * 03-zip.ts - Pair original with derived value
 *
 * Topics covered:
 * - Basic zip usage
 * - Zip on None
 * - Async zip
 * - Validation with context
 * - Multiple zips
 * - Audit trail patterns
 * - Before/after comparisons
 * - Transformation history
 * - Form field validation
 * - Accumulating calculations
 * - Async API call patterns
 * - Value with metadata
 * - Safe division with context
 *
 * Run: bun run examples/option/03-zip.ts
 */

/**
 * 04-flatZip.ts - Pair original with Option-returning function
 *
 * Topics covered:
 * - Basic flatZip usage
 * - Short-circuit on None
 * - Chaining flatZips
 * - Async flatZip
 * - User and posts pattern
 * - Dependent lookups
 * - Validation with context
 * - Complex object building
 * - flatZip vs flatMap comparison
 * - Audit log patterns
 * - Context preservation
 * - Multi-step validation
 * - Branching logic
 *
 * Run: bun run examples/option/04-flatZip.ts
 */

// ============================================================================
// GENERATOR-BASED SYNTAX (files 05-08)
// ============================================================================

/**
 * 05-gen.ts - Imperative-style sync Option composition
 *
 * Topics covered:
 * - Simple gen with single/multiple yields
 * - Short-circuit on None
 * - Function calls in gen
 * - Validation pipelines
 * - gen vs flatMap readability
 * - Complex object building
 * - Intermediate processing
 * - Array operations
 * - Dependent operations
 * - No yields case
 * - Type information preservation
 * - UnwrapOrElse pattern
 * - Data transformation pipeline
 * - Accumulator patterns
 * - Stack overflow prevention (many yields)
 * - Conditional logic
 * - Safe navigation through nested objects
 * - Option.all and Option.any in gen
 * - Match in gen
 * - Complex pipelines
 *
 * Run: bun run examples/option/05-gen.ts
 */

/**
 * 06-genAdapter.ts - Generator with adapter for better type inference
 *
 * Topics covered:
 * - Adapter function ($) usage
 * - Improved type inference
 * - Method calls on objects
 * - API composition
 * - Conditional logic
 * - Safe parsing utilities
 * - Multi-step validation
 * - Array iteration
 * - Accumulator patterns
 * - Transaction-like operations
 * - gen vs genAdapter comparison
 * - Option.all and Option.any
 * - Nested operations
 * - FromPredicate usage
 *
 * Run: bun run examples/option/06-genAdapter.ts
 */

/**
 * 07-asyncGen.ts - Imperative-style async Option composition
 *
 * Topics covered:
 * - Simple asyncGen with sync/async Options
 * - Multiple yields with mixed sync/async
 * - Short-circuit on None
 * - Async operations with delays
 * - Fetching data patterns
 * - Auto-awaiting Option<Promise<T>>
 * - Async validation pipelines
 * - Mixed sync and async yields
 * - Dependent async lookups
 * - Promise<Option<T>> handling
 * - Complex async workflows
 * - toPromise conversion
 * - Retry-like patterns
 * - Array processing
 * - Conditional async operations
 * - Batch operations
 *
 * Run: bun run examples/option/07-asyncGen.ts
 */

/**
 * 08-asyncGenAdapter.ts - Async generator with adapter
 *
 * Topics covered:
 * - Adapter function ($) in async context
 * - Promise<Option<T>> handling
 * - Option<Promise<T>> with auto-await
 * - Improved type inference
 * - API composition
 * - Complex async validation
 * - Transaction workflows
 * - Retry logic with fallbacks
 * - Data processing pipelines
 * - Array operations
 * - Conditional logic
 * - Batch operations
 * - Parallel-like patterns (sequential)
 * - toPromise usage
 * - Complex workflows (checkout flow)
 * - Error recovery
 * - Nested operations
 * - Streaming-like patterns
 * - State management
 *
 * Run: bun run examples/option/08-asyncGenAdapter.ts
 */

// ============================================================================
// WORKFLOW EXAMPLES (files 09-10)
// ============================================================================

/**
 * 09-workflow-simple-sync.ts - Real-world sync workflow
 *
 * Domain: E-commerce checkout summary
 *
 * Comparisons shown:
 * - flatMap chain style
 * - Option.gen style
 * - Option.genAdapter style
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
 *
 * Also covers:
 * - Multi-step validation comparison
 * - Failure scenarios (inactive user, empty cart, non-existent cart)
 * - Product lookup with validation
 * - Readability comparison
 *
 * Run: bun run examples/option/09-workflow-simple-sync.ts
 */

/**
 * 10-workflow-async.ts - Real-world async workflow
 *
 * Domain: E-commerce checkout summary with async operations
 *
 * Styles shown:
 * - Option.asyncGen
 * - Option.asyncGenAdapter
 * - Auto-awaiting Option<Promise<T>>
 * - Complex multi-step async validation
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
 *
 * Also covers:
 * - Error handling comparison
 * - Sequential async fetch patterns
 * - toPromise conversion
 * - Mixed sync/async operations
 * - Readability comparison
 *
 * Run: bun run examples/option/10-workflow-async.ts
 */

// ============================================================================
// SHARED DOMAIN (for workflow examples)
// ============================================================================

/**
 * shared-domain.ts - Domain models used in workflow examples
 *
 * Contains:
 * - UserEntity, ProductEntity, CartItemEntity, CartEntity classes
 * - CheckoutSummary interface
 * - Mock data (users, products, carts)
 * - Repository methods (sync and async)
 * - Validation functions
 *
 * Imported by: 09-workflow-simple-sync.ts, 10-workflow-async.ts
 */

// ============================================================================
// QUICK REFERENCE
// ============================================================================

/**
 * WHEN TO USE EACH METHOD:
 *
 * map():
 *   - Transform Some value
 *   - None bypasses mapper
 *   - Use for simple transformations
 *
 * mapOr():
 *   - Transform or return default value
 *   - Returns U, not Option<U>
 *   - Use for providing fallbacks
 *
 * flatMap():
 *   - Chain Option-returning functions
 *   - Stop on first None
 *   - Use for dependent operations
 *
 * zip():
 *   - Keep original value along with transformed value
 *   - Returns [original, derived] tuple
 *   - Use for audit trails, context preservation
 *
 * flatZip():
 *   - Like zip, but function returns Option
 *   - Stop on first None
 *   - Use for dependent operations with context
 *
 * gen():
 *   - Imperative-style sync code
 *   - Multiple yields with automatic threading
 *   - Short-circuits on None
 *   - Use for complex multi-step operations
 *
 * genAdapter():
 *   - Same as gen, with adapter function ($)
 *   - Better type inference for complex cases
 *   - Makes Option operations explicit
 *
 * asyncGen():
 *   - Imperative-style async code
 *   - Handles Promise<Option<T>> and Option<Promise<T>>
 *   - Auto-awaits inner promises
 *   - Use for async workflows
 *
 * asyncGenAdapter():
 *   - Same as asyncGen, with adapter ($)
 *   - Best type inference for async workflows
 *   - Explicit adapter makes yields clear
 */

export {};
