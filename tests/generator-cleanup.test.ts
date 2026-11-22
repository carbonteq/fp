import { describe, expect, test } from "bun:test"
import { Flow } from "@/flow.js"
import { ExperimentalFlow } from "@/flow-experimental.js"
import { Option } from "@/option.js"
import { ExperimentalOption } from "@/option-experimental.js"
import { Result } from "@/result.js"
import { ExperimentalResult } from "@/result-experimental.js"

// This runtime matrix deliberately shares cases across otherwise distinct effect types.
type Runtime = any
type Body = (effect: (value: Runtime) => Runtime) => Generator<Runtime, Runtime, Runtime> | AsyncGenerator<Runtime, Runtime, Runtime>
const families: { name: string; api: Runtime; option: Runtime; result: Runtime; optional: boolean; stable: boolean }[] = [
  { name: "Option", api: Option, option: Option, result: Result, optional: true, stable: true },
  { name: "Result", api: Result, option: Option, result: Result, optional: false, stable: true },
  { name: "Flow", api: Flow, option: Option, result: Result, optional: false, stable: true },
  { name: "ExperimentalOption", api: ExperimentalOption, option: ExperimentalOption, result: ExperimentalResult, optional: true, stable: false },
  { name: "ExperimentalResult", api: ExperimentalResult, option: ExperimentalOption, result: ExperimentalResult, optional: false, stable: false },
  { name: "ExperimentalFlow", api: ExperimentalFlow, option: ExperimentalOption, result: ExperimentalResult, optional: false, stable: false },
]
const methods = ["gen", "genAdapter", "asyncGen", "asyncGenAdapter"] as const

