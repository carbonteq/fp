/**
 * Result Examples Index
 *
 * This file lists all available examples and demonstrates different
 * patterns for working with Result types.
 *
 * Run examples with:
 *   bun run examples/result/01-map.ts
 *   bun run examples/result/02-flatMap.ts
 *   etc.
 */

// ============================================================================
// BASIC OPERATIONS (files 01-04)
// ============================================================================

/**
 * 01-map.ts - Transform success values
 *
 * Topics covered:
 * - Basic map usage
 * - Map on Err (mapper not called)
 * - Chaining multiple maps
 * - Map with object transformation
 * - Map with async functions (returns Result<Promise<T>, E>)
 * - Map with array operations
 * - Type transformations
 *
 * Run: bun run examples/result/01-map.ts
 */

/**
 * 02-flatMap.ts - Chain Result-returning functions
 *
 * Topics covered:
 * - Basic flatMap chains
 * - Short-circuit on errors
 * - Chaining multiple flatMaps
 * - Dependent lookups (user → posts)
 * - Error type unions
 * - Async flatMap
 * - Validation pipelines
 * - flatMap vs map comparison
 * - Real-world user registration flow
 *
 * Run: bun run examples/result/02-flatMap.ts
 */

/**
 * 03-zip.ts - Pair original with derived value
 *
 * Topics covered:
 * - Basic zip usage
 * - Zip on Err
 * - Async zip
 * - Validation with context
 * - Multiple zips
 * - Audit trail patterns
 * - Before/after comparisons
 * - Error context preservation
 * - Transformation history
 * - Async API call patterns
 *
 * Run: bun run examples/result/03-zip.ts
 */

/**
 * 04-flatZip.ts - Pair original with Result-returning function
 *
 * Topics covered:
 * - Basic flatZip usage
 * - Short-circuit on errors
 * - Chaining flatZips
 * - Async flatZip
 * - User and posts pattern
 * - Dependent lookups
 * - Validation with context
 * - Complex object building
 * - Sequential API calls
 * - flatZip vs flatMap comparison
 * - Audit log patterns
 * - Context preservation
 * - Multi-step validation
 *
 * Run: bun run examples/result/04-flatZip.ts
 */

// ============================================================================
// GENERATOR-BASED SYNTAX (files 05-08)
// ============================================================================

/**
 * 05-gen.ts - Imperative-style sync Result composition
 *
 * Topics covered:
 * - Simple gen with single/multiple yields
 * - Short-circuit on errors
 * - Function calls in gen
 * - Validation pipelines
 * - gen vs flatMap readability
 * - Complex object building
 * - Intermediate processing
 * - Array operations
 * - Dependent operations
 * - No yields case
 * - Error context collection
 * - Stack overflow prevention (many yields)
 * - Conditional logic
 * - Type information preservation
 * - Error recovery with orElse
 * - Sequential API patterns
 * - Accumulator patterns
 *
 * Run: bun run examples/result/05-gen.ts
 */

/**
 * 06-genAdapter.ts - Generator with adapter for better type inference
 *
 * Topics covered:
 * - Adapter function ($) usage
 * - Improved type inference with different error types
 * - Rich validation error types
 * - Method calls on objects
 * - API composition
 * - Conditional logic
 * - Parallel-like operations (sequential but clean)
 * - Error type narrowing
 * - Complex state building
 * - Try-catch patterns (safeParseInt, safeDivide)
 * - Array iteration
 * - Multi-step validation
 * - Nested genAdapter calls
 * - Accumulator patterns
 * - Transaction-like operations
 * - gen vs genAdapter comparison
 *
 * Run: bun run examples/result/06-genAdapter.ts
 */

