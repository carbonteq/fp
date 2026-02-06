import { Result } from "../../dist/result.mjs"

const ok = Result.Ok(5)
const err = Result.Err("Missing value")

console.log("ok isOk:", ok.isOk())
console.log("err isErr:", err.isErr())

const matched = ok.match({
  Ok: (value) => `Value: ${value}`,
  Err: (error) => `Error: ${error}`,
})

console.log("match:", matched)
console.log("unwrapOr:", err.unwrapOr(0))
console.log("safeUnwrap:", err.safeUnwrap())
