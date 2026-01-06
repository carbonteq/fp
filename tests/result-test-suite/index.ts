/**
 * Result Test Suite Entry Point
 *
 * This file exports all test utilities, fixtures, and helpers
 * for the comprehensive Result implementation test suite.
 */

// Type exports for test typing
export type {
  SafeUnwrapResult,
  Sentinel,
} from "@/internal/result.experimental";
// Re-export test subject for convenience
export {
  AsyncResult,
  BetterResult,
  SyncResult,
} from "@/internal/result.experimental";
// Test fixtures and scenarios
export * from "./fixtures/data";
export * from "./fixtures/performance";
export * from "./fixtures/scenarios";
export * from "./utils/assertion-helpers";
// Test utilities
export * from "./utils/async-helpers";
export * from "./utils/performance-helpers";
export * from "./utils/test-builders";