/**
 * 07-asyncGen.ts - Imperative-style async Result composition
 *
 * Topics covered:
 * - Simple asyncGen with sync/async Results
 * - Multiple yields with mixed sync/async
 * - Short-circuit on errors
 * - Async operations with delays
 * - Fetching data patterns (user → posts)
 * - Auto-awaiting Result<Promise<T>, E>
 * - Async validation pipelines
 * - Error recovery
 * - Sequential API calls
 * - Async map chains
 * - Complex workflows (order → payment → receipt)
 * - toPromise conversion
 * - Retry-like patterns
 * - Array processing
 * - Conditional async operations
 * - Batch operations
 *
 * Run: bun run examples/result/07-asyncGen.ts
 */

/**
 * 08-asyncGenAdapter.ts - Async generator with adapter
 *
 * Topics covered:
 * - Adapter function ($) in async context
 * - Promise<Result<T,E>> handling
 * - Improved type inference
 * - API composition
 * - Auto-awaiting Result<Promise<T>, E>
 * - Complex async validation
 * - Transaction workflows
 * - Retry logic with fallbacks
 * - Data processing pipelines
 * - Array operations
 * - Conditional logic
 * - Batch operations
 * - Parallel-like patterns (sequential)
 * - toPromise usage
 * - Complex workflows (order → payment → shipment → invoice)
 * - Error aggregation
 * - Nested operations
 * - Streaming-like patterns
 *
 * Run: bun run examples/result/08-asyncGenAdapter.ts
 */

// ============================================================================
// WORKFLOW EXAMPLES (files 09-10)
// ============================================================================

/**
 * 09-workflow-simple-sync.ts - Real-world sync workflow
 *
 * Domain: Grocery list management
 *
 * Comparisons shown:
 * - flatMap chain style
 * - Result.gen style
 * - Result.genAdapter style
 *
 * Workflow steps:
 * - Ensure ownership
 * - Validate list is active
 * - Validate items
 * - Calculate stats
 * - Serialize data
 *
 * Also covers:
 * - Multi-step validation comparison
 * - Fetching and chaining
 * - Readability comparison
 *
 * Run: bun run examples/result/09-workflow-simple-sync.ts
 */

/**
 * 10-workflow-async.ts - Real-world async workflow
 *
 * Domain: Grocery list management with async operations
 *
 * Styles shown:
 * - Result.asyncGen
 * - Result.asyncGenAdapter
 * - Auto-awaiting Result<Promise<T>, E>
 * - Complex multi-step async validation
 *
 * Workflow steps:
 * - Fetch list and owner (async)
 * - Ensure ownership
 * - Async permission validation
 * - Validate list is active
 * - Fetch items (async)
 * - Validate items
 * - Serialize (async)
 * - Calculate stats (async)
 *
 * Also covers:
 * - Error handling comparison
 * - Sequential fetch patterns
 * - toPromise conversion
 * - Readability comparison
 *
 * Run: bun run examples/result/10-workflow-async.ts
 */

// ============================================================================
// SHARED DOMAIN (for workflow examples)
// ============================================================================

/**
 * shared-domain.ts - Domain models used in workflow examples
 *
 * Contains:
 * - UserEntity, ItemEntity, GroceryListEntity classes
 * - Error types (GroceryListOwnershipError, ValidationError)
 * - Helper functions (calculateDetailedStats)
 * - Mock data
 * - Repository methods (sync and async)
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
 *   - Transform success value
 *   - Error bypasses mapper
 *
 * flatMap():
 *   - Chain Result-returning functions
 *   - Stop on first error
 *
 * zip():
 *   - Keep original value along with transformed value
 *   - Returns [original, derived] tuple
 *
 * flatZip():
 *   - Like zip, but function returns Result
 *   - Stop on first error
 *
 * gen():
 *   - Imperative-style sync code
 *   - Multiple yields with automatic threading
 *   - Short-circuits on errors
 *
 * genAdapter():
 *   - Same as gen, with adapter function ($)
 *   - Better type inference for complex errors
 *
 * asyncGen():
 *   - Imperative-style async code
 *   - Handles Promise<Result<T,E>> and Result<Promise<T>,E>
 *   - Auto-awaits inner promises
 *
 * asyncGenAdapter():
 *   - Same as asyncGen, with adapter ($)
 *   - Best type inference for async workflows
 */

export {};
