import { describe, expect, it } from "bun:test";
import { ExperimentalOption } from "@/internal/option.experimental";

describe("ExperimentalOption - Sync/Async Permutation Tests", () => {
  describe("map method permutations", () => {
    it("should handle sync -> sync -> sync chain", () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map((x) => x * 2) // sync
        .map((x) => x + 10) // sync
        .map((x) => x.toString()); // sync

      expect(result.value.constructor.name).toBe("SyncOpt");
      expect(result.value.value).toBe("94");
    });

    it("should handle sync -> async -> sync chain", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map((x) => x * 2) // sync -> SyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async -> AsyncOpt
        .map((x) => x.toString()); // sync on AsyncOpt -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });

    it("should handle sync -> async -> async chain", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map((x) => x * 2) // sync -> SyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async -> AsyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x.toString();
        }); // async -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });

    it("should handle async -> sync -> sync chain", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x * 2;
        }) // async -> AsyncOpt
        .map((x) => x + 10) // sync on AsyncOpt -> AsyncOpt
        .map((x) => x.toString()); // sync on AsyncOpt -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });

    it("should handle async -> async -> sync chain", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x * 2;
        }) // async -> AsyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async -> AsyncOpt
        .map((x) => x.toString()); // sync on AsyncOpt -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });

    it("should handle async -> sync -> async chain", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x * 2;
        }) // async -> AsyncOpt
        .map((x) => x + 10) // sync on AsyncOpt -> AsyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x.toString();
        }); // async -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });

    it("should handle async -> async -> async chain", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x * 2;
        }) // async -> AsyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async -> AsyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x.toString();
        }); // async -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });

    it("should handle Promise-returning functions", async () => {
      const opt = ExperimentalOption.Some(42);
      const result = opt
        .map((x) => x * 2) // sync -> SyncOpt
        .map((x) => Promise.resolve(x + 10)) // Promise-returning -> AsyncOpt
        .map((x) => Promise.resolve(x.toString())); // Promise-returning on AsyncOpt -> AsyncOpt

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("94");
    });
  });

  describe("None propagation through different operation chains", () => {
    it("should propagate None through sync -> sync -> sync chain", () => {
      const opt = ExperimentalOption.None;
      const result = opt
        .map((x) => x * 2) // sync on None
        .map((x) => x + 10) // sync on None
        .map((x) => x.toString()); // sync on None

      expect(result.value.constructor.name).toBe("SyncOpt");
      expect(result.value.value).toBe(Symbol.for("OptSentinel"));
    });

    it("should propagate None through sync -> async -> sync chain", async () => {
      const opt = ExperimentalOption.None;
      const result = opt
        .map((x) => x * 2) // sync on None -> remains SyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async on None -> remains SyncOpt
        .map((x) => x.toString()); // sync on None -> remains SyncOpt

      expect(result.value.constructor.name).toBe("SyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe(Symbol.for("OptSentinel"));
    });

    it("should propagate None through async -> async -> async chain", async () => {
      const opt = ExperimentalOption.None;
      const result = opt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x * 2;
        }) // async on None -> remains SyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        }) // async on None -> remains SyncOpt
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x.toString();
        }); // async on None -> remains SyncOpt

      expect(result.value.constructor.name).toBe("SyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe(Symbol.for("OptSentinel"));
    });
  });

  describe("Complex operation permutations", () => {
    it("should handle complex nested operations with mixed sync/async", async () => {
      const opt = ExperimentalOption.Some([1, 2, 3, 4, 5]);

      const result = opt
        // Sync operation - calculate sum
        .map((arr) => arr.reduce((a, b) => a + b, 0))
        // Async operation - validate and double
        .map(async (sum) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (sum > 10) return sum * 2;
          throw new Error("Sum too small");
        })
        // Sync operation on async result - convert to string
        .map((doubled) => `Result: ${doubled}`)
        // Async operation - calculate length
        .map(async (str) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return str.length;
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe(10); // "Result: 30".length = 10
    });

    it("should handle error propagation through mixed sync/async chain", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt
        .map((x) => x * 2) // sync
        .map(async (_x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          throw new Error("Async error");
        }) // async with error
        .map((x) => x + 10) // sync (won't execute due to error)
        .map((x) => x.toString()); // sync (won't execute due to error)

      expect(result.value.constructor.name).toBe("AsyncOpt");
      await expect(result.value.value).rejects.toThrow("Async error");
    });

    it("should handle mixed operations with complex data types", async () => {
      interface User {
        id: number;
        name: string;
        scores: number[];
      }

      const opt = ExperimentalOption.Some<User>({
        id: 1,
        name: "Alice",
        scores: [85, 90, 78, 92],
      });

      const result = opt
        // Sync operation - calculate average score
        .map((user) => {
          const avg =
            user.scores.reduce((a, b) => a + b, 0) / user.scores.length;
          return { ...user, averageScore: avg };
        })
        // Async operation - fetch additional data
        .map(async (user) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { ...user, grade: user.averageScore >= 85 ? "A" : "B" };
        })
        // Sync operation - format display name
        .map((user) => `${user.name} (${user.grade})`)
        // Async operation - validate and process
        .map(async (displayName) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          if (displayName.includes("A")) {
            return `Excellent: ${displayName}`;
          }
          return `Good: ${displayName}`;
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("Excellent: Alice (A)");
    });
  });

  describe("Performance and type preservation tests", () => {
    it("should remain SyncOpt when all operations are sync", () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt
        .map((x) => x * 2)
        .map((x) => x + 10)
        .map((x) => x.toString())
        .map((s) => s.length)
        .map((l) => l * 3);

      expect(result.value.constructor.name).toBe("SyncOpt");
      expect(result.value.value).toBe(6); // (42 * 2 + 10) = 94, "94".length = 2, 2 * 3 = 6
    });

    it("should convert to AsyncOpt at first async operation and stay AsyncOpt", async () => {
      const opt = ExperimentalOption.Some(42);

      const step1 = opt.map((x) => x * 2); // sync
      expect(step1.value.constructor.name).toBe("SyncOpt");

      const step2 = step1.map(async (x) => {
        // async - converts to AsyncOpt
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x + 10;
      });
      expect(step2.value.constructor.name).toBe("AsyncOpt");

      const step3 = step2.map((x) => x.toString()); // sync on AsyncOpt
      expect(step3.value.constructor.name).toBe("AsyncOpt");

      const step4 = step3.map((s) => s.length); // sync on AsyncOpt
      expect(step4.value.constructor.name).toBe("AsyncOpt");

      const finalValue = await step4.value.value;
      expect(finalValue).toBe(2); // "94".length = 2
    });

    it("should handle immediate async conversion", async () => {
      const opt = ExperimentalOption.Some(42);

      const result = opt
        .map(async (x) => x * 2) // immediate async
        .map((x) => x + 10) // sync on async
        .map((x) => x.toString()) // sync on async
        .map((s) => s.length); // sync on async

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe(2);
    });
  });

  describe("Edge cases and boundary conditions", () => {
    it("should handle undefined and null in sync/async chains", async () => {
      const opt = ExperimentalOption.Some<number | null | undefined>(42);

      const result = opt
        .map((x) => x) // sync
        .map(async (_x) => {
          // async
          await new Promise((resolve) => setTimeout(resolve, 1));
          return null;
        })
        .map((x) => (x === null ? undefined : x)) // sync on async
        .map(async (x) => {
          // async on async
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x === undefined ? "was_undefined" : "was_something_else";
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toBe("was_undefined");
    });

    it("should handle empty arrays and complex structures", async () => {
      const opt = ExperimentalOption.Some<string[]>(["a", "b", "c"]);

      const result = opt
        .map((arr) => arr.filter((_, i) => i % 2 === 0)) // sync
        .map(async (filtered) => {
          // async
          await new Promise((resolve) => setTimeout(resolve, 1));
          return filtered.join("-");
        })
        .map((str) => str.split("-")) // sync on async
        .map(async (parts) => {
          // async on async
          await new Promise((resolve) => setTimeout(resolve, 1));
          return {
            original: parts,
            count: parts.length,
            first: parts[0] || "empty",
          };
        });

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toEqual({
        original: ["a", "c"],
        count: 2,
        first: "a",
      });
    });

    it("should handle Promise rejection at different stages", async () => {
      const opt = ExperimentalOption.Some(42);

      // Test rejection in first async operation
      const result1 = opt
        .map((x) => x * 2)
        .map(async (_x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          throw new Error("First async failed");
        })
        .map((x) => x + 10);

      await expect(result1.value.value).rejects.toThrow("First async failed");

      // Test rejection in second async operation
      const result2 = opt
        .map((x) => x * 2)
        .map(async (x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          return x + 10;
        })
        .map(async (_x) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          throw new Error("Second async failed");
        });

      await expect(result2.value.value).rejects.toThrow("Second async failed");
    });
  });

  describe("Concurrent and parallel operations", () => {
    it("should handle multiple concurrent chains from same source", async () => {
      const opt = ExperimentalOption.Some(42);

      // Start multiple chains from the same option
      const chain1 = opt.map((x) => x * 2);
      const chain2 = opt.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x + 10;
      });
      const chain3 = opt.map((x) => x.toString());

      // Verify types
      expect(chain1.value.constructor.name).toBe("SyncOpt");
      expect(chain2.value.constructor.name).toBe("AsyncOpt");
      expect(chain3.value.constructor.name).toBe("SyncOpt");

      // Continue chains independently
      const final1 = chain1.map((x) => x + 5);
      const final2 = chain2.map((x) => x * 3);
      const final3 = chain3.map((s) => s.length);

      expect(final1.value.constructor.name).toBe("SyncOpt");
      expect(final2.value.constructor.name).toBe("AsyncOpt");
      expect(final3.value.constructor.name).toBe("SyncOpt");

      // Get results concurrently
      const [result1, result2, result3] = await Promise.all([
        Promise.resolve(final1.value.value),
        final2.value.value,
        Promise.resolve(final3.value.value),
      ]);

      expect(result1).toBe(89); // 42 * 2 + 5
      expect(result2).toBe(156); // (42 + 10) * 3
      expect(result3).toBe(2); // "42".length
    });
  });

  describe("Type safety and generic preservation", () => {
    it("should preserve complex generic types through mixed operations", async () => {
      type ComplexData = {
        id: string;
        metadata: {
          created: Date;
          tags: string[];
          scores: Map<string, number>;
        };
      };

      const opt: ExperimentalOption<ComplexData> = ExperimentalOption.Some({
        id: "test-123",
        metadata: {
          created: new Date(),
          tags: ["tag1", "tag2"],
          scores: new Map([
            ["math", 95],
            ["science", 88],
          ]),
        },
      });

      const result = opt
        // Sync operation with complex transformation
        .map((data) => ({
          ...data,
          metadata: {
            ...data.metadata,
            scores: new Map([...data.metadata.scores]),
          },
        }))
        // Async operation modifying scores
        .map(async (data) => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          const newScores = new Map(data.metadata.scores);
          newScores.set(
            "average",
            Array.from(newScores.values()).reduce((a, b) => a + b, 0) /
              newScores.size,
          );
          return {
            ...data,
            metadata: { ...data.metadata, scores: newScores },
          };
        })
        // Sync operation extracting specific data
        .map((data) => ({
          id: data.id,
          tagCount: data.metadata.tags.length,
          scoreCount: data.metadata.scores.size,
          averageScore: data.metadata.scores.get("average"),
        }));

      expect(result.value.constructor.name).toBe("AsyncOpt");
      const finalValue = await result.value.value;
      expect(finalValue).toEqual({
        id: "test-123",
        tagCount: 2,
        scoreCount: 3,
        averageScore: 91.5,
      });
    });
  });
});
