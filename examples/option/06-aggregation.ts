import { Option } from "../../dist/option.mjs"

const all = Option.all(Option.Some(1), Option.Some(2), Option.Some(3))
console.log("all:", all.unwrap())

const first = Option.any(
  Option.None,
  Option.Some("First"),
  Option.Some("Second"),
)
console.log("any:", first.unwrap())

const toResult = Option.Some({ name: "Alice" }).toResult("User not found")
console.log("toResult:", toResult.unwrap())
