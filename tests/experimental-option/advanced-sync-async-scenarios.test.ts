import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";

describe("ExperimentalOption - Advanced Sync/Async Scenarios", () => {
  describe("Real-world data processing scenarios", () => {
    it("should handle user authentication flow", async () => {
      interface User {
        id: number;
        email: string;
        isVerified: boolean;
      }
      interface AuthResult {
        user: User;
        token: string;
        expiresAt: Date;
      }

      const simulateDbLookup = async (email: string): Promise<User | null> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return email === "test@example.com"
          ? { id: 1, email, isVerified: true }
          : null;
      };

      const generateToken = async (user: User): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return `token-${user.id}-${Date.now()}`;
      };

      // Start with email input
      const emailOpt = ExperimentalOption.Some("test@example.com");

      const authResult = emailOpt
        // Sync validation
        .map((email) => email.trim())
        .map((email) => (email.includes("@") ? email : null))
        // Async database lookup and verification
        .flatMap((email) =>
          simulateDbLookup(email).then((user) =>
            user?.isVerified
              ? ExperimentalOption.Some(user)
              : ExperimentalOption.None,
          ),
        )
        // Generate token for verified users
        .flatMap((user) =>
          generateToken(user)
            .then((token) => ({
              user,
              token,
              expiresAt: new Date(Date.now() + 3600000), // 1 hour
            }))
            .then((result) => ExperimentalOption.Some(result)),
        );

      expect(authResult.value.constructor.name).toBe("AsyncOpt");
      const result = await authResult.value.value;

      expect(result).toEqual({
        user: { id: 1, email: "test@example.com", isVerified: true },
        token: expect.stringMatching(/^token-1-\d+$/),
        expiresAt: expect.any(Date),
      });
    });

    it("should handle file processing pipeline", async () => {
      interface FileData {
        name: string;
        content: string;
        size: number;
      }

      const readFile = async (filename: string): Promise<FileData> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          name: filename,
          content: "Hello, World! This is test content.",
          size: 35,
        };
      };

      const processContent = async (content: string): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return content
          .toLowerCase()
          .replace(/[.,!?]/g, "")
          .split(/\s+/)
          .filter((word) => word.length > 3)
          .join(" ");
      };

      const filenameOpt = ExperimentalOption.Some("test.txt");

      const processedData = filenameOpt
        // Sync validation
        .map((name) => (name.endsWith(".txt") ? name : null))
        // Async file reading with size validation
        .flatMap((name) =>
          readFile(name).then((file) =>
            file.size > 0
              ? ExperimentalOption.Some(file)
              : ExperimentalOption.None,
          ),
        )
        // Content processing
        .flatMap((file) =>
          processContent(file.content)
            .then((processed) => ({
              originalFile: file,
              processedContent: processed,
              wordCount: processed.split(/\s+/).length,
            }))
            .then((result) => ExperimentalOption.Some(result)),
        );

      expect(processedData.value.constructor.name).toBe("AsyncOpt");
      const result = await processedData.value.value;

      expect(result).toEqual({
        originalFile: {
          name: "test.txt",
          content: "Hello, World! This is test content.",
          size: 35,
        },
        processedContent: "hello world this test content",
        wordCount: 5,
      });
    });
  });

  describe("Error handling and recovery scenarios", () => {
    it("should handle validation errors at different stages", async () => {
      const simulateApiCall = async (id: number): Promise<string> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (id < 0) throw new Error("Invalid ID");
        return `Data for ID ${id}`;
      };

      const processData = (data: string): number => {
        if (!data.includes("ID")) throw new Error("Invalid data format");
        return data.length;
      };

      // Valid path
      const validPath = ExperimentalOption.Some(42)
        .map((id) => (id > 0 ? id : null)) // sync validation
        .flatMap((id) =>
          simulateApiCall(id)
            .catch((_err) => null)
            .then((data) => {
              try {
                return processData(data);
              } catch {
                return null;
              }
            })
            .then((result) =>
              result !== null
                ? ExperimentalOption.Some(result)
                : ExperimentalOption.None,
            ),
        );

      expect(validPath.value.constructor.name).toBe("AsyncOpt");
      const validResult = await validPath.value.value;
      expect(validResult).toBe(14); // "Data for ID 42".length

      // Invalid ID path
      const invalidIdPath = ExperimentalOption.Some(-5)
        .map((id) => (id > 0 ? id : null)) // sync validation
        .flatMap((id) =>
          id === null
            ? ExperimentalOption.None
            : simulateApiCall(id)
                .catch((_err) => null)
                .then((data) => {
                  return data ? processData(data) : null;
                })
                .then((result) =>
                  result !== null
                    ? ExperimentalOption.Some(result)
                    : ExperimentalOption.None,
                ),
        );

      const invalidIdResult = await invalidIdPath.value.value;
      expect(invalidIdResult).toBe(Symbol.for("OptSentinel"));

      // None propagation
      const nonePath = ExperimentalOption.None.map((id) =>
        id > 0 ? id : null,
      ).map((id) => simulateApiCall(id));

      const noneResult = await nonePath.value.value;
      expect(noneResult).toBe(Symbol.for("OptSentinel"));
    });

    it("should handle timeout scenarios", async () => {
      const slowOperation = async (value: number): Promise<number> => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return value * 2;
      };

      const withTimeout = <T>(
        promise: Promise<T>,
        ms: number,
      ): Promise<T | null> => {
        return Promise.race([
          promise,
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), ms),
          ),
        ]).catch(() => null);
      };

      const timeoutTest = ExperimentalOption.Some(42).flatMap((value) => {
        const slowPromise = slowOperation(value);
        const timeoutPromise = withTimeout(slowPromise, 5); // Shorter timeout than operation
        return timeoutPromise.then((result) =>
          result !== null
            ? ExperimentalOption.Some(result)
            : ExperimentalOption.None,
        );
      });

      expect(timeoutTest.value.constructor.name).toBe("AsyncOpt");
      const result = await timeoutTest.value.value;
      expect(result).toBe(Symbol.for("OptSentinel")); // Should timeout and return None
    });
  });

  describe("Complex data transformations", () => {
    it("should handle nested data structures", async () => {
      interface Address {
        street: string;
        city: string;
        country: string;
      }

      interface Person {
        id: number;
        name: string;
        address: Address | null;
        tags: string[];
      }

      interface EnrichedPerson {
        id: number;
        fullName: string;
        location: string;
        tagCount: number;
        hasInternationalAddress: boolean;
      }

      const personOpt = ExperimentalOption.Some<Person>({
        id: 123,
        name: "John Doe",
        address: {
          street: "123 Main St",
          city: "New York",
          country: "USA",
        },
        tags: ["developer", "javascript", "typescript"],
      });

      const enriched = personOpt
        // Process name
        .map((person) => ({
          ...person,
          name: person.name.toUpperCase(),
        }))
        // Async address validation and enrichment
        .flatMap((person) => {
          // Process address async and create enriched person
          return Promise.resolve(person.address).then(async (address) => {
            if (!address) {
              // Return enriched person without location info
              return ExperimentalOption.Some({
                id: person.id,
                fullName: person.name,
                location: "Unknown",
                tagCount: person.tags.length,
                hasInternationalAddress: false,
              });
            }
            // Simulate async geocoding
            await new Promise((resolve) => setTimeout(resolve, 1));
            const validatedAddress = {
              ...address,
              isValid: address.country.length === 3,
            };

            const enrichedPerson: EnrichedPerson = {
              id: person.id,
              fullName: person.name,
              location: `${validatedAddress.city}, ${validatedAddress.country}`,
              tagCount: person.tags.length,
              hasInternationalAddress: validatedAddress.country !== "USA",
            };

            return ExperimentalOption.Some(enrichedPerson);
          });
        });

      expect(enriched.value.constructor.name).toBe("AsyncOpt");
      const result = await enriched.value.value;

      expect(result).toEqual({
        id: 123,
        fullName: "JOHN DOE",
        location: "New York, USA",
        tagCount: 3,
        hasInternationalAddress: false,
      });
    });

    it("should handle array processing with mixed sync/async", async () => {
      const numbersOpt = ExperimentalOption.Some([1, 2, 3, 4, 5]);

      const processed = numbersOpt
        // Filter even numbers (sync)
        .map((numbers) => numbers.filter((n) => n % 2 === 0))
        // Process each number asynchronously and calculate summary
        .flatMap((evenNumbers) => {
          return Promise.all(
            evenNumbers.map(async (n, index) => {
              await new Promise((resolve) => setTimeout(resolve, 1));
              return {
                original: n,
                squared: n * n,
                position: index,
                isPrime: [2, 3, 5, 7, 11].includes(n),
              };
            }),
          )
            .then((processedNumbers) => ({
              count: processedNumbers.length,
              sumOfSquares: processedNumbers.reduce(
                (sum, item) => sum + item.squared,
                0,
              ),
              primeCount: processedNumbers.filter((item) => item.isPrime)
                .length,
              details: processedNumbers,
            }))
            .then((result) => ExperimentalOption.Some(result));
        });

      expect(processed.value.constructor.name).toBe("AsyncOpt");
      const result = await processed.value.value;

      expect(result).toEqual({
        count: 2, // [2, 4]
        sumOfSquares: 20, // 2² + 4² = 4 + 16
        primeCount: 1, // only 2 is prime
        details: [
          { original: 2, squared: 4, position: 0, isPrime: true },
          { original: 4, squared: 16, position: 1, isPrime: false },
        ],
      });
    });
  });

  describe("Performance and optimization scenarios", () => {
    it("should avoid unnecessary async conversions", () => {
      const opt = ExperimentalOption.Some(42);

      // Chain of sync operations - should remain sync
      const syncResult = opt
        .map((x) => x * 2)
        .map((x) => x + 10)
        .map((x) => x.toString())
        .map((s) => s.length)
        .map((l) => l * 3);

      expect(syncResult.value.constructor.name).toBe("SyncOpt");
      expect(syncResult.value.value).toBe(6); // (42*2+10)=94, "94".length=2, 2*3=6

      // Single async operation - should convert only once
      const asyncResult = opt
        .map((x) => x * 2)
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        })
        .map((x) => x.toString())
        .map((s) => s.length);

      expect(asyncResult.value.constructor.name).toBe("AsyncOpt");
    });

    it("should handle large data sets efficiently", async () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => i + 1);

      const dataOpt = ExperimentalOption.Some(largeArray);

      const processed = dataOpt
        // Sync filtering
        .map((arr) => arr.filter((n) => n % 2 === 0))
        // Async processing of chunks and aggregation
        .flatMap((evenNumbers) => {
          const chunkSize = 100;
          const chunks = [];
          for (let i = 0; i < evenNumbers.length; i += chunkSize) {
            chunks.push(evenNumbers.slice(i, i + chunkSize));
          }
          return Promise.all(
            chunks.map(async (chunk, chunkIndex) => {
              await new Promise((resolve) => setTimeout(resolve, 1));
              return {
                chunkIndex,
                sum: chunk.reduce((a, b) => a + b, 0),
                count: chunk.length,
                average: chunk.reduce((a, b) => a + b, 0) / chunk.length,
              };
            }),
          )
            .then((chunks) => ({
              totalChunks: chunks.length,
              totalSum: chunks.reduce((sum, chunk) => sum + chunk.sum, 0),
              totalCount: chunks.reduce(
                (count, chunk) => count + chunk.count,
                0,
              ),
              overallAverage:
                chunks.reduce((sum, chunk) => sum + chunk.sum, 0) /
                chunks.reduce((count, chunk) => count + chunk.count, 0),
            }))
            .then((result) => ExperimentalOption.Some(result));
        });

      expect(processed.value.constructor.name).toBe("AsyncOpt");
      const result = await processed.value.value;

      expect(result.totalChunks).toBe(5); // 1000/2 even numbers / 100 per chunk
      expect(result.totalCount).toBe(500); // 1000/2 even numbers
      expect(result.totalSum).toBe(250500); // sum of even numbers 2+4+...+1000
      expect(result.overallAverage).toBe(501);
    });
  });

  describe("Type safety and generic preservation", () => {
    it("should preserve complex type information through async transformations", async () => {
      type ComplexType<T> = {
        id: string;
        data: T;
        metadata: {
          created: Date;
          tags: Array<string | number>;
          nested: {
            level1: {
              level2: {
                value: T;
                processed: boolean;
              };
            };
          };
        };
      };

      const createComplex = <T>(value: T): ComplexType<T> => ({
        id: `complex-${typeof value}-${Date.now()}`,
        data: value,
        metadata: {
          created: new Date(),
          tags: ["tag1", 42, "tag3"],
          nested: {
            level1: {
              level2: {
                value,
                processed: false,
              },
            },
          },
        },
      });

      const processComplex = async <T>(
        complex: ComplexType<T>,
      ): Promise<ComplexType<T>> => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          ...complex,
          metadata: {
            ...complex.metadata,
            nested: {
              level1: {
                level2: {
                  ...complex.metadata.nested.level1.level2,
                  processed: true,
                },
              },
            },
          },
        };
      };

      const opt = ExperimentalOption.Some(
        createComplex({ name: "test", age: 25 }),
      );

      const result = opt
        .map((complex) => ({ ...complex, id: `processed-${complex.id}` }))
        .flatMap((complex) =>
          processComplex(complex)
            .then((processed) => ({
              originalId: processed.id.replace("processed-", ""),
              processedId: processed.id,
              dataType: typeof processed.data,
              hasProcessedNestedValue:
                processed.metadata.nested.level1.level2.processed,
              tagCount: processed.metadata.tags.length,
            }))
            .then((data) => ExperimentalOption.Some(data)),
        );

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalResult = await result.value.value;

      expect(finalResult.dataType).toBe("object");
      expect(finalResult.hasProcessedNestedValue).toBe(true);
      expect(finalResult.tagCount).toBe(3);
      expect(finalResult.processedId).toMatch(/^processed-complex-/);
    });
  });
});