for (const family of families) {
  for (const method of methods) {
    describe(`${family.name}.${method} cleanup`, () => {
      const asynchronous = method.startsWith("async")
      const adapted = method.endsWith("Adapter")
      const success = (value: Runtime): Runtime => family.optional
        ? family.option.Some(value)
        : family.result.Ok(value)
      const failure = (error: Error): Runtime => family.optional
        ? family.option.None
        : family.result.Err(error)
      const run = (body: Body): Runtime => {
        const factory = (adapter?: Runtime) => body(adapted ? adapter : (value: Runtime) => value)
        return (family.api[method] as Runtime)(asynchronous
          ? async function* (adapter?: Runtime) { return yield* factory(adapter) }
          : factory)
      }
      const assertFailure = (value: Runtime, primary: Error) => {
        if (family.optional) expect(value.isNone()).toBe(true)
        else {
          expect(value.isErr()).toBe(true)
          expect(value.unwrapErr()).toBe(primary)
        }
      }

      test("runs ordinary finally and does not inject failure into an enclosing catch", async () => {
        const primary = new Error("primary")
        const markers: string[] = []
        const value = await run(function* (effect) {
          try {
            try {
              yield effect(failure(primary))
              markers.push("post-failure")
            } catch {
              markers.push("caught")
            }
          } finally {
            markers.push("finally")
          }
        })
        assertFailure(value, primary)
        expect(markers).toEqual(["finally"])
      })

      test("drains nested finally effects and resumes with their successful values", async () => {
        const primary = new Error("primary")
        const markers: Runtime[] = []
        const value = await run(function* (effect) {
          try {
            try { yield effect(failure(primary)) }
            finally { markers.push((yield effect(success(20))) + 2) }
          } finally {
            markers.push((yield effect(success(30))) + 3)
          }
        })
        assertFailure(value, primary)
        expect(markers).toEqual([22, 33])
      })

      test("continues after secondary domain failure with undefined", async () => {
        const primary = new Error("primary")
        const markers: Runtime[] = []
        const value = await run(function* (effect) {
          try { yield effect(failure(primary)) }
          finally {
            markers.push(yield effect(failure(new Error("secondary"))))
            markers.push("finished")
          }
        })
        assertFailure(value, primary)
        expect(markers).toEqual([undefined, "finished"])
      })

      test("preserves primary when a cleanup iterator step throws", async () => {
        const primary = new Error("primary")
        const secondary = new Error("secondary")
        const markers: string[] = []
        const value = await run(function* (effect) {
          try { yield effect(failure(primary)) }
          finally {
            yield effect(success(1))
            markers.push("throw")
            throw secondary
          }
        })
        assertFailure(value, primary)
        expect(markers).toEqual(["throw"])
      })

      test("return inside finally does not replace primary", async () => {
        const primary = new Error("primary")
        const value = await run(function* (effect) {
          try { yield effect(failure(primary)) }
          finally {
            const resumed = yield effect(success(41))
            return resumed + 1
          }
        })
        assertFailure(value, primary)
      })

      test("natural success runs finally exactly once and retains resumed values", async () => {
        const markers: Runtime[] = []
        const value = await run(function* (effect) {
          try { return (yield effect(success(40))) + 2 }
          finally { markers.push(yield effect(success(7))) }
        })
        expect(value.unwrap()).toBe(42)
        expect(markers).toEqual([7])
      })

      test("propagates a thrown body exception after ordinary finally", async () => {
        const primary = new Error("thrown primary")
        const markers: Runtime[] = []
        let caught: unknown
        try {
          await run(function* (effect) {
            try {
              yield effect(success(1))
              throw primary
            } finally {
              markers.push("finally")
            }
          })
        } catch (error) {
          caught = error
        }
        expect(caught).toBe(primary)
        expect(markers).toEqual(["finally"])
      })

      if (asynchronous) {
        test("awaits deferred cleanup before settling", async () => {
          const primary = new Error("primary")
          const { promise: started, resolve: entered } = Promise.withResolvers<void>()
          const { promise: deferred, resolve: release } = Promise.withResolvers<number>()
          const markers: Runtime[] = []
          let settled = false
          const pending = Promise.resolve(run(async function* (effect) {
            try { yield effect(failure(primary)) }
            finally {
              entered()
              markers.push(yield effect(success(await deferred)))
            }
          })).then((value) => { settled = true; return value })
          await started
          expect(settled).toBe(false)
          release(9)
          assertFailure(await pending, primary)
          expect(markers).toEqual([9])
        })

        test("rejected cleanup await preserves primary and runs enclosing finally", async () => {
          const primary = new Error("primary")
          const markers: string[] = []
          const value = await run(async function* (effect) {
            try { yield effect(failure(primary)) }
            finally {
              try { await Promise.reject(new Error("cleanup await")) }
              finally { markers.push("finished") }
            }
          })
          assertFailure(value, primary)
          expect(markers).toEqual(["finished"])
        })

        if (adapted || family.stable) {
          test("continues after a rejected cleanup effect", async () => {
            const primary = new Error("primary")
            const markers: Runtime[] = []
            const value = await run(function* (effect) {
              try { yield effect(failure(primary)) }
              finally {
                const rejected = Promise.reject(new Error("cleanup rejection"))
                markers.push(yield effect(adapted ? rejected : success(rejected)))
                markers.push("finished")
              }
            })
            assertFailure(value, primary)
            expect(markers).toEqual([undefined, "finished"])
          })
        }

        if (adapted) {
          test("preserves rejected outer adapter effect while draining cleanup", async () => {
            const primary = new Error("outer rejection")
            const markers: Runtime[] = []
            const outcome = await Promise.resolve(run(function* (effect) {
              try { yield effect(Promise.reject(primary)) }
              finally { markers.push(yield effect(success(17))) }
            })).then(
              (value) => ({ value, error: undefined }),
              (error: unknown) => ({ value: undefined, error }),
            )
            if (outcome.error !== undefined) expect(outcome.error).toBe(primary)
            else assertFailure(outcome.value, primary)
            expect(markers).toEqual([17])
          })
        }

        if (family.stable) {
          test("preserves rejected stable inner payload while draining cleanup", async () => {
            const primary = new Error("inner rejection")
            const markers: Runtime[] = []
            const outcome = await Promise.resolve(run(async function* (effect) {
              try { yield* effect(success(Promise.reject(primary))) }
              finally { markers.push(yield* effect(success(19))) }
            })).then(
              (value) => ({ value, error: undefined }),
              (error: unknown) => ({ value: undefined, error }),
            )
            if (outcome.error !== undefined) expect(outcome.error).toBe(primary)
            else assertFailure(outcome.value, primary)
            expect(markers).toEqual([19])
          })
        }
      }
    })
  }
}
