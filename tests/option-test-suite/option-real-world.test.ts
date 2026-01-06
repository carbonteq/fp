import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";
import { AsyncTestHelpers, ErrorTestHelpers } from "./test-utils";

/**
 * Real-world Usage Scenario Tests
 *
 * These tests demonstrate practical applications of the Option type in scenarios
 * that developers would encounter in real applications. They include:
 *
 * 1. API response handling
 * 2. Configuration management
 * 3. Form validation pipelines
 * 4. Data transformation workflows
 * 5. Error recovery patterns
 * 6. Integration with existing code patterns
 */

describe("ExperimentalOption - Real-world Usage Scenarios", () => {
  describe("API Response Handling", () => {
    interface User {
      id: number;
      name: string;
      email?: string;
      profile?: {
        age?: number;
        avatar?: string;
      };
    }

    interface ApiResponse<T> {
      data?: T;
      error?: string;
      status: number;
    }

    it("should handle optional API fields gracefully", () => {
      const apiResponse: ApiResponse<User> = {
        status: 200,
        data: {
          id: 1,
          name: "Alice",
          // email is missing
          profile: {
            // age is missing
            avatar: "alice.jpg",
          },
        },
      };

      // Extract user data safely
      const userOpt = ExperimentalOption.Some(apiResponse.data).flatMap(
        (data) =>
          data ? ExperimentalOption.Some(data) : ExperimentalOption.None,
      );

      // Extract optional email
      const emailOpt = userOpt.flatMap((user) =>
        user.email
          ? ExperimentalOption.Some(user.email)
          : ExperimentalOption.None,
      );

      // Extract optional age
      const ageOpt = userOpt
        .flatMap((user) => user.profile)
        .flatMap((profile) =>
          profile.age
            ? ExperimentalOption.Some(profile.age)
            : ExperimentalOption.None,
        );

      // Extract avatar with fallback
      const avatarWithFallback = userOpt
        .flatMap((user) => user.profile)
        .map((profile) => profile.avatar || "default.jpg");

      expect(userOpt.unwrap().name).toBe("Alice");
      expect(() => emailOpt.unwrap()).toThrow("Called unwrap on a None value"); // email missing
      expect(() => ageOpt.unwrap()).toThrow("Called unwrap on a None value"); // age missing
      expect(avatarWithFallback.unwrap()).toBe("alice.jpg");
    });

    it("should handle API error responses", () => {
      const errorResponse: ApiResponse<User> = {
        status: 404,
        error: "User not found",
      };

      const userOpt = ExperimentalOption.Some(errorResponse.data).flatMap(
        (data) =>
          data ? ExperimentalOption.Some(data) : ExperimentalOption.None,
      );

      expect(() => userOpt.unwrap()).toThrow("Called unwrap on a None value");

      // Safe extraction with fallback
      const safeExtract = userOpt.map((user) => user.name).unwrapOr("Guest");

      expect(safeExtract).toBe("Guest");
    });

    it("should handle async API calls", async () => {
      // Simulate async API call
      const fetchUser = async (id: number): Promise<ApiResponse<User>> => {
        await AsyncTestHelpers.delay(10);
        if (id === 1) {
          return {
            status: 200,
            data: {
              id: 1,
              name: "Alice",
              email: "alice@example.com",
            },
          };
        } else {
          return {
            status: 404,
            error: "User not found",
          };
        }
      };

      const userOpt = ExperimentalOption.Some(fetchUser(1))
        .map(async (response) => {
          const result = await response;
          return result.data;
        })
        .flatMap((data) => ExperimentalOption.Some(data));

      expect(userOpt.value.constructor.name).toBe("AsyncOpt");

      const user = await userOpt.unwrap();
      expect(user.name).toBe("Alice");
    });

    it("should handle complex data transformation pipelines", () => {
      const rawData = {
        users: [
          { id: 1, name: "Alice", active: true },
          { id: 2, name: "Bob", active: false },
          { id: 3, name: "Charlie", active: true },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
        },
      };

      // Find active user with specific transformations
      const activeUserOpt = ExperimentalOption.Some(rawData)
        .map((data) => data.users)
        .flatMap((users) => {
          const activeUser = users.find((u) => u.id === 1 && u.active);
          return activeUser
            ? ExperimentalOption.Some(activeUser)
            : ExperimentalOption.None;
        })
        .map((user) => ({
          id: user.id,
          displayName: user.name.toUpperCase(),
          status: "ACTIVE",
        }));

      expect(activeUserOpt.unwrap()).toEqual({
        id: 1,
        displayName: "ALICE",
        status: "ACTIVE",
      });
    });
  });

  describe("Configuration Management", () => {
    interface AppConfig {
      database?: {
        host?: string;
        port?: number;
        ssl?: boolean;
      };
      api?: {
        key?: string;
        timeout?: number;
        retries?: number;
      };
      features?: {
        enableCache?: boolean;
        enableLogging?: boolean;
        debugMode?: boolean;
      };
    }

    it("should handle optional configuration with defaults", () => {
      const partialConfig: AppConfig = {
        database: {
          host: "localhost",
          // port missing
        },
        api: {
          // key missing
          timeout: 5000,
        },
        // features missing entirely
      };

      const configOpt = ExperimentalOption.Some(partialConfig);

      // Extract database config with defaults
      const dbConfig = configOpt
        .map((config) => config.database || {})
        .map((db) => ({
          host: db.host || "localhost",
          port: db.port || 5432,
          ssl: db.ssl || false,
        }));

      // Extract API config with defaults
      const apiConfig = configOpt
        .map((config) => config.api || {})
        .map((api) => ({
          key: api.key || "default-api-key",
          timeout: api.timeout || 3000,
          retries: api.retries || 3,
        }));

      // Extract features with all defaults
      const features = configOpt
        .map((config) => config.features || {})
        .map((feats) => ({
          enableCache:
            feats.enableCache !== undefined ? feats.enableCache : true,
          enableLogging:
            feats.enableLogging !== undefined ? feats.enableLogging : true,
          debugMode: feats.debugMode !== undefined ? feats.debugMode : false,
        }));

      expect(dbConfig.unwrap()).toEqual({
        host: "localhost",
        port: 5432,
        ssl: false,
      });

      expect(apiConfig.unwrap()).toEqual({
        key: "default-api-key",
        timeout: 5000,
        retries: 3,
      });

      expect(features.unwrap()).toEqual({
        enableCache: true,
        enableLogging: true,
        debugMode: false,
      });
    });

    it("should validate configuration requirements", () => {
      const invalidConfig: AppConfig = {
        database: {}, // host missing - required
        api: {
          key: "", // empty key - invalid
        },
      };

      const configOpt = ExperimentalOption.Some(invalidConfig);

      // Validate database has required host
      const dbValidation = configOpt
        .map((config) => config.database)
        .flatMap((db) =>
          db && db.host
            ? ExperimentalOption.Some(db.host)
            : ExperimentalOption.None,
        );

      // Validate API key is non-empty
      const apiKeyValidation = configOpt
        .map((config) => config.api)
        .flatMap((api) =>
          api && api.key && api.key.length > 0
            ? ExperimentalOption.Some(api.key)
            : ExperimentalOption.None,
        );

      expect(() => dbValidation.unwrap()).toThrow(
        "Called unwrap on a None value",
      );
      expect(() => apiKeyValidation.unwrap()).toThrow(
        "Called unwrap on a None value",
      );

      // Get validation errors
      const errors = [
        dbValidation.isSome ? "" : "Database host is required",
        apiKeyValidation.isSome ? "" : "API key must be non-empty",
      ].filter(Boolean);

      expect(errors).toEqual([
        "Database host is required",
        "API key must be non-empty",
      ]);
    });

    it("should handle environment variable configuration", () => {
      // Mock environment variables
      const env = {
        DATABASE_HOST: "production.db.com",
        DATABASE_PORT: "5432",
        API_TIMEOUT: "10000",
        DEBUG_MODE: "true",
        MISSING_VAR: undefined,
      };

      const configFromEnv = {
        database: {
          host: env.DATABASE_HOST,
          port: env.DATABASE_PORT ? parseInt(env.DATABASE_PORT, 10) : undefined,
        },
        api: {
          timeout: env.API_TIMEOUT ? parseInt(env.API_TIMEOUT, 10) : undefined,
        },
        features: {
          debugMode: env.DEBUG_MODE === "true",
        },
      };

      const configOpt = ExperimentalOption.Some(configFromEnv);

      // Extract with type safety
      const dbHost = configOpt
        .map((config) => config.database)
        .flatMap((db) =>
          db.host ? ExperimentalOption.Some(db.host) : ExperimentalOption.None,
        );

      const dbPort = configOpt
        .map((config) => config.database)
        .flatMap((db) =>
          db.port ? ExperimentalOption.Some(db.port) : ExperimentalOption.None,
        );

      const debugMode = configOpt
        .map((config) => config.features)
        .flatMap((feats) =>
          feats.debugMode !== undefined
            ? ExperimentalOption.Some(feats.debugMode)
            : ExperimentalOption.None,
        );

      expect(dbHost.unwrap()).toBe("production.db.com");
      expect(dbPort.unwrap()).toBe(5432);
      expect(debugMode.unwrap()).toBe(true);
    });
  });

  describe("Form Validation Pipelines", () => {
    interface FormData {
      name?: string;
      email?: string;
      age?: string;
      password?: string;
      confirmPassword?: string;
    }

    interface ValidationError {
      field: string;
      message: string;
    }

    it("should validate user registration form", () => {
      const formData: FormData = {
        name: "Alice",
        email: "alice@example.com",
        age: "25",
        password: "password123",
        confirmPassword: "password123",
      };

      const formDataOpt = ExperimentalOption.Some(formData);

      // Validation pipeline
      const validationResult = formDataOpt
        // Validate name
        .flatMap((data) =>
          data.name && data.name.trim().length >= 2
            ? ExperimentalOption.Some(data)
            : ExperimentalOption.None,
        )
        // Validate email
        .flatMap((data) =>
          data.email && data.email.includes("@")
            ? ExperimentalOption.Some(data)
            : ExperimentalOption.None,
        )
        // Validate age
        .flatMap((data) => {
          const ageNum = parseInt(data.age || "0", 10);
          return ageNum >= 18 && ageNum <= 120
            ? ExperimentalOption.Some({ ...data, ageNum })
            : ExperimentalOption.None;
        })
        // Validate password
        .flatMap((data) =>
          data.password && data.password.length >= 8
            ? ExperimentalOption.Some(data)
            : ExperimentalOption.None,
        )
        // Validate password confirmation
        .flatMap((data) =>
          data.password === data.confirmPassword
            ? ExperimentalOption.Some(data)
            : ExperimentalOption.None,
        );

      if (validationResult.isSome) {
        const validated = validationResult.unwrap();
        expect(validated.name).toBe("Alice");
        expect(validated.ageNum).toBe(25);
      } else {
        expect(false).toBe(true); // Should not happen with valid data
      }
    });

    it("should collect validation errors", () => {
      const invalidFormData: FormData = {
        name: "A", // too short
        email: "invalid-email", // invalid format
        age: "15", // too young
        password: "123", // too short
        confirmPassword: "456", // mismatch
      };

      const formDataOpt = ExperimentalOption.Some(invalidFormData);

      // Individual validation checks
      const nameValid = formDataOpt
        .map((data) => data.name || "")
        .map((name) => name.trim().length >= 2)
        .unwrapOr(false);

      const emailValid = formDataOpt
        .map((data) => data.email || "")
        .map((email) => email.includes("@"))
        .unwrapOr(false);

      const ageValid = formDataOpt
        .map((data) => parseInt(data.age || "0", 10))
        .map((age) => age >= 18 && age <= 120)
        .unwrapOr(false);

      const passwordValid = formDataOpt
        .map((data) => data.password || "")
        .map((password) => password.length >= 8)
        .unwrapOr(false);

      const passwordsMatch = formDataOpt
        .map((data) => data.password === data.confirmPassword)
        .unwrapOr(false);

      // Collect errors
      const errors: ValidationError[] = [];
      if (!nameValid)
        errors.push({
          field: "name",
          message: "Name must be at least 2 characters",
        });
      if (!emailValid)
        errors.push({ field: "email", message: "Valid email required" });
      if (!ageValid)
        errors.push({
          field: "age",
          message: "Must be between 18-120 years old",
        });
      if (!passwordValid)
        errors.push({
          field: "password",
          message: "Password must be at least 8 characters",
        });
      if (!passwordsMatch)
        errors.push({
          field: "confirmPassword",
          message: "Passwords must match",
        });

      expect(errors).toHaveLength(5);
      expect(errors.map((e) => e.field)).toEqual([
        "name",
        "email",
        "age",
        "password",
        "confirmPassword",
      ]);
    });

    it("should handle conditional validation", () => {
      const formData: FormData = {
        name: "Bob",
        email: "bob@example.com",
        age: "17", // underage
        password: "password123",
        confirmPassword: "password123",
      };

      const formDataOpt = ExperimentalOption.Some(formData);

      // Different validation for adults vs minors
      const validationResult = formDataOpt.flatMap((data) => {
        const age = parseInt(data.age || "0", 10);

        if (age >= 18) {
          // Adult validation
          return data.password && data.password.length >= 8
            ? ExperimentalOption.Some({ ...data, category: "adult" as const })
            : ExperimentalOption.None;
        } else {
          // Minor validation (more relaxed)
          return data.name && data.name.trim().length >= 2
            ? ExperimentalOption.Some({ ...data, category: "minor" as const })
            : ExperimentalOption.None;
        }
      });

      const result = validationResult.unwrap();
      expect(result.category).toBe("minor");
    });
  });

  describe("Data Processing Workflows", () => {
    interface Product {
      id: number;
      name: string;
      price?: number;
      category?: string;
      inStock?: boolean;
    }

    it("should process e-commerce product data", () => {
      const rawProducts: Product[] = [
        {
          id: 1,
          name: "Laptop",
          price: 999,
          category: "Electronics",
          inStock: true,
        },
        { id: 2, name: "Book", price: 19.99, category: "Books" }, // inStock missing
        { id: 3, name: "Headphones" }, // price, category, inStock missing
        {
          id: 4,
          name: "Coffee Mug",
          price: 12.5,
          category: "Kitchen",
          inStock: false,
        },
      ];

      // Process products with complete data
      const processedProducts = rawProducts
        .map((product) => ExperimentalOption.Some(product))
        .map((opt) =>
          opt
            .flatMap((p) =>
              p.price ? ExperimentalOption.Some(p) : ExperimentalOption.None,
            )
            .map((p) => ({
              ...p,
              priceWithTax: p.price * 1.2, // Add 20% tax
              inStock: p.inStock || false, // Default to false
              availability: p.inStock ? "Available" : "Out of Stock",
            })),
        )
        .filter((opt) => {
          try {
            opt.unwrap();
            return true;
          } catch {
            return false;
          }
        })
        .map((opt) => opt.unwrap());

      expect(processedProducts).toHaveLength(3); // Exclude product without price

      const laptop = processedProducts.find((p) => p.id === 1);
      expect(laptop?.priceWithTax).toBe(1198.8);
      expect(laptop?.availability).toBe("Available");

      const book = processedProducts.find((p) => p.id === 2);
      expect(book?.inStock).toBe(false);
      expect(book?.availability).toBe("Out of Stock");
    });

    it("should handle data transformation pipelines", () => {
      const csvData = [
        "name,age,city,salary",
        "Alice,30,New York,75000",
        "Bob,25,,60000", // missing city
        "Charlie,35,Chicago,", // missing salary
        "Diana,28,Boston,85000",
      ];

      const parseCSVRow = (row: string) => {
        const [name, ageStr, city, salaryStr] = row.split(",");
        return {
          name: name.trim(),
          age: ageStr ? parseInt(ageStr.trim(), 10) : undefined,
          city: city?.trim() || undefined,
          salary: salaryStr ? parseFloat(salaryStr.trim()) : undefined,
        };
      };

      // Process CSV data with Option
      const processedData = csvData
        .slice(1) // Skip header
        .map((row) => ExperimentalOption.Some(parseCSVRow(row)))
        .map((opt) =>
          opt
            // Filter rows with complete data
            .flatMap((data) =>
              data.age && data.city && data.salary
                ? ExperimentalOption.Some(data)
                : ExperimentalOption.None,
            )
            // Transform data
            .map((data) => ({
              name: data.name,
              age: data.age,
              city: data.city,
              salary: data.salary,
              salaryCategory: data.salary! > 70000 ? "High" : "Standard",
              ageGroup: data.age! < 30 ? "Young" : "Senior",
            })),
        )
        .filter((opt) => {
          try {
            opt.unwrap();
            return true;
          } catch {
            return false;
          }
        })
        .map((opt) => opt.unwrap());

      expect(processedData).toHaveLength(2);

      const alice = processedData.find((p) => p.name === "Alice");
      expect(alice?.salaryCategory).toBe("High");
      expect(alice?.ageGroup).toBe("Senior");

      const diana = processedData.find((p) => p.name === "Diana");
      expect(diana?.salaryCategory).toBe("High");
      expect(diana?.ageGroup).toBe("Young");
    });

    it("should handle batch processing with error recovery", async () => {
      const processItem = async (item: string): Promise<string> => {
        await AsyncTestHelpers.delay(1);
        if (item.includes("fail")) {
          throw new Error(`Processing failed for: ${item}`);
        }
        return `processed-${item}`;
      };

      const items = ["item1", "item2", "fail-item", "item3", "item4"];

      // Process items with error handling
      const results = await Promise.all(
        items.map(async (item) => {
          const result = ExperimentalOption.Some(item)
            .map(processItem)
            .flatMap(async (promise) => {
              try {
                const processed = await promise;
                return ExperimentalOption.Some(processed);
              } catch (error) {
                return ExperimentalOption.None;
              }
            });

          try {
            return { item, result: await result.unwrap(), success: true };
          } catch {
            return { item, result: null, success: false };
          }
        }),
      );

      expect(results).toHaveLength(5);
      expect(results.filter((r) => r.success)).toHaveLength(4);
      expect(results.filter((r) => !r.success)).toHaveLength(1);

      const failedResult = results.find((r) => !r.success);
      expect(failedResult?.item).toBe("fail-item");
    });
  });

  describe("Error Recovery Patterns", () => {
    it("should demonstrate circuit breaker pattern", () => {
      let failureCount = 0;
      const maxFailures = 3;

      const unreliableOperation = (shouldFail: boolean = false) => {
        if (shouldFail && failureCount < maxFailures) {
          failureCount++;
          return ExperimentalOption.None; // Simulate failure
        }
        return ExperimentalOption.Some("success");
      };

      // Circuit breaker logic
      const operationWithCircuitBreaker = () => {
        const result = unreliableOperation(failureCount < maxFailures);

        return result
          .map((value) => ({ value, circuitOpen: false }))
          .flatMap(({ value, circuitOpen }) =>
            circuitOpen
              ? ExperimentalOption.None
              : ExperimentalOption.Some(value),
          );
      };

      // Try operation multiple times
      const attempts = [];
      for (let i = 0; i < 5; i++) {
        const result = operationWithCircuitBreaker();
        attempts.push({
          attempt: i + 1,
          success: result.isSome,
          value: result.isSome ? result.unwrap() : null,
        });
      }

      expect(attempts[0].success).toBe(false); // First failure
      expect(attempts[1].success).toBe(false); // Second failure
      expect(attempts[2].success).toBe(false); // Third failure
      expect(attempts[3].success).toBe(true); // Success after failures
      expect(attempts[4].success).toBe(true); // Continued success
    });

    it("should implement retry mechanism with exponential backoff", async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      const flakyOperation = async (): Promise<string> => {
        await AsyncTestHelpers.delay(1);
        attemptCount++;
        if (attemptCount < maxAttempts) {
          throw new Error(`Attempt ${attemptCount} failed`);
        }
        return `success-after-${attemptCount}-attempts`;
      };

      // Retry mechanism
      const retryOperation = async (): Promise<ExperimentalOption<string>> => {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            const result = await flakyOperation();
            return ExperimentalOption.Some(result);
          } catch (error) {
            if (attempt === maxAttempts) {
              return ExperimentalOption.None; // All attempts failed
            }
            // Exponential backoff
            await AsyncTestHelpers.delay(2 ** attempt);
          }
        }
        return ExperimentalOption.None;
      };

      const result = await retryOperation();
      expect(result.isSome).toBe(true);
      expect(result.unwrap()).toBe("success-after-3-attempts");
    });

    it("should implement fallback chain pattern", () => {
      const primaryData = ExperimentalOption.None; // Primary source unavailable
      const secondaryData = ExperimentalOption.Some("secondary-value");
      const tertiaryData = ExperimentalOption.Some("tertiary-value");
      const fallbackValue = "default-value";

      const result = primaryData
        .orElse(() => secondaryData)
        .orElse(() => tertiaryData)
        .map((value) => `processed-${value}`)
        .unwrapOr(fallbackValue);

      // Note: orElse is not implemented, so this shows the intended pattern
      expect(result).toBe("processed-secondary-value");
    });
  });

  describe("Integration with Existing Code Patterns", () => {
    it("should work with existing null-checking patterns", () => {
      interface LegacyData {
        user?: {
          profile?: {
            settings?: {
              theme?: string;
              notifications?: boolean;
            };
          };
        };
      }

      const legacyData: LegacyData = {
        user: {
          profile: {
            settings: {
              theme: "dark",
            },
          },
        },
      };

      // Traditional approach
      const traditionalTheme =
        legacyData.user?.profile?.settings?.theme || "light";

      // Option approach
      const optionTheme = ExperimentalOption.Some(legacyData)
        .map((data) => data.user)
        .flatMap((user) =>
          user ? ExperimentalOption.Some(user) : ExperimentalOption.None,
        )
        .map((user) => user.profile)
        .flatMap((profile) =>
          profile ? ExperimentalOption.Some(profile) : ExperimentalOption.None,
        )
        .map((profile) => profile.settings)
        .flatMap((settings) =>
          settings
            ? ExperimentalOption.Some(settings)
            : ExperimentalOption.None,
        )
        .map((settings) => settings.theme)
        .unwrapOr("light");

      expect(traditionalTheme).toBe("dark");
      expect(optionTheme).toBe("dark");
    });

    it("should integrate with array methods", () => {
      const numbers = [1, 2, 3, 4, 5];

      // Find and transform with Option
      const firstEvenOpt = ExperimentalOption.Some(numbers)
        .map((nums) => nums.find((n) => n % 2 === 0))
        .flatMap((even) =>
          even !== undefined
            ? ExperimentalOption.Some(even)
            : ExperimentalOption.None,
        )
        .map((even) => even * 2);

      expect(firstEvenOpt.unwrap()).toBe(4);

      // Safe array access
      const getSafeElement = <T>(
        array: T[],
        index: number,
      ): ExperimentalOption<T> =>
        ExperimentalOption.Some(array)
          .map((arr) => arr[index])
          .flatMap((element) =>
            element !== undefined
              ? ExperimentalOption.Some(element)
              : ExperimentalOption.None,
          );

      const thirdElement = getSafeElement(numbers, 2);
      const outOfBounds = getSafeElement(numbers, 10);

      expect(thirdElement.unwrap()).toBe(3);
      expect(() => outOfBounds.unwrap()).toThrow(
        "Called unwrap on a None value",
      );
    });

    it("should work with function composition patterns", () => {
      const add = (a: number) => (b: number) => a + b;
      const multiply = (a: number) => (b: number) => a * b;
      const divide = (a: number) => (b: number) => (b === 0 ? null : a / b);

      // Compose operations with Option
      const composeWithOption =
        <T, U, V>(fn1: (x: T) => U | null, fn2: (y: U) => V | null) =>
        (x: T): ExperimentalOption<V> =>
          ExperimentalOption.Some(fn1(x))
            .flatMap((result) =>
              result !== null
                ? ExperimentalOption.Some(result)
                : ExperimentalOption.None,
            )
            .flatMap((result) => {
              const final = fn2(result);
              return final !== null
                ? ExperimentalOption.Some(final)
                : ExperimentalOption.None;
            });

      const safeMultiplyThenAdd = composeWithOption(multiply(5), add(10));

      const safeDivideThenMultiply = composeWithOption(divide(20), multiply(3));

      expect(safeMultiplyThenAdd(4).unwrap()).toBe(30); // 4 * 5 + 10
      expect(safeDivideThenMultiply(4).unwrap()).toBe(15); // 20 / 4 * 3

      // Division by zero case
      expect(() => safeDivideThenMultiply(0).unwrap()).toThrow(
        "Called unwrap on a None value",
      );
    });
  });

  describe("Performance-optimized Scenarios", () => {
    it("should handle streaming data processing", () => {
      // Simulate a stream of data points
      const dataPoints = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        value: Math.random() * 100,
        timestamp: Date.now() + i * 1000,
      }));

      // Filter and transform efficiently
      const processedPoints = dataPoints
        .map((point) => ExperimentalOption.Some(point))
        .map((opt) =>
          opt
            .flatMap((p) =>
              p.value > 50
                ? ExperimentalOption.Some(p)
                : ExperimentalOption.None,
            )
            .map((p) => ({
              ...p,
              category: p.value > 75 ? "high" : "medium",
              processed: true,
            })),
        )
        .filter((opt) => {
          try {
            opt.unwrap();
            return true;
          } catch {
            return false;
          }
        })
        .map((opt) => opt.unwrap());

      expect(processedPoints.length).toBeGreaterThan(400); // Roughly half the points
      expect(processedPoints.every((p) => p.processed)).toBe(true);
      expect(
        processedPoints.every(
          (p) => p.category === "high" || p.category === "medium",
        ),
      ).toBe(true);
    });

    it("should implement memoization with Option", () => {
      const cache = new Map<string, any>();
      let computeCount = 0;

      const expensiveComputation = (input: string) => {
        computeCount++;
        return `computed-${input}-${Date.now()}`;
      };

      const memoizedComputation = (key: string): ExperimentalOption<string> => {
        // Check cache first
        const cached = ExperimentalOption.Some(cache.get(key)).flatMap(
          (value) =>
            value !== undefined
              ? ExperimentalOption.Some(value)
              : ExperimentalOption.None,
        );

        if (cached.isSome) {
          return cached;
        }

        // Compute and cache
        const result = ExperimentalOption.Some(expensiveComputation(key));
        result.map((value) => cache.set(key, value));
        return result;
      };

      // First call - should compute
      const result1 = memoizedComputation("test-key");
      expect(result1.unwrap().startsWith("computed-test-key")).toBe(true);
      expect(computeCount).toBe(1);

      // Second call - should use cache
      const result2 = memoizedComputation("test-key");
      expect(result2.unwrap()).toBe(result1.unwrap());
      expect(computeCount).toBe(1); // No additional computation

      // Different key - should compute again
      const result3 = memoizedComputation("another-key");
      expect(result3.unwrap().startsWith("computed-another-key")).toBe(true);
      expect(computeCount).toBe(2);
    });
  });
});
