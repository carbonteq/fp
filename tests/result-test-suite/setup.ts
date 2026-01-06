/**
 * Global Test Suite Setup
 *
 * Configures the test environment for the Result test suite.
 */

import { afterEach, beforeEach } from "bun:test";

// Global test configuration
beforeEach(() => {
  // Reset any global state before each test
  // This can be expanded if needed for future requirements
});

afterEach(() => {
  // Cleanup after each test
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});

// Configure test timeout for async operations
// Increase timeout for complex async chains and performance tests
test.setTimeout(30000); // 30 seconds
