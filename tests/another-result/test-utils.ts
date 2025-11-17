// Typed mapper functions for testing Result types

// Basic numeric mappers
export const double = (x: number): number => x * 2;
export const triple = (x: number): number => x * 3;
export const addOne = (x: number): number => x + 1;
export const toString = (x: number): string => x.toString();

// String mappers
export const toUpperCase = (s: string): string => s.toUpperCase();
export const exclaim = (s: string): string => `${s}!`;
export const length = (s: string): number => s.length;

// Tuple mappers for zip operations
export const pairWithDouble = (x: number): [number, number] => [x, x * 2];
export const pairWithTriple = (x: number): number => x * 3; // For zip (returns second value)

// Error mappers
export const prependError =
  (prefix: string) =>
  (error: string): string =>
    `${prefix}: ${error}`;

// Functions for flatMap operations - these return Result-like objects
export const doubleResult = (x: number) => x * 2;
export const tripleResult = (x: number) => x * 3;
export const addOneResult = (x: number) => x + 1;

// Conditional operations for flatMap
export const ifPositiveDouble = (x: number) => (x > 0 ? x * 2 : x);
export const ifEvenTriple = (x: number) => (x % 2 === 0 ? x * 3 : x);

// Complex chain operations
export const complexMapper = (x: number): string => {
  const doubled = x * 2;
  const added = doubled + 1;
  return `result: ${added}`;
};

// Pair operations for flatZip
export const sumPair = ([x, y]: [number, number]): number => x + y;
export const multiplyPair = ([x, y]: [number, number]): number => x * y;

// Error conditions for testing
export const alwaysFail = <T>(_: T): string => "always fails";
export const failIfZero = (x: number): string | null =>
  x === 0 ? "zero error" : null;

// Async versions
export const asyncDouble = async (x: number): Promise<number> => x * 2;
export const asyncAddOne = async (x: number): Promise<number> => x + 1;
export const asyncToString = async (x: number): Promise<string> => x.toString();

// Async mappers with delay for testing
export const delayedDouble = async (x: number): Promise<number> => {
  await new Promise((resolve) => setTimeout(resolve, 1));
  return x * 2;
};

// Test constants
export const TEST_ERROR = "test error";
export const TEST_VALUE = 42;
export const TEST_STRING = "hello world";
