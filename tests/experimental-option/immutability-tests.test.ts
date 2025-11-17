import { describe, expect, it } from "bun:test";
import {
  AsyncOpt,
  ExperimentalOption,
  SyncOpt,
} from "@/internal/option.experimental";

describe("ExperimentalOption - Immutability and Referential Transparency", () => {
  describe("AsyncOpt branching immutability", () => {
    it("should ensure operations on one branch don't affect other branches", async () => {
      // Create initial AsyncOpt with a value
      const original = AsyncOpt.Some(42);

      // Branch 1: Apply a flatZip that will return None (change internal state to None)
      const branch1 = original.flatZip((x) => {
        // This will return None, changing branch1's internal state
        return x > 100 ? AsyncOpt.Some(x * 2) : AsyncOpt.None;
      });

      // Branch 2: Apply a regular map that should work independently
      const branch2 = original.map((x) => x + 10);

      // Branch 3: Apply a flatMap that should work independently
      const branch3 = original.flatMap((x) => AsyncOpt.Some(x.toString()));

      // Verify that branch1 becomes None (due to the condition)
      const branch1Result = await branch1.value;
      expect(branch1Result).toBe(Symbol.for("OptSentinel"));

      // Verify that branch2 and branch3 are unaffected by branch1's state change
      const branch2Result = await branch2.value;
      const branch3Result = await branch3.value;

      expect(branch2Result).toBe(52); // 42 + 10
      expect(branch3Result).toBe("42"); // "42"

      // Verify original is still unaffected
      const originalResult = await original.value;
      expect(originalResult).toBe(42);
    });

    it("should handle complex branching with multiple async operations", async () => {
      const original = AsyncOpt.Some("test");

      // Create multiple branches with different operations
      const branchNone = original.flatZip(async (str) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return str.length > 10 ? AsyncOpt.Some(str.length) : AsyncOpt.None;
      });

      const branchMap = original.map(async (str) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return str.toUpperCase();
      });

      const branchFlatMap = original.flatMap(async (str) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return AsyncOpt.Some(`${str}-processed`);
      });

      // Verify results
      expect(await branchNone.value).toBe(Symbol.for("OptSentinel")); // Becomes None
      expect(await branchMap.value).toBe("TEST"); // Works independently
      expect(await branchFlatMap.value).toBe("test-processed"); // Works independently
      expect(await original.value).toBe("test"); // Original unchanged
    });

    it("should handle immediate branching with mixed sync/async operations", async () => {
      const original = AsyncOpt.Some([1, 2, 3]);

      // Create branches immediately
      const branch1 = original;
      const branch2 = original;
      const branch3 = original;

      // Apply different operations to each branch
      const processed1 = branch1.map((arr) => arr.reduce((a, b) => a + b, 0)); // sync
      const processed2 = branch2.map(async (arr) => {
        // async
        await new Promise((resolve) => setTimeout(resolve, 1));
        return arr.length;
      });
      const processed3 = branch3.flatZip((arr) =>
        arr.length > 0 ? AsyncOpt.Some(arr.join(",")) : AsyncOpt.None,
      ); // flatZip

      // All should work independently
      expect(await processed1.value).toBe(6); // 1+2+3
      expect(await processed2.value).toBe(3); // length
      expect(await processed3.value).toEqual([[1, 2, 3], "1,2,3"]); // flatZip returns [original, computed] tuple
      expect(await original.value).toEqual([1, 2, 3]); // original unchanged
    });

    it("should ensure None state changes don't propagate to other branches", async () => {
      const original = AsyncOpt.Some("data");

      // Create multiple branches
      const branches = Array.from({ length: 5 }, (_, _i) => original);

      // Make first branch become None
      const noneBranch = branches[0].flatMap(() => AsyncOpt.None);

      // Apply different operations to other branches
      const processedBranches = await Promise.all([
        noneBranch.value, // Should be None
        branches[1].map((s) => s.toUpperCase()).value, // Should work
        branches[2].flatMap((s) => AsyncOpt.Some(s.length)).value, // Should work
        branches[3].map((s) => `${s}-suffix`).value, // Should work
        branches[4].flatZip((s) => AsyncOpt.Some(s.repeat(2))).value, // Should work
      ]);

      // Verify only the first branch became None
      expect(processedBranches[0]).toBe(Symbol.for("OptSentinel"));
      expect(processedBranches[1]).toBe("DATA");
      expect(processedBranches[2]).toBe(4);
      expect(processedBranches[3]).toBe("data-suffix");
      expect(processedBranches[4]).toEqual(["data", "datadata"]);

      // Original should be unchanged
      expect(await original.value).toBe("data");
    });
  });

  describe("SyncOpt branching immutability", () => {
    it("should ensure operations on SyncOpt branches don't affect each other", () => {
      const original = SyncOpt.Some(100);

      // Create branches that become None
      const branchNone = original.flatZip((x) =>
        x > 200 ? SyncOpt.Some(x * 2) : SyncOpt.None,
      );
      const branchWorking = original.map((x) => x + 50);
      const branchFlatMap = original.flatMap((x) => SyncOpt.Some(x.toString()));

      // Verify branch independence
      expect(branchNone.value).toBe(Symbol.for("OptSentinel"));
      expect(branchWorking.value).toBe(150);
      expect(branchFlatMap.value).toBe("100");
      expect(original.value).toBe(100);
    });
  });

  describe("ExperimentalOption branching immutability", () => {
    it("should handle ExperimentalOption branching with auto-async conversion", async () => {
      const original = ExperimentalOption.Some(42);

      // Create branches that will convert to AsyncOpt
      const branchAsync = original.map(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x * 3;
      });

      const branchNoneAsync = original.flatMap(async (x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return x > 100 ? ExperimentalOption.Some(x) : ExperimentalOption.None;
      });

      const branchSync = original.map((x) => x + 5);

      // All should work independently
      expect(await branchAsync.value.value).toBe(126); // 42 * 3
      expect(await branchNoneAsync.value.value).toBe(Symbol.for("OptSentinel")); // None
      expect(branchSync.value.value).toBe(47); // Sync remains sync
      expect(original.value.value).toBe(42); // Original unchanged
    });

    it("should handle complex branching with mixed type conversions", async () => {
      const original = ExperimentalOption.Some("hello");

      // Multiple branches with different behaviors
      const branch1 = original.map((s) => s.length); // Remains SyncOpt
      const branch2 = original.map(async (s) => {
        // Becomes AsyncOpt
        await new Promise((resolve) => setTimeout(resolve, 1));
        return s.toUpperCase();
      });
      const branch3 = original.flatMap((s) =>
        ExperimentalOption.Some(s.split("")),
      ); // Remains SyncOpt
      const branch4 = original.flatMap(async (s) => {
        // Becomes AsyncOpt
        await new Promise((resolve) => setTimeout(resolve, 1));
        return s.includes("x")
          ? ExperimentalOption.Some(s)
          : ExperimentalOption.None;
      });

      // Verify all branches work independently
      expect(branch1.value.constructor.name).toBe("SyncOpt");
      expect(branch2.value.constructor.name).toBe("AsyncOpt");
      expect(branch3.value.constructor.name).toBe("SyncOpt");
      expect(branch4.value.constructor.name).toBe("AsyncOpt");

      expect(branch1.value.value).toBe(5);
      expect(await branch2.value.value).toBe("HELLO");
      expect(branch3.value.value).toEqual(["h", "e", "l", "l", "o"]);
      expect(await branch4.value.value).toBe(Symbol.for("OptSentinel"));
      expect(original.value.value).toBe("hello");
    });
  });

  describe("Promise sharing and independence", () => {
    it("should not share underlying promises between branches", async () => {
      let promiseExecutionCount = 0;

      const createCountingPromise = (value: number): Promise<number> => {
        promiseExecutionCount++;
        return new Promise((resolve) => {
          setTimeout(() => resolve(value), 10);
        });
      };

      const original = new AsyncOpt(createCountingPromise(42));

      // Create multiple branches
      const branch1 = original.map((x) => x * 2);
      const branch2 = original.map((x) => x + 10);
      const branch3 = original.flatMap(
        (x) => new AsyncOpt(Promise.resolve(x.toString())),
      );

      // Execute all branches
      const [result1, result2, result3] = await Promise.all([
        branch1.value,
        branch2.value,
        branch3.value,
      ]);

      // The promise should only be executed once (shared execution)
      // But each branch should get the correct result
      expect(promiseExecutionCount).toBe(1);
      expect(result1).toBe(84);
      expect(result2).toBe(52);
      expect(result3).toBe("42");
    });

    it("should handle branching after promise resolution", async () => {
      const original = AsyncOpt.Some("initial");

      // Wait for original to be resolved
      await original.value;

      // Create branches after resolution
      const branch1 = original.map((s) => s.toUpperCase());
      const branch2 = original.flatMap((s) => AsyncOpt.Some(s.length));

      // Should still work correctly
      expect(await branch1.value).toBe("INITIAL");
      expect(await branch2.value).toBe(7);
    });
  });

  describe("Error isolation between branches", () => {
    it("should ensure errors in one branch don't affect other branches", async () => {
      const original = AsyncOpt.Some(42);

      // Branch that will throw an error
      const errorBranch = original.map(async (_x) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        throw new Error("Branch error");
      });

      // Branches that should work normally
      const workingBranch1 = original.map((x) => x * 2);
      const workingBranch2 = original.flatMap((x) =>
        AsyncOpt.Some(x.toString()),
      );

      // Verify error isolation
      await expect(errorBranch.value).rejects.toThrow("Branch error");
      expect(await workingBranch1.value).toBe(84);
      expect(await workingBranch2.value).toBe("42");
      expect(await original.value).toBe(42);
    });
  });
});
